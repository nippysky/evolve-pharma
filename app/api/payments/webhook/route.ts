import { NextRequest, NextResponse } from 'next/server';
import { db }                        from '@/lib/db';
import { verifyWebhookSignature }    from '@/lib/paystack';
import {
  getPaymentTransactionByRef,
  updatePaymentTransactionStatus,
}                                    from '@/lib/cart-db';
import { writeAuditLog }             from '@/lib/audit';

export async function POST(req: NextRequest) {
  // Read raw body (needed for HMAC verification)
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ message: 'Could not read body.' }, { status: 400 });
  }

  // Validate signature
  const signature = req.headers.get('x-paystack-signature') ?? '';
  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn('[webhook] Invalid Paystack signature — rejected');
    return NextResponse.json({ message: 'Invalid signature.' }, { status: 401 });
  }

  // Parse payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 });
  }

  const event    = payload.event as string | undefined;
  const data     = (payload.data ?? {}) as Record<string, any>;
  const reference = data.reference as string | undefined;

  // Acknowledge immediately — Paystack expects a fast 200
  void handleWebhookEvent(event, reference, data);

  return NextResponse.json({ message: 'Webhook received.' }, { status: 200 });
}

async function handleWebhookEvent(
  event:     string | undefined,
  reference: string | undefined,
  data:      Record<string, any>,
) {
  try {
    if (!reference) return;

    const tx = await getPaymentTransactionByRef(reference);

    if (event === 'charge.success') {
      await updatePaymentTransactionStatus(
        reference,
        'success',
        JSON.stringify({ gateway_status: data.status, channel: data.channel }),
      );

      if (tx) {
        await db.order.update({
          where: { id: tx.order_id },
          data:  {
            payment_status:    'PAID',
            payment_reference: reference,
            status:            'CONFIRMED',
          },
        });
        console.log(`[webhook] charge.success → order #${tx.order_id} marked PAID`);
      } else {
        // No transaction record — try matching by order.payment_reference
        await db.order.updateMany({
          where: { payment_reference: reference, payment_status: 'UNPAID' },
          data:  { payment_status: 'PAID', status: 'CONFIRMED' },
        });
      }

      void writeAuditLog({
        userId:      undefined,
        userType:    'SYSTEM',
        userName:    'Paystack Webhook',
        email:       data.customer?.email ?? '',
        action:      'PAYMENT_CONFIRMED',
        entityType:  'Order',
        entityId:    tx ? String(tx.order_id) : reference,
        description: `Paystack charge.success for ref ${reference}. ` +
                     `Amount: ₦${(data.amount ?? 0) / 100}.`,
      });

    } else if (event === 'charge.failed') {
      await updatePaymentTransactionStatus(reference, 'failed', JSON.stringify(data));
      console.log(`[webhook] charge.failed → ref ${reference} marked failed`);
    }
  } catch (err) {
    // Never throw — we've already returned 200. Log and move on.
    console.error('[webhook] handleWebhookEvent error', err);
  }
}
