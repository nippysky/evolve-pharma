import { NextRequest }                 from 'next/server';
import { z }                           from 'zod';
import { db }                          from '@/lib/db';
import { getSession }                  from '@/lib/auth';
import { initializePaystackPayment }   from '@/lib/paystack';
import { createPaymentTransaction }    from '@/lib/cart-db';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
} from '@/lib/api/response';

const bodySchema = z.object({
  amount:    z.number().positive(),       // naira
  order_id:  z.number().int().positive().optional(),
  metadata:  z.record(z.string(), z.unknown()).optional(),
  callback_url: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'CUSTOMER') return apiForbidden();

    // Get customer email from User record
    const user = await db.user.findUnique({
      where:  { id: session.userId },
      select: { email: true },
    });
    if (!user) return apiError('User not found.', 404);

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body.', 400); }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid request.', 400);
    }

    const { amount, order_id, metadata, callback_url } = parsed.data;

    const reference = `EVP-${Date.now()}-${Math.floor(Math.random() * 100_000)}`;

    const result = await initializePaystackPayment({
      email:        user.email,
      amount:       Math.round(amount * 100), // convert to kobo
      reference,
      metadata,
      callback_url,
    });

    if (!result.ok) {
      return apiError(`Paystack initialisation failed: ${result.message}`, 502);
    }

    // Record the pending transaction if order_id provided
    if (order_id) {
      await createPaymentTransaction({
        orderId:   order_id,
        reference,
        amount,
        gateway:   'paystack',
        status:    'pending',
      });
    }

    return apiSuccess({
      reference:         result.reference ?? reference,
      authorization_url: result.authorization_url,
      access_code:       result.access_code,
    }, 200, 'Payment initialized.');
  } catch (err) {
    console.error('[POST /api/payments/initiate]', err);
    return apiInternalError();
  }
}
