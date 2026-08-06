import { NextRequest }        from 'next/server';
import { z }                  from 'zod';
import { db }                 from '@/lib/db';
import { getSession }         from '@/lib/auth';
import { revalidateOrders, revalidateDeliveries } from '@/lib/revalidate';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';
import { writeAuditLog }        from '@/lib/audit';
import { sendOrderStatusEmail } from '@/lib/mail';
import { v4 as uuidv4 }         from 'uuid';

const TRANSITIONS: Record<string, string[]> = {
  PENDING:    ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:  ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED',  'CANCELLED'],
  DELIVERED:  [],
  CANCELLED:  [],
};

const schema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED']),
  notes:  z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) return apiNotFound('Order');
    const order = await db.order.findUnique({
      where:  { id: orderId },
      select: {
        id: true, order_number: true, status: true, customer_id: true,
        total: true, delivery_fee: true,
        delivery: { select: { id: true, tracking_code: true } },
      },
    });
    if (!order) return apiNotFound('Order');

    // 2. Parse + validate body
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

    const { status: newStatus, notes } = parsed.data;

    // 3. Guard valid transition
    const allowed = TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return apiError(`Cannot transition from ${order.status} to ${newStatus}.`, 422);
    }

    // 4. Pre-generate tracking code (pure JS — before the transaction)
    //    so we can use the batch-transaction form which avoids the 5s
    const newTrackingCode =
      newStatus === 'DISPATCHED' && !order.delivery
        ? `EP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        : null;

    // Build the operation list (all evaluated synchronously, no async between them)
    const txOps: ReturnType<typeof db.order.update>[] = [
      db.order.update({
        where: { id: orderId },
        data:  { status: newStatus, ...(notes ? { notes } : {}) },
      }) as any,
    ];

    if (newStatus === 'DISPATCHED' && !order.delivery && newTrackingCode) {
      txOps.push(
        db.delivery.create({
          data: {
            uuid:          uuidv4(),
            tracking_code: newTrackingCode,
            order_id:      orderId,
            status:        'AWAITING_DISPATCH',   // no driver yet — admin assigns next
            dispatched_at: new Date(),
          },
        }) as any,
      );
    } else if (newStatus === 'DELIVERED' && order.delivery) {
      txOps.push(
        db.delivery.update({
          where: { id: order.delivery.id },
          data:  { status: 'DELIVERED', delivered_at: new Date() },
        }) as any,
      );
    } else if (newStatus === 'CANCELLED' && order.delivery) {
      txOps.push(
        db.delivery.update({
          where: { id: order.delivery.id },
          data:  { status: 'RETURNED' },
        }) as any,
      );
    }

    // no connection held open during JS execution, no 5s timeout risk.
    await db.$transaction(txOps);

    // 5. Invalidate caches
    revalidateOrders({ orderId });
    revalidateDeliveries(orderId);

    // 6. Resolve tracking code — use the pre-generated one (no extra DB round-trip needed)
    const trackingCode = newTrackingCode ?? order.delivery?.tracking_code ?? null;
    const customer = await db.customer.findUnique({
      where:  { id: order.customer_id },
      select: { user: { select: { email: true, first_name: true, last_name: true } } },
    });

    // 8. Fire-and-forget: audit log + customer email
    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'UPDATE_ORDER_STATUS',
      entityType:  'Order',
      entityId:    String(orderId),
      description: `Order ${order.order_number} status: ${order.status} → ${newStatus}`,
      req,
    });

    if (customer?.user && newStatus !== 'PENDING') {
      try {
        await sendOrderStatusEmail({
          to:           customer.user.email,
          name:         customer.user.first_name,
          orderNumber:  order.order_number,
          orderId:      order.id,
          newStatus:    newStatus as 'CONFIRMED' | 'PROCESSING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED',
          total:        Number(order.total),
          trackingCode,
        });
      } catch (mailErr) {
        console.error('[status email]', mailErr);
      }
    }

    return apiSuccess({ order_id: orderId, status: newStatus }, 200, 'Order status updated');
  } catch (err) {
    console.error('[PATCH /api/orders/[id]/status]', err);
    return apiInternalError();
  }
}
