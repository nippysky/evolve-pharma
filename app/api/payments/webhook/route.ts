import { NextRequest, NextResponse } from 'next/server';
import { db }                        from '@/lib/db';
import { verifyWebhookSignature }    from '@/lib/paystack';
import {
  getPaymentTransactionByRef,
  updatePaymentTransactionStatus,
}                                    from '@/lib/cart-db';
import { writeAuditLog }                from '@/lib/audit';
import { checkAndAwardReferralReward } from '@/lib/referral-reward';
import { notifyCustomerAndOwner } from '@/lib/notifications';

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
        // Paystack retries webhooks on timeout or a non-2xx reply, and can
        // deliver the same event more than once — sometimes concurrently.
        //
        // A read-then-write guard would still race: two retries could both
        // read UNPAID and both fire notifications. This conditional UPDATE is
        // atomic — the database decides the winner, and only the invocation
        // that actually performed the transition sees affected > 0. Duplicates
        // cost a single query and stop here.
        const affected = await db.$executeRaw`
          UPDATE orders
          SET payment_status    = 'PAID',
              status            = 'CONFIRMED',
              payment_reference = ${reference}
          WHERE id = ${tx.order_id}
            AND payment_status <> 'PAID'
        `;

        if (affected === 0) {
          console.log(`[webhook] charge.success → order #${tx.order_id} already PAID, duplicate event ignored`);
          return;
        }

        const updatedOrder = await db.order.findUnique({
          where:  { id: tx.order_id },
          select: { customer_id: true },
        });
        if (!updatedOrder) return;

        console.log(`[webhook] charge.success → order #${tx.order_id} marked PAID`);
        // Trigger referral reward check (non-blocking)
        void checkAndAwardReferralReward(updatedOrder.customer_id);

        void notifyCustomerAndOwner(
          updatedOrder.customer_id,
          {
            type:  'payment',
            title: 'Payment received',
            body:  `We've confirmed your payment of ₦${((data.amount ?? 0) / 100).toLocaleString('en-NG')}. ` +
                   `Your order is now being processed.`,
            link:  `/portal/orders/${tx.order_id}`,
          },
          {
            type:  'payment',
            title: 'Payment confirmed',
            body:  `Order #${tx.order_id} has been paid — ₦${((data.amount ?? 0) / 100).toLocaleString('en-NG')}.`,
            link:  `/admin/orders`,
          },
        );
      } else {
        // No transaction record — try matching by order.payment_reference
        const updated = await db.order.findFirst({
          where:  { payment_reference: reference, payment_status: 'UNPAID' },
          select: { id: true, customer_id: true },
        });
        if (updated) {
          await db.order.update({
            where: { id: updated.id },
            data:  { payment_status: 'PAID', status: 'CONFIRMED' },
          });
          void checkAndAwardReferralReward(updated.customer_id);
        } else {
          await db.order.updateMany({
            where: { payment_reference: reference, payment_status: 'UNPAID' },
            data:  { payment_status: 'PAID', status: 'CONFIRMED' },
          });
        }
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

      // Auto-update the linked order's payment_status to FAILED.
      // Order status stays PENDING so the customer can retry payment.
      if (tx) {
        // Same atomic guard as charge.success, with one extra safeguard: the
        // WHERE clause refuses to touch an order that is already PAID or
        // REFUNDED, so a late or out-of-order failed event can never downgrade
        // a settled payment. affected === 0 means "nothing to do" — either a
        // duplicate, or an order that has since been paid.
        const affected = await db.$executeRaw`
          UPDATE orders
          SET payment_status = 'FAILED'
          WHERE id = ${tx.order_id}
            AND payment_status NOT IN ('PAID', 'REFUNDED', 'FAILED')
        `;

        if (affected === 0) {
          console.log(`[webhook] charge.failed → order #${tx.order_id} not eligible, ignoring`);
          return;
        }

        const failedOrder = await db.order.findUnique({
          where:  { id: tx.order_id },
          select: { customer_id: true, order_number: true },
        });
        if (!failedOrder) return;
        console.log(`[webhook] charge.failed → order #${tx.order_id} payment marked FAILED`);

        void notifyCustomerAndOwner(
          failedOrder.customer_id,
          {
            type:  'payment',
            title: 'Payment failed',
            body:  `We couldn't process your payment for order ${failedOrder.order_number}. ` +
                   `${data.gateway_response ?? 'Please try again or contact us.'}`,
            link:  `/portal/orders/${tx.order_id}`,
          },
          {
            type:  'payment',
            title: 'Payment failed',
            body:  `Payment failed on order ${failedOrder.order_number}. ` +
                   `Reason: ${data.gateway_response ?? 'unknown'}.`,
            link:  `/admin/orders`,
          },
        );
      } else {
        // Fallback: match by payment_reference
        await db.order.updateMany({
          where: { payment_reference: reference, payment_status: { notIn: ['PAID', 'REFUNDED'] } },
          data:  { payment_status: 'FAILED' },
        });
      }

      void writeAuditLog({
        userId:      undefined,
        userType:    'SYSTEM',
        userName:    'Paystack Webhook',
        email:       data.customer?.email ?? '',
        action:      'PAYMENT_FAILED',
        entityType:  'Order',
        entityId:    tx ? String(tx.order_id) : reference,
        description: `Paystack charge.failed for ref ${reference}. Reason: ${data.gateway_response ?? 'unknown'}.`,
      });
    }
  } catch (err) {
    // Never throw — we've already returned 200. Log and move on.
    console.error('[webhook] handleWebhookEvent error', err);
  }
}
