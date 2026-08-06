import { NextRequest }        from 'next/server';
import { z }                  from 'zod';
import { db }                 from '@/lib/db';
import { getSession }         from '@/lib/auth';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';
import { writeAuditLog }          from '@/lib/audit';
import { sendOrderStatusEmail }   from '@/lib/mail';
import { revalidateDeliveries }   from '@/lib/revalidate';

const ADMIN_TRANSITIONS: Record<string, string[]> = {
  AWAITING_DISPATCH: ['ASSIGNED'],
  ASSIGNED:          ['IN_TRANSIT', 'FAILED', 'RETURNED'],
  IN_TRANSIT:        ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY:  ['DELIVERED', 'FAILED'],
  DELIVERED:         [],
  FAILED:            ['ASSIGNED'],
  RETURNED:          [],
};

const DRIVER_TRANSITIONS: Record<string, string[]> = {
  ASSIGNED:         ['IN_TRANSIT'],
  IN_TRANSIT:       ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
};

const schema = z.object({
  status:    z.enum(['AWAITING_DISPATCH', 'ASSIGNED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED']).optional(),
  driver_id: z.number().int().positive().nullable().optional(),
  notes:     z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF', 'DRIVER'].includes(session.role)) return apiForbidden();

    const { id } = await params;
    const deliveryId = parseInt(id, 10);
    if (isNaN(deliveryId)) return apiNotFound('Delivery');

    // Fetch delivery row (select only — no includes)
    const delivery = await db.delivery.findUnique({
      where:  { id: deliveryId },
      select: {
        id: true, tracking_code: true, status: true,
        driver_id: true, order_id: true,
      },
    });
    if (!delivery) return apiNotFound('Delivery');

    // Drivers can only update their own deliveries
    if (session.role === 'DRIVER') {
      const driver = await db.driver.findFirst({
        where:  { user_id: session.userId },
        select: { id: true },
      });
      if (!driver || delivery.driver_id !== driver.id) return apiForbidden();
    }

    // Parse + validate body
    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const [field, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        errors[field] = msgs as string[];
      }
      return apiError('Please review the fields below.', 422, errors);
    }

    const { status: newStatus, driver_id, notes } = parsed.data;

    // Validate status transition
    if (newStatus) {
      const transitions = session.role === 'DRIVER' ? DRIVER_TRANSITIONS : ADMIN_TRANSITIONS;
      const allowed     = transitions[delivery.status] ?? [];
      if (!allowed.includes(newStatus)) {
        return apiError(`Cannot transition from ${delivery.status} to ${newStatus}.`, 422);
      }
    }

    // Only ADMIN may assign/change driver — Staff can update status but not assign drivers
    if (driver_id !== undefined && session.role !== 'ADMIN' && session.role !== 'DRIVER') {
      return apiForbidden();
    }

    // Validate driver exists (if assigning) — sequential
    if (driver_id !== undefined && driver_id !== null) {
      const driverExists = await db.driver.findUnique({
        where:  { id: driver_id },
        select: { id: true },
      });
      if (!driverExists) return apiNotFound('Driver');
    }

    // Update delivery
    // Auto-promote: if assigning a driver to an AWAITING_DISPATCH delivery,
    // move the status to ASSIGNED automatically (no extra round-trip needed).
    const autoPromote =
      driver_id !== undefined && driver_id !== null &&
      !newStatus &&
      delivery.status === 'AWAITING_DISPATCH';

    const updated = await db.delivery.update({
      where: { id: deliveryId },
      data:  {
        ...(newStatus  !== undefined ? { status: newStatus }                     : {}),
        ...(autoPromote              ? { status: 'ASSIGNED' }                    : {}),
        ...(driver_id  !== undefined ? { driver_id }                             : {}),
        ...(notes      !== undefined ? { notes }                                 : {}),
        ...(newStatus === 'DELIVERED'  ? { delivered_at:  new Date() }           : {}),
        ...(newStatus === 'IN_TRANSIT' ? { dispatched_at: new Date() }           : {}),
      },
    });

    // On DELIVERED: sync order status
    if (newStatus === 'DELIVERED') {
      await db.order.update({
        where: { id: delivery.order_id },
        data:  { status: 'DELIVERED' },
      });

      // Fetch order + customer for delivery confirmation email
      const orderData = await db.order.findUnique({
        where:  { id: delivery.order_id },
        select: { order_number: true, total: true, customer_id: true },
      });
      if (orderData) {
        const customerData = await db.customer.findUnique({
          where:  { id: orderData.customer_id },
          select: { user: { select: { email: true, first_name: true } } },
        });
        if (customerData?.user) {
          try {
            await sendOrderStatusEmail({
              to:           customerData.user.email,
              name:         customerData.user.first_name,
              orderNumber:  orderData.order_number,
              orderId:      delivery.order_id,
              newStatus:    'DELIVERED',
              total:        Number(orderData.total),
              trackingCode: delivery.tracking_code,
            });
          } catch (mailErr) {
            console.error('[delivery DELIVERED email]', mailErr);
          }
        }
      }
    }

    // Audit log
    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'UPDATE_DELIVERY',
      entityType:  'Delivery',
      entityId:    String(deliveryId),
      description: newStatus
        ? `Delivery ${delivery.tracking_code}: ${delivery.status} → ${newStatus}`
        : driver_id !== undefined
          ? `Assigned driver ${driver_id} to delivery ${delivery.tracking_code}`
          : `Updated delivery ${delivery.tracking_code}`,
      req,
    });

    revalidateDeliveries(delivery.order_id);
    return apiSuccess(
      { delivery: { id: updated.id, status: updated.status, driver_id: updated.driver_id } },
      200,
      'Delivery updated',
    );
  } catch (err) {
    console.error('[PATCH /api/deliveries/[id]]', err);
    return apiInternalError();
  }
}
