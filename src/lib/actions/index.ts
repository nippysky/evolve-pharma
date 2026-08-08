'use server';

/**
 * Server actions.
 *
 * Everything real lives behind /api routes; this file holds only the actions
 * that a client component invokes directly. Authentication, registration,
 * profile updates, delivery status and product CRUD all go through the API,
 * not through here.
 */

import { getSession }             from '@/lib/auth';
import { db }                     from '@/lib/db';
import { createOrder }            from '@/lib/orders';
import { verifyPaystackPayment }  from '@/lib/paystack';
import { checkoutSchema }         from '@/lib/schemas';

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function fail(err: unknown, fallback = 'Something went wrong'): ActionResult {
  if (err && typeof err === 'object' && 'flatten' in err) {
    const flat = (err as { flatten: () => { fieldErrors: Record<string, string[]> } }).flatten();
    return { ok: false, message: 'Please review the fields below.', fieldErrors: flat.fieldErrors };
  }
  return { ok: false, message: fallback };
}

/**
 * Customer checkout. Validates delivery details, verifies the Paystack
 * payment before any inventory is touched, then creates the order.
 */
export async function checkoutAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  // Authenticate — server actions use next/headers (no req arg)
  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session has expired. Please sign in again.' };
  if (session.role !== 'CUSTOMER') {
    return { ok: false, message: 'Only customer accounts can place orders.' };
  }

  // Validate delivery + payment fields
  const parsed = checkoutSchema.safeParse({
    state:              formData.get('state'),
    city:               formData.get('city'),
    street_address:     formData.get('street_address'),
    contact_phone:      formData.get('contact_phone'),
    delivery_notes:     formData.get('delivery_notes')     || undefined,
    payment_method:     formData.get('payment_method'),
    po_number:          formData.get('po_number')          || undefined,
    paystack_reference: formData.get('paystack_reference') || undefined,
  });
  if (!parsed.success) return fail(parsed.error);

  // Parse basket items (product_id + quantity only; price is re-fetched from DB)
  let items: { product_id: number; quantity: number }[];
  try {
    const raw = formData.get('items');
    items = raw ? JSON.parse(raw as string) : [];
  } catch {
    return { ok: false, message: 'Could not read basket data. Please refresh and try again.' };
  }
  if (!items.length) return { ok: false, message: 'Your basket is empty.' };

  // Verify Paystack payment before touching inventory
  const { payment_method, paystack_reference } = parsed.data;
  if (payment_method === 'paystack') {
    if (!paystack_reference) {
      return { ok: false, message: 'Payment reference missing. Please complete Paystack payment.' };
    }
    const verification = await verifyPaystackPayment(paystack_reference);
    if (!verification.paid) {
      return {
        ok:      false,
        message: `Payment could not be verified: ${verification.message}. Ref: ${paystack_reference}.`,
      };
    }
  }

  // Resolve customer record
  const customer = await db.customer.findUnique({
    where:  { user_id: session.userId },
    select: { id: true },
  });
  if (!customer) return { ok: false, message: 'Customer account not found. Please sign in again.' };

  // Create order (validates stock, deducts inventory, records payment)
  const result = await createOrder({
    customerId:        customer.id,
    userId:            session.userId,
    items,
    deliveryState:     parsed.data.state,
    deliveryCity:      parsed.data.city,
    deliveryAddress:   parsed.data.street_address,
    contactPhone:      parsed.data.contact_phone,
    deliveryNotes:     parsed.data.delivery_notes,
    poNumber:          parsed.data.po_number,
    paymentMethod:     payment_method,
    paystackReference: paystack_reference,
  });

  if (!result.ok) {
    console.error('[checkoutAction] createOrder failed:', result.message);
    return { ok: false, message: result.message };
  }

  return { ok: true, data: { order_number: result.orderNumber } };
}
