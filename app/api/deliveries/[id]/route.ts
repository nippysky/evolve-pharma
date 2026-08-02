/**
 * PATCH /api/deliveries/[id]
 *
 * Assign a driver or update delivery status.
 *
 * Admin/Staff can:
 *   - assign driver_id
 *   - change status to any valid next state
 *
 * Driver can:
 *   - update status of their own deliveries only
 *   - valid driver transitions: ASSIGNED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED | FAILED
 */

import { NextRequest } from 'next/server';
import { z }           from 'zod';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';
import { writeAuditLog } from '@/lib/audit';

// ─── Valid transitions ─────────────────────────────────────────────────────────

const ADMIN_TRANSITIONS: Record<string, string[]> = {
  AWAITING_DISPATCH: ['ASSIGNED'],
  ASSIGNED:          ['IN_TRANSIT','FAILED','RETURNED'],
  IN_TRANSIT:        ['OUT_FOR_DELIVERY','FAILED'],
  OUT_FOR_DELIVERY:  ['DELIVERED','FAILED'],
  DELIVERED:         [],
  FAILED:            ['ASSIGNED'],
  RETURNED:          [],
};

const DRIVER_TRANSITIONS: Record<string, string[]> = {
  ASSIGNED:         ['IN_TRANSIT'],
  IN_TRANSIT:       ['OUT_FOR_DELIVERY','FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED','FAILED'],
};

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  status:    z.enum(['AWAITING_DISPATCH','ASSIGNED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','FAILED','RETURNED']).optional(),
  driver_id: z.number().int().positive().nullable().optional(),
  notes:     z.string().optional(),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

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

    const delivery = await db.delivery.findUnique({
      where:   { id: deliveryId },
      include: { driver: true, order: true },
    });
    if (!delivery) return apiNotFound('Delivery');

    // Drivers can only update their own deliveries
    if (session.role === 'DRIVER') {
      const driver = await db.driver.findFirst({ where: { user_id: session.userId } });
      if (!driver || delivery.driver_id !== driver.id) return apiForbidden();
    }

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

    // Validate driver exists (if assigning)
    if (driver_id !== undefined && driver_id !== null) {
      const driverExists = await db.driver.findUnique({ where: { id: driver_id } });
      if (!driverExists) return apiNotFound('Driver');
    }

    const updated = await db.delivery.update({
      where: { id: deliveryId },
      data:  {
        ...(newStatus !== undefined ? { status: newStatus }               : {}),
        ...(driver_id !== undefined ? { driver_id }                      : {}),
        ...(notes     !== undefined ? { notes }                          : {}),
        ...(newStatus === 'DELIVERED' ? { delivered_at: new Date() }     : {}),
        ...(newStatus === 'IN_TRANSIT'? { dispatched_at: new Date() }    : {}),
      },
    });

    // Sync order status with delivery status
    if (newStatus === 'DELIVERED') {
      await db.order.update({
        where: { id: delivery.order_id },
        data:  { status: 'DELIVERED' },
      });
    }

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
        : `Updated delivery ${delivery.tracking_code}`,
      req,
    });

    return apiSuccess({ delivery: { id: updated.id, status: updated.status } }, 200, 'Delivery updated');
  } catch (err) {
    console.error('[PATCH /api/deliveries/[id]]', err);
    return apiInternalError();
  }
}
