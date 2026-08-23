/**
 * POST /api/orders/on-behalf
 *
 * Lets an ADMIN or STAFF member place an order for a customer.
 *
 * Payment is never marked manually. Every path ends at the Paystack webhook:
 *   payment_link      → order UNPAID, Paystack link generated + emailed.
 *                       Customer pays whenever; webhook flips it to PAID.
 *   bank_transfer     → order UNPAID until an admin reconciles.
 *   cash_on_delivery  → order UNPAID until the driver confirms cash collected.
 *
 * Requires: prisma/migrations/manual/add_placed_by_to_orders.sql
 */

import { NextRequest }              from 'next/server';
import { z }                        from 'zod';
import { db }                       from '@/lib/db';
import { getSession }               from '@/lib/auth';
import { createOrder }              from '@/lib/orders';
import { initializePaystackPayment } from '@/lib/paystack';
import { createPaymentTransaction } from '@/lib/cart-db';
import { getStaffOrderScope }       from '@/lib/data/settings.server';
import { writeAuditLog }            from '@/lib/audit';
import { sendOrderReceiptEmail }    from '@/lib/mail';
import { checkAndAwardSpendReward } from '@/lib/referral';
import { notifyCustomer }           from '@/lib/notifications';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';

const schema = z.object({
  customer_id: z.number().int().positive(),
  items: z
    .array(z.object({
      product_id: z.number().int().positive(),
      quantity:   z.number().int().positive(),
    }))
    .min(1, 'Order must contain at least one item.')
    .max(50, 'Maximum 50 line items per order.'),
  state:          z.string().min(2, 'Delivery state is required.'),
  city:           z.string().min(2, 'Delivery city is required.'),
  street_address: z.string().min(8, 'Delivery address is too short.'),
  contact_phone:  z.string().min(8, 'A contact phone number is required.'),
  delivery_notes: z.string().max(500).optional(),
  po_number:      z.string().max(100).optional(),
  payment_method: z.enum([
    'payment_link',
    'bank_transfer',
    'cash_on_delivery',
    // Rep already collected the money before creating the order (cash, POS,
    // transfer into the company account, etc). Only valid on this route.
    'payment_received',
  ]),
  /** How the money was collected — required for 'payment_received'. */
  received_via: z.enum(['cash', 'bank_transfer', 'pos', 'other']).optional(),
  /** Teller number, POS slip ref, transfer ref — required for 'payment_received'. */
  payment_reference: z.string().min(2).max(120).optional(),
  payment_note:      z.string().max(500).optional(),
}).refine(
  d => d.payment_method !== 'payment_received' || (!!d.received_via && !!d.payment_reference),
  { message: 'Recording a received payment requires the method and a reference.' },
);

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'ADMIN' && session.role !== 'STAFF') {
      return apiForbidden('Only staff and admins can place orders on behalf of customers.');
    }

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body.', 400); }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid request.', 422);
    }

    const {
      customer_id, items, state, city, street_address,
      contact_phone, delivery_notes, po_number, payment_method,
      received_via, payment_reference, payment_note,
    } = parsed.data;

    // ── Load and validate the customer ──────────────────────────────────────
    const customer = await db.customer.findUnique({
      where:  { id: customer_id },
      select: {
        id: true, status: true, company_name: true,
        user: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
    });
    if (!customer || !customer.user) return apiNotFound('Customer');

    // Only fully approved customers can have orders placed for them — a rep
    // must not be able to order for an account still pending PCN review.
    if (customer.status !== 'APPROVED') {
      return apiError(
        `Cannot place an order for this customer — their account status is ` +
        `${customer.status.replace(/_/g, ' ').toLowerCase()}. ` +
        `Only approved customers can have orders placed on their behalf.`,
        409,
      );
    }

    // ── Enforce the staff ordering scope ────────────────────────────────────
    // Admins are never restricted. Staff are restricted only when the admin
    // has flipped staff_order_scope to 'ASSIGNED'.
    if (session.role === 'STAFF') {
      const scope = await getStaffOrderScope();
      if (scope === 'ASSIGNED') {
        const rows = await db.$queryRaw<Array<{ assigned_staff_id: number | null }>>`
          SELECT assigned_staff_id FROM customers WHERE id = ${customer_id}
        `;
        if (rows[0]?.assigned_staff_id !== session.userId) {
          return apiForbidden(
            'This customer is not assigned to you. Ask an admin to place this order ' +
            'or to reassign the customer.',
          );
        }
      }
    }

    const placedByName = `${session.first_name} ${session.last_name}`;

    // ── Create the order (always UNPAID — no path marks it paid here) ───────
    // A Paystack reference is minted up front for the payment-link flow so the
    // webhook can match the eventual charge back to this order.
    const paystackRef = payment_method === 'payment_link'
      ? `ENV-OB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      : undefined;

    const result = await createOrder({
      customerId:      customer.id,
      userId:          session.userId,   // stock movements attributed to the rep
      items,
      deliveryState:   state,
      deliveryCity:    city,
      deliveryAddress: street_address,
      contactPhone:    contact_phone,
      deliveryNotes:   delivery_notes,
      poNumber:        po_number,
      // Map to createOrder's payment vocabulary. Deliberately NOT passing
      // paystackReference here — that argument marks the order PAID, and an
      // on-behalf order must never start paid.
      paymentMethod:
        payment_method === 'payment_link'     ? 'paystack'
      : payment_method === 'payment_received' ? (received_via === 'cash' ? 'cash_on_delivery' : 'bank_transfer')
      : payment_method,
      placedBy: {
        userId: session.userId,
        role:   session.role,
        name:   placedByName,
        email:  session.email,
      },
      // Hold the receipt until the Paystack link exists so the customer gets
      // one email containing the Pay now button, not two.
      deferReceiptEmail: true,
    });

    if (!result.ok) return apiError(result.message, 400);

    // ── Rep already collected the money ─────────────────────────────────────
    // Offline collection (cash, POS, direct transfer) has no gateway callback,
    // so the rep who took the money records it. Allowed here because the order
    // is on-behalf; customer self-checkout stays webhook-only.
    let markedPaid = false;

    if (payment_method === 'payment_received') {
      await db.order.update({
        where: { id: result.orderId },
        data:  {
          payment_status:    'PAID',
          status:            'CONFIRMED',
          payment_reference: payment_reference,
        },
      });
      markedPaid = true;

      void writeAuditLog({
        userId:      session.userId,
        userType:    session.role,
        userName:    placedByName,
        email:       session.email,
        action:      'PAYMENT_RECORDED_BY_STAFF',
        entityType:  'Order',
        entityId:    String(result.orderId),
        description: `${placedByName} (${session.role}) recorded payment already received for ` +
                     `order ${result.orderNumber}. Amount: ₦${result.total.toLocaleString('en-NG')}. ` +
                     `Method: ${received_via}. Reference: ${payment_reference}.` +
                     `${payment_note ? ` Note: ${payment_note}` : ''}`,
        req,
      });

      // Offline payments count toward the referral threshold too.
      void checkAndAwardSpendReward(customer.id);
    }

    // ── Generate the Paystack checkout link ─────────────────────────────────
    let paymentUrl: string | null = null;

    if (payment_method === 'payment_link' && paystackRef) {
      const init = await initializePaystackPayment({
        email:     customer.user.email,
        amount:    Math.round(result.total * 100),   // kobo
        reference: paystackRef,
        metadata:  {
          order_id:      result.orderId,
          order_number:  result.orderNumber,
          placed_by:     placedByName,
          placed_by_id:  session.userId,
          on_behalf:     true,
        },
      });

      if (init.ok && init.authorization_url) {
        paymentUrl = init.authorization_url;

        // Store the reference on the order so the webhook can match it, and
        // record the pending transaction.
        await db.order.update({
          where: { id: result.orderId },
          data:  { payment_reference: paystackRef },
        });

        await createPaymentTransaction({
          orderId:   result.orderId,
          reference: paystackRef,
          amount:    result.total,
          gateway:   'paystack',
          status:    'pending',
        });
      } else {
        // Non-fatal: the order stands, the rep can resend a link later.
        console.error('[on-behalf] Paystack init failed:', init.message);
      }
    }

    // ── Send the receipt, now that any payment link is ready ────────────────
    // Awaited rather than fire-and-forget: on Vercel the lambda freezes the
    // moment the response is sent, which kills an in-flight SMTP handshake.
    if (result.receipt) {
      try {
        await sendOrderReceiptEmail({
          ...result.receipt,
          paymentUrl,
          isPaid: markedPaid || result.receipt.isPaid,
        });
      } catch (mailErr) {
        console.error('[on-behalf] receipt email failed:', mailErr);
      }
    }

    // The customer never touched this order, so the notification is the only
    // in-app signal that it exists. Naming the rep matters: an order appearing
    // unannounced on your account is alarming; "placed by <rep>" is not.
    void notifyCustomer(customer.id, {
      title: 'An order was placed for you',
      body:  `${placedByName} placed order ${result.orderNumber} on your behalf ` +
             `— ₦${result.total.toLocaleString('en-NG')}, ${items.length} line item(s).` +
             `${paymentUrl ? ' A payment link has been emailed to you.' : ''}`,
      type:  'order',
      link:  `/portal/orders/${result.orderId}`,
    });

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    placedByName,
      email:       session.email,
      action:      'CREATE_ORDER_ON_BEHALF',
      entityType:  'Order',
      entityId:    String(result.orderId),
      description: `Order ${result.orderNumber} placed for ${customer.user.first_name} ` +
                   `${customer.user.last_name}` +
                   `${customer.company_name ? ` (${customer.company_name})` : ''} ` +
                   `— ₦${result.total.toLocaleString('en-NG')}, ${items.length} line item(s), ` +
                   `payment method: ${payment_method.replace(/_/g, ' ')}` +
                   `${paymentUrl ? ', payment link issued' : ''}.`,
      req,
    });

    return apiSuccess(
      {
        order_id:     result.orderId,
        order_number: result.orderNumber,
        total:        result.total,
        payment_url:  paymentUrl,
        customer: {
          id:    customer.id,
          name:  `${customer.user.first_name} ${customer.user.last_name}`,
          email: customer.user.email,
        },
      },
      201,
      paymentUrl
        ? 'Order placed. A payment link has been generated for the customer.'
        : 'Order placed successfully.',
    );
  } catch (err) {
    console.error('[POST /api/orders/on-behalf]', err);
    return apiInternalError();
  }
}
