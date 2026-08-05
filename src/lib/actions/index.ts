'use server';

import {
  signInSchema,
  customerRegistrationSchema,
  agentOnboardSchema,
  contactSchema,
  updateProfileSchema,
  checkoutSchema,
  productSchema,
} from '@/lib/schemas';
import { sleep }          from '@/lib/utils';
import { getSession }     from '@/lib/auth';
import { db }             from '@/lib/db';
import { createOrder }    from '@/lib/orders';
import { verifyPaystackPayment } from '@/lib/paystack';
import type { Role }      from '@/types';

// Silence unused import — cookies used by stubs below
// eslint-disable-next-line @typescript-eslint/no-unused-vars

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
 * Customer sign-in stub — in the new system, login is handled by
 * POST /api/auth/customer/login (Module 2). Kept here for backward-compat
 * until the sign-in page is migrated.
 */
export async function signInAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await sleep(900);
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return fail(parsed.error);
  return { ok: true };
}

/** Staff sign-in stub — replaced by POST /api/auth/staff/login in Module 2. */
export async function staffSignInAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await sleep(900);
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return fail(parsed.error);
  return { ok: true };
}

/**
 * Staff session cookie stub — no-op in new JWT system.
 * Replaced by the API route setting httpOnly cookies directly.
 */
export async function setStaffSessionAction(
  _backendRole: string,
  _userInfo?: { email?: string; full_name?: string },
): Promise<ActionResult<{ role: Role }>> {
  return { ok: true, data: { role: 'ADMIN' } };
}

/** Update a staff member's permission preset (admin only). */
export async function updateStaffPermissionAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await sleep(600);
  const staffId = Number(formData.get('staff_id'));
  const preset = String(formData.get('preset'));
  if (!staffId || !preset) return { ok: false, message: 'Invalid request.' };
  // Real impl: PATCH /api/staff/:id { permission_preset: preset }
  return { ok: true, data: { staff_id: staffId, preset } };
}

/** Assign a driver to a delivery (admin / operations_lead). */
export async function assignDriverAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const deliveryId = Number(formData.get('delivery_id'));
  const driverId   = Number(formData.get('driver_id'));
  if (!deliveryId || !driverId) return { ok: false, message: 'Select a driver to assign.' };

  const session = await getSession();
  if (!session) return { ok: false, message: 'Session expired. Please sign in again.' };
  if (!['ADMIN', 'STAFF'].includes(session.role)) return { ok: false, message: 'Forbidden.' };
  const driver = await db.driver.findUnique({ where: { id: driverId }, select: { id: true } });
  if (!driver) return { ok: false, message: 'Driver not found.' };

  // Update delivery with assigned driver (single sequential call)
  await db.delivery.update({
    where: { id: deliveryId },
    data:  { driver_id: driverId },
  });

  return { ok: true, data: { delivery_id: deliveryId, driver_id: driverId } };
}

/** Driver acknowledges their delivery assignment — transitions status to 'assigned'. */
export async function acknowledgeAssignmentAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await sleep(500);
  const deliveryId = Number(formData.get('delivery_id'));
  if (!deliveryId) return { ok: false, message: 'Invalid delivery.' };
  // Real impl: POST /api/deliveries/:id/acknowledge  → status: 'assigned'
  return { ok: true, data: { delivery_id: deliveryId, status: 'assigned' } };
}

/** Driver marks delivery as completed / out for delivery / etc. */
export async function updateDeliveryStatusAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await sleep(600);
  const deliveryId = Number(formData.get('delivery_id'));
  const status = String(formData.get('status'));
  if (!deliveryId || !status) return { ok: false, message: 'Invalid request.' };
  // Real impl: PATCH /api/deliveries/:id/status
  return { ok: true, data: { delivery_id: deliveryId, status } };
}

/**
 * Called from the /upload-pcn gate page for customers who were bulk-imported
 * or who abandoned the sign-up before uploading their certificate.
 * Real impl: uploads file to CDN → PATCH /api/customers/me { pcn_cert_url }
 */
export async function uploadPcnCertAction(formData: FormData): Promise<ActionResult> {
  await sleep(1000);
  const file = formData.get('pcn_cert') as File | null;
  if (!file || !file.name) {
    return { ok: false, message: 'Please select a file before submitting.' };
  }
  const MAX_BYTES = 8 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return { ok: false, message: 'File is too large. Maximum size is 8 MB.' };
  }
  // Real impl: stream file to CDN, set pcn_cert_url on the customer record,
  // set pcn_uploaded = true, then invalidate the session so the portal layout
  // gate passes on the next request.
  return { ok: true };
}

/**
 * Final step of the customer wizard. Email is verified in-flow before this
 * runs. Accounts are created in PENDING status — the customer can't sign in
 * until an admin approves them (B2B / pharmacy compliance requirement).
 */
export async function customerSignUpAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await sleep(1200);

  if (formData.get('email_verified') !== 'true') {
    return { ok: false, message: 'Please verify your email before completing registration.' };
  }

  const file = formData.get('pcn_cert') as File | null;
  // Real impl: upload file → CDN → use returned URL.
  const pcn_cert_url =
    file && file.name ? `https://cdn.envolvepharm.com.ng/pcn/${encodeURIComponent(file.name)}` : '';

  const parsed = customerRegistrationSchema.safeParse({
    first_name: formData.get('first_name'),
    middle_name: formData.get('middle_name') ?? '',
    last_name: formData.get('last_name'),
    company_name: formData.get('company_name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    city: formData.get('city'),
    state: formData.get('state'),
    country: formData.get('country'),
    pcn_cert_url,
    password: formData.get('password'),
    confirm_password: formData.get('confirm_password'),
    accept_terms: formData.get('accept_terms') === 'on',
  });
  if (!parsed.success) return fail(parsed.error);

  return { ok: true, data: { status: 'pending_approval' } };
}

/** Send a 6-digit verification code to the email (demo: simulated). */
export async function requestEmailCode(email: string): Promise<ActionResult> {
  await sleep(800);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, message: 'Enter a valid email before requesting a code.' };
  }
  return { ok: true };
}

/** Verify the emailed code (demo: accepts any 6 digits). */
export async function verifyEmailCode(email: string, code: string): Promise<ActionResult> {
  await sleep(700);
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, message: 'Enter the 6-digit code.' };
  }
  return { ok: true };
}

/**
 * Admin/agent onboarding a CUSTOMER from inside the console. (There is no
 * public staff signup — staff are created in the console and invited.)
 */
export async function agentOnboardCustomerAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await sleep(1100);
  const file = formData.get('pcn_cert') as File | null;
  const pcn_cert_url =
    file && file.name
      ? `https://cdn.envolvepharm.com.ng/pcn/${encodeURIComponent(file.name)}`
      : 'https://cdn.envolvepharm.com.ng/pcn/placeholder.pdf';
  const parsed = agentOnboardSchema.safeParse({
    company_name: formData.get('company_name'),
    company_address: formData.get('company_address'),
    fname: formData.get('fname'),
    lname: formData.get('lname'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    pcn_cert_url,
    send_invite: formData.get('send_invite') !== 'off',
  });
  if (!parsed.success) return fail(parsed.error);
  return { ok: true };
}

export async function contactAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await sleep(800);
  const parsed = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    company: formData.get('company') || undefined,
    message: formData.get('message'),
  });
  if (!parsed.success) return fail(parsed.error);
  return { ok: true };
}

export async function updateProfileAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await sleep(700);
  const parsed = updateProfileSchema.safeParse({
    fname: formData.get('fname'),
    lname: formData.get('lname'),
    phone: formData.get('phone'),
    company_address: formData.get('company_address') || undefined,
  });
  if (!parsed.success) return fail(parsed.error);
  return { ok: true };
}

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
    console.log('[checkoutAction] Paystack verify result:', { paid: verification.paid, message: verification.message, ref: paystack_reference });
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
    customerId:       customer.id,
    userId:           session.userId,
    items,
    deliveryState:    parsed.data.state,
    deliveryCity:     parsed.data.city,
    deliveryAddress:  parsed.data.street_address,
    contactPhone:     parsed.data.contact_phone,
    deliveryNotes:    parsed.data.delivery_notes,
    poNumber:         parsed.data.po_number,
    paymentMethod:    payment_method,
    paystackReference: paystack_reference,
  });

  if (!result.ok) {
    console.error('[checkoutAction] createOrder failed:', result.message);
    return { ok: false, message: result.message };
  }

  return { ok: true, data: { order_number: result.orderNumber } };
}

export async function createProductAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await sleep(900);
  const parsed = productSchema.safeParse({
    name: formData.get('name'),
    sku: formData.get('sku'),
    description: formData.get('description'),
    price: Number(formData.get('price')),
    category: formData.get('category'),
    manufacturer: formData.get('manufacturer'),
    form: formData.get('form'),
    strength: formData.get('strength'),
    pack_size: formData.get('pack_size'),
    prescription_required: formData.get('prescription_required') === 'on',
  });
  if (!parsed.success) return fail(parsed.error);
  return { ok: true };
}