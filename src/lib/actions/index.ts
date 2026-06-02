/**
 * ENVOLVE PHARMACEUTICALS — Server Actions
 *
 * Placeholder server actions wired to validation. When the PHP backend
 * ships, replace each body with a fetch to the matching endpoint — the
 * signatures stay stable so forms/components don't change.
 *
 * Return shape:
 *   { ok: true, data?: T } | { ok: false, message: string, fieldErrors?: Record<string, string[]> }
 */

'use server';

import { cookies } from 'next/headers';
import {
  signInSchema,
  customerRegistrationSchema,
  agentOnboardSchema,
  contactSchema,
  updateProfileSchema,
  checkoutSchema,
  productSchema,
} from '@/lib/schemas';
import { ROLE_COOKIE_NAME } from '@/lib/auth';
import { sleep } from '@/lib/utils';
import type { Role } from '@/types';

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
 * Establish the active session role (demo build). In production this is
 * replaced by the signed session the PHP backend issues after verifying
 * credentials. Cookie options mirror the role switcher's.
 */
async function setSessionRole(role: Role): Promise<void> {
  const store = await cookies();
  store.set(ROLE_COOKIE_NAME, role, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  });
}

// ---------- Auth actions -------------------------------------------------

/** Customer sign-in — public door. Customers only. Routes to /portal/*. */
export async function signInAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await sleep(900);
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return fail(parsed.error);
  await setSessionRole('customer');
  return { ok: true };
}

/** Staff sign-in — internal door (admin / sales_agent). Routes to /console/*. */
export async function staffSignInAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await sleep(900);
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return fail(parsed.error);
  const requested = String(formData.get('role') ?? 'admin');
  const role: Role = requested === 'sales_agent' ? 'sales_agent' : 'admin';
  await setSessionRole(role);
  return { ok: true, data: { role } };
}

// ---------- Customer registration ---------------------------------------

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

// ---------- Agent (in-dashboard, admin-only) -----------------------------

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

// ---------- Misc ---------------------------------------------------------

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
  await sleep(1200);
  const parsed = checkoutSchema.safeParse({
    delivery_address: formData.get('delivery_address'),
    contact_phone: formData.get('contact_phone'),
    delivery_notes: formData.get('delivery_notes') || undefined,
    payment_method: formData.get('payment_method'),
    po_number: formData.get('po_number') || undefined,
  });
  if (!parsed.success) return fail(parsed.error);
  return {
    ok: true,
    data: {
      order_number: `EVP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999)).padStart(5, '0')}`,
    },
  };
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