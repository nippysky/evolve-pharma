/**
 * ENVOLVE PHARMACEUTICALS — Server Actions
 *
 * These are placeholder server actions wired to the Zod schemas. When
 * the PHP backend ships, replace the body of each action with a fetch
 * call to the corresponding endpoint. The action signature stays
 * stable, so forms and components don't need to change.
 *
 * All actions follow the same return shape:
 *   { ok: true, data?: T } | { ok: false, message: string, fieldErrors?: Record<string, string[]> }
 */

'use server';

import {
  signInSchema,
  customerSignUpSchema,
  agentOnboardSchema,
  contactSchema,
  updateProfileSchema,
  checkoutSchema,
  productSchema,
} from '@/lib/schemas';
import { sleep } from '@/lib/utils';

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

// ---------- Auth actions -------------------------------------------------

export async function signInAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  await sleep(900); // simulate network
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return fail(parsed.error);
  return { ok: true };
}

export async function customerSignUpAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await sleep(1200);
  const file = formData.get('pcn_cert') as File | null;
  // In real impl, upload file → CDN → set URL. Here we mock a URL.
  const pcn_cert_url = file && file.name ? `https://cdn.envolvepharm.com.ng/pcn/${encodeURIComponent(file.name)}` : '';
  const parsed = customerSignUpSchema.safeParse({
    fname: formData.get('fname'),
    lname: formData.get('lname'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    password: formData.get('password'),
    confirm_password: formData.get('confirm_password'),
    company_name: formData.get('company_name'),
    company_address: formData.get('company_address'),
    pcn_cert_url,
    accept_terms: formData.get('accept_terms') === 'on',
  });
  if (!parsed.success) return fail(parsed.error);
  return { ok: true };
}

export async function agentOnboardCustomerAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await sleep(1100);
  const file = formData.get('pcn_cert') as File | null;
  const pcn_cert_url = file && file.name ? `https://cdn.envolvepharm.com.ng/pcn/${encodeURIComponent(file.name)}` : 'https://cdn.envolvepharm.com.ng/pcn/placeholder.pdf';
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

/**
 * For sales agents signing themselves up via the public /sign-up/agent
 * page — light schema kept inline because it doesn't map 1:1 to the
 * backend (HR creates real agent records).
 */
export async function agentSelfSignUpAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await sleep(900);
  const fname = String(formData.get('fname') ?? '').trim();
  const lname = String(formData.get('lname') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const region = String(formData.get('region') ?? '').trim();
  const errors: Record<string, string[]> = {};
  if (fname.length < 1) errors.fname = ['First name is required'];
  if (lname.length < 1) errors.lname = ['Last name is required'];
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = ['Enter a valid email'];
  if (phone.length < 7) errors.phone = ['Enter a valid phone number'];
  if (region.length < 2) errors.region = ['Select a region'];
  if (Object.keys(errors).length) return { ok: false, message: 'Please review the form.', fieldErrors: errors };
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
