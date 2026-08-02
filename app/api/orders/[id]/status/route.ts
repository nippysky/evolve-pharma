/**
 * PATCH /api/orders/[id]/status
 *
 * Transitions an order to a new status.
 * Enforces valid status flow:
 *   PENDING → CONFIRMED → PROCESSING → DISPATCHED → DELIVERED
 *   Any → CANCELLED  (Admin/Staff only)
 *
 * When status → DISPATCHED, creates a Delivery record if one doesn't exist.
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
import { v4 as uuidv4 }  from 'uuid';

// ─── Valid transitions ─────────────────────────────────────────────────────────

const TRANSITIONS: Record<string, string[]> = {
  PENDING:    ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:  ['PROCESSING','CANCELLED'],
  PROCESSING: ['DISPATCHED','CANCELLED'],
  DISPATCHED: ['DELIVERED', 'CANCELLED'],
  DELIVERED:  [],
  CANCELLED:  [],
};

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  status: z.enum(['PENDING','CONFIRMED','PROCESSING','DISPATCHED','DELIVERED','CANCELLED']),
  notes:  z.string().optional(),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

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
      where:   { id: orderId },
      include: { delivery: true },
    });
    if (!order) return apiNotFound('Order');

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

    // Validate transition
    const allowed = TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return apiError(
        `Cannot transition from ${order.status} to ${newStatus}.`,
        422,
      );
    }

    await db.$transaction(async (tx: any) => {
      await tx.order.update({
        where: { id: orderId },
        data:  {
          status: newStatus,
          ...(notes ? { notes } : {}),
        },
      });

      // Auto-create delivery record when order is dispatched
      if (newStatus === 'DISPATCHED' && !order.delivery) {
        const trackingCode = `EP-${Date.now()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`;
        await tx.delivery.create({
          data: {
            uuid:          uuidv4(),
            tracking_code: trackingCode,
            order_id:      orderId,
            status:        'ASSIGNED',
            dispatched_at: new Date(),
          },
        });
      }

      if (newStatus === 'DELIVERED' && order.delivery) {
        await tx.delivery.update({
          where: { id: order.delivery.id },
          data:  { status: 'DELIVERED', delivered_at: new Date() },
        });
      }

      if (newStatus === 'CANCELLED' && order.delivery) {
        await tx.delivery.update({
          where: { id: order.delivery.id },
          data:  { status: 'RETURNED' },
        });
      }
    });

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

    return apiSuccess({ order_id: orderId, status: newStatus }, 200, 'Order status updated');
  } catch (err) {
    console.error('[PATCH /api/orders/[id]/status]', err);
    return apiInternalError();
  }
}
