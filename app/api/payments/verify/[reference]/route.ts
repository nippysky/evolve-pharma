import { NextRequest }                 from 'next/server';
import { db }                          from '@/lib/db';
import { getSession }                  from '@/lib/auth';
import { verifyPaystackPayment }       from '@/lib/paystack';
import {
  getPaymentTransactionByRef,
  updatePaymentTransactionStatus,
}                                      from '@/lib/cart-db';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';

type Ctx = { params: Promise<{ reference: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'CUSTOMER') return apiForbidden();

    const { reference } = await params;

    const verification = await verifyPaystackPayment(reference);

    // Update transaction record if one exists
    const txRecord = await getPaymentTransactionByRef(reference);

    if (txRecord) {
      const newStatus = verification.paid ? 'success' : 'failed';
      await updatePaymentTransactionStatus(reference, newStatus);

      // Update linked order payment_status
      if (verification.paid) {
        const order = await db.order.findUnique({
          where:  { id: txRecord.order_id },
          select: { id: true, customer: { select: { user_id: true } } },
        });
        if (!order) return apiNotFound('Order');

        // Ensure the customer owns this order
        if (order.customer.user_id !== session.userId) return apiForbidden();

        await db.order.update({
          where: { id: order.id },
          data:  {
            payment_status:    'PAID',
            payment_reference: reference,
            status:            'CONFIRMED',
          },
        });
      }
    }

    return apiSuccess({
      verified:  verification.paid,
      reference,
      amount:    verification.amount ? verification.amount / 100 : null, // naira
      message:   verification.message,
    });
  } catch (err) {
    console.error('[GET /api/payments/verify/[reference]]', err);
    return apiInternalError();
  }
}
