import { NextRequest }          from 'next/server';
import { z }                    from 'zod';
import { db }                   from '@/lib/db';
import { getSession }           from '@/lib/auth';
import { revalidateOrders }     from '@/lib/revalidate';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';
import { writeAuditLog }                  from '@/lib/audit';
import { sendPaymentStatusEmail }         from '@/lib/mail';
import { checkAndAwardSpendReward }    from '@/lib/referral';

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
    // Payment status is automated via Paystack webhook.
    // This endpoint is restricted to ADMIN only for exceptional manual corrections
    // (e.g. REFUNDED). The UI no longer exposes Mark Paid / Mark Unpaid buttons.
    if (session.role !== 'ADMIN') return apiForbidden('Payment status is managed automatically.');

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

    // 3. Fetch customer for cache bust + email
    const cust = await db.customer.findUnique({
      where:  { id: order.customer_id },
      select: { user_id: true, user: { select: { email: true, first_name: true } } },
    });

    revalidateOrders({ orderId, userId: cust?.user_id });

    // 4. Send payment status email — awaited so Vercel doesn't kill it mid-send
    if (cust?.user && (newStatus === 'PAID' || newStatus === 'REFUNDED')) {
      try {
        await sendPaymentStatusEmail({
          to:            cust.user.email,
          name:          cust.user.first_name,
          orderNumber:   order.order_number,
          orderId:       order.id,
          paymentStatus: newStatus,
          total:         Number(order.total),
        });
      } catch (mailErr) {
        console.error('[payment email]', mailErr);
      }
    }

    // 5. Trigger referral reward check if payment just became PAID
    if (newStatus === 'PAID' && prev !== 'PAID') {
      void checkAndAwardSpendReward(order.customer_id);
    }

    // 6. Audit log
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
