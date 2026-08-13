/**
 * PATCH /api/orders/[id]/confirm-payment
 *
 * Lets the staff member or admin who handles an on-behalf order record that
 * payment has been collected offline — cash, POS, or a direct bank transfer
 * against an emailed invoice. There is no gateway callback for those, so a
 * human has to confirm it.
 *
 * Deliberately narrow: this ONLY works on orders that were placed on a
 * customer's behalf (placed_by_user_id IS NOT NULL). Orders a customer placed
 * themselves through the portal stay fully automated via the Paystack webhook,
 * which is the behaviour the business asked for.
 */

import { NextRequest }                 from 'next/server';
import { z }                           from 'zod';
import { db }                          from '@/lib/db';
import { getSession }                  from '@/lib/auth';
import { revalidateOrders }            from '@/lib/revalidate';
import { writeAuditLog }               from '@/lib/audit';
import { sendPaymentStatusEmail }      from '@/lib/mail';
import { checkAndAwardSpendReward } from '@/lib/referral';
import { notifyUser }                  from '@/lib/notifications';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';

const schema = z.object({
  received_via:      z.enum(['cash', 'bank_transfer', 'pos', 'other']),
  payment_reference: z.string().min(2, 'A reference is required.').max(120),
  note:              z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'ADMIN' && session.role !== 'STAFF') {
      return apiForbidden('Only staff and admins can confirm an offline payment.');
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) return apiNotFound('Order');

    // One query for the order, the on-behalf marker, and the customer's user id.
    // Fetching these separately meant three round trips for one row — costly on
    // serverless, where the connection pool is 1.
    const rows = await db.$queryRaw<Array<{
      id:                number;
      order_number:      string;
      payment_status:    string;
      total:             string | number;
      customer_id:       number;
      placed_by_user_id: number | null;
      user_id:           number;
      email:             string;
      first_name:        string;
    }>>`
      SELECT o.id, o.order_number, o.payment_status, o.total, o.customer_id,
             o.placed_by_user_id, c.user_id, u.email, u.first_name
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN users     u ON u.id = c.user_id
      WHERE o.id = ${orderId}
      LIMIT 1
    `;
    const order = rows[0];
    if (!order) return apiNotFound('Order');

    // Guard: on-behalf orders only.
    if (!order.placed_by_user_id) {
      return apiForbidden(
        'This order was placed by the customer themselves, so its payment is ' +
        'confirmed automatically by Paystack and cannot be set manually.',
      );
    }

    if (order.payment_status === 'PAID') {
      return apiError('This order is already marked paid.', 409);
    }
    if (order.payment_status === 'REFUNDED') {
      return apiError('This order has been refunded and cannot be marked paid.', 409);
    }

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body.', 400); }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid request.', 422);
    }

    const { received_via, payment_reference, note } = parsed.data;
    const actorName = `${session.first_name} ${session.last_name}`;
    const prev      = order.payment_status;

    await db.order.update({
      where: { id: orderId },
      data:  {
        payment_status:    'PAID',
        status:            'CONFIRMED',
        payment_reference: payment_reference,
      },
    });

    // Cache bust + notify the customer — all from the single lookup above.
    revalidateOrders({ orderId, userId: order.user_id });

    {
      try {
        await sendPaymentStatusEmail({
          to:            order.email,
          name:          order.first_name,
          orderNumber:   order.order_number,
          orderId:       order.id,
          paymentStatus: 'PAID',
          total:         Number(order.total),
        });
      } catch (mailErr) {
        console.error('[confirm-payment] email failed:', mailErr);
      }
    }

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    actorName,
      email:       session.email,
      action:      'PAYMENT_RECORDED_BY_STAFF',
      entityType:  'Order',
      entityId:    String(orderId),
      description: `${actorName} (${session.role}) confirmed offline payment for order ` +
                   `${order.order_number}. ${prev} → PAID. ` +
                   `Amount: ₦${Number(order.total).toLocaleString('en-NG')}. ` +
                   `Method: ${received_via}. Reference: ${payment_reference}.` +
                   `${note ? ` Note: ${note}` : ''}`,
      req,
    });

    void notifyUser(order.user_id, {
      type:  'payment',
      title: 'Payment confirmed',
      body:  `${actorName} confirmed receipt of your payment for order ${order.order_number} ` +
             `(₦${Number(order.total).toLocaleString('en-NG')}, via ${received_via.replace(/_/g, ' ')}).`,
      link:  `/portal/orders/${orderId}`,
    });

    void checkAndAwardSpendReward(order.customer_id);

    return apiSuccess(
      { order_id: orderId, payment_status: 'PAID', payment_reference },
      200,
      'Payment confirmed.',
    );
  } catch (err) {
    console.error('[PATCH /api/orders/[id]/confirm-payment]', err);
    return apiInternalError();
  }
}
