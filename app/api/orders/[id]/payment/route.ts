import { NextRequest }          from 'next/server';
import { z }                    from 'zod';
import { db }                   from '@/lib/db';
import { getSession }           from '@/lib/auth';
import { revalidateTag }        from 'next/cache';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';
import { writeAuditLog }          from '@/lib/audit';
import { sendPaymentStatusEmail } from '@/lib/mail';

const schema = z.object({
  payment_status: z.enum(['PAID', 'UNPAID', 'PARTIAL', 'REFUNDED', 'FAILED']),
  notes: z.string().optional(),
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
        id: true, order_number: true, payment_status: true, total: true,
        customer_id: true,
      },
    });
    if (!order) return apiNotFound('Order');

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid request.', 422);
    }

    const { payment_status: newStatus } = parsed.data;
    const prev = order.payment_status;

    // 2. Update payment status
    await db.order.update({
      where: { id: orderId },
      data:  { payment_status: newStatus },
    });

    // 3. Invalidate caches
    try {
      // Fetch customer's user_id for targeted cache bust
      const cust = await db.customer.findUnique({
        where:  { id: order.customer_id },
        select: { user_id: true, user: { select: { email: true, first_name: true } } },
      });

      revalidateTag('orders', 'default');
      revalidateTag(`order-${orderId}`, 'default');
      if (cust?.user_id) revalidateTag(`orders-user-${cust.user_id}`, 'default');

      // 4. Fire-and-forget email for PAID and REFUNDED status changes
      if (cust?.user && (newStatus === 'PAID' || newStatus === 'REFUNDED')) {
        void sendPaymentStatusEmail({
          to:            cust.user.email,
          name:          cust.user.first_name,
          orderNumber:   order.order_number,
          orderId:       order.id,
          paymentStatus: newStatus,
          total:         Number(order.total),
        }).catch(err => console.error('[payment email]', err));
      }
    } catch { /* outside request context — safe to ignore */ }

    // 5. Audit log
    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'UPDATE_PAYMENT_STATUS',
      entityType:  'Order',
      entityId:    String(orderId),
      description: `Order ${order.order_number} payment: ${prev} → ${newStatus}`,
      req,
    });

    return apiSuccess(
      { order_id: orderId, payment_status: newStatus },
      200,
      'Payment status updated.',
    );
  } catch (err) {
    console.error('[PATCH /api/orders/[id]/payment]', err);
    return apiInternalError();
  }
}
