/**
 * ENVOLVE PHARMACEUTICALS — Console (admin) Server Actions
 *
 * People management + catalog/inventory mutations. Every action re-checks
 * the session role server-side. Swap each body for a fetch to the PHP
 * backend when ready — signatures stay stable.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import {
  agentInviteSchema,
  agentImportRowSchema,
  staffInviteSchema,
  staffImportRowSchema,
  customerOnboardSchema,
  customerImportRowSchema,
  productSchema,
  productImportRowSchema,
  batchReceiveSchema,
  batchImportRowSchema,
} from '@/lib/schemas';
import { sleep } from '@/lib/utils';
import type { ActionResult } from '@/lib/actions';
import type { Role, SessionUser } from '@/types';

const NOT_AUTHORIZED: ActionResult = { ok: false, message: 'You are not authorized to do this.' };

function fail(err: unknown, fallback = 'Something went wrong'): ActionResult {
  if (err && typeof err === 'object' && 'flatten' in err) {
    const flat = (err as { flatten: () => { fieldErrors: Record<string, string[]> } }).flatten();
    return { ok: false, message: 'Please review the fields below.', fieldErrors: flat.fieldErrors };
  }
  return { ok: false, message: fallback };
}

async function guard(roles: Role[]): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session || !roles.includes(session.role)) return null;
  return session;
}

function summarize(
  rows: unknown[],
  schema: { safeParse: (v: unknown) => { success: boolean } },
): { created: number; skipped: number } {
  let created = 0;
  for (const row of rows) if (schema.safeParse(row).success) created += 1;
  return { created, skipped: rows.length - created };
}

// ---------- Sales agents -------------------------------------------------

export async function inviteAgentAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard(['admin']))) return NOT_AUTHORIZED;
  await sleep(900);
  const parsed = agentInviteSchema.safeParse({
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    region: formData.get('region') || undefined,
  });
  if (!parsed.success) return fail(parsed.error);
  revalidatePath('/console/agents');
  return { ok: true };
}

export async function importAgentsAction(rows: unknown[]): Promise<ActionResult> {
  if (!(await guard(['admin']))) return NOT_AUTHORIZED;
  await sleep(1000);
  revalidatePath('/console/agents');
  return { ok: true, data: summarize(rows, agentImportRowSchema) };
}

// ---------- Internal staff -----------------------------------------------

export async function inviteStaffAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard(['admin']))) return NOT_AUTHORIZED;
  await sleep(900);
  const parsed = staffInviteSchema.safeParse({
    first_name: formData.get('first_name'),
    middle_name: formData.get('middle_name') || undefined,
    last_name: formData.get('last_name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    department: formData.get('department'),
    job_title: formData.get('job_title'),
  });
  if (!parsed.success) return fail(parsed.error);
  revalidatePath('/console/staff');
  return { ok: true };
}

export async function importStaffAction(rows: unknown[]): Promise<ActionResult> {
  if (!(await guard(['admin']))) return NOT_AUTHORIZED;
  await sleep(1000);
  revalidatePath('/console/staff');
  return { ok: true, data: summarize(rows, staffImportRowSchema) };
}

// ---------- Customers ----------------------------------------------------

export async function onboardCustomerAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard(['admin', 'sales_agent']))) return NOT_AUTHORIZED;
  await sleep(1000);
  const parsed = customerOnboardSchema.safeParse({
    first_name: formData.get('first_name'),
    middle_name: formData.get('middle_name') || undefined,
    last_name: formData.get('last_name'),
    company_name: formData.get('company_name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    city: formData.get('city'),
    state: formData.get('state'),
    country: formData.get('country'),
  });
  if (!parsed.success) return fail(parsed.error);
  revalidatePath('/console/customers');
  return { ok: true };
}

export async function importCustomersAction(rows: unknown[]): Promise<ActionResult> {
  if (!(await guard(['admin', 'sales_agent']))) return NOT_AUTHORIZED;
  await sleep(1000);
  revalidatePath('/console/customers');
  return { ok: true, data: summarize(rows, customerImportRowSchema) };
}

export async function reviewCustomerAction(
  customerId: number,
  decision: 'approve' | 'reject',
): Promise<ActionResult> {
  if (!(await guard(['admin']))) return { ok: false, message: 'Only admins can review signups.' };
  await sleep(700);
  if (!Number.isFinite(customerId)) return { ok: false, message: 'Invalid customer.' };
  revalidatePath('/console/customers');
  return { ok: true, data: { customerId, decision } };
}

// ---------- Products (catalog) -------------------------------------------

function parseProductForm(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get('name'),
    sku: formData.get('sku'),
    description: formData.get('description'),
    price: formData.get('price'),
    category: formData.get('category'),
    manufacturer: formData.get('manufacturer'),
    form: formData.get('form'),
    strength: formData.get('strength'),
    pack_size: formData.get('pack_size'),
    prescription_required: formData.get('prescription_required') === 'on',
    image_url: formData.get('image_url'),
    status: formData.get('status') || undefined,
  });
}

export async function createProductAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard(['admin']))) return NOT_AUTHORIZED;
  await sleep(900);
  const parsed = parseProductForm(formData);
  if (!parsed.success) return fail(parsed.error);
  revalidatePath('/console/products');
  return { ok: true };
}

export async function updateProductAction(id: number, formData: FormData): Promise<ActionResult> {
  if (!(await guard(['admin']))) return NOT_AUTHORIZED;
  await sleep(900);
  if (!Number.isFinite(id)) return { ok: false, message: 'Invalid product.' };
  const parsed = parseProductForm(formData);
  if (!parsed.success) return fail(parsed.error);
  revalidatePath('/console/products');
  return { ok: true };
}

export async function importProductsAction(rows: unknown[]): Promise<ActionResult> {
  if (!(await guard(['admin']))) return NOT_AUTHORIZED;
  await sleep(1000);
  revalidatePath('/console/products');
  return { ok: true, data: summarize(rows, productImportRowSchema) };
}

// ---------- Inventory (stock) --------------------------------------------

export async function receiveStockAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard(['admin']))) return NOT_AUTHORIZED;
  await sleep(800);
  const parsed = batchReceiveSchema.safeParse({
    sku: formData.get('sku'),
    batch_no: formData.get('batch_no'),
    quantity: formData.get('quantity'),
    expiry_date: formData.get('expiry_date'),
  });
  if (!parsed.success) return fail(parsed.error);
  // Real impl: resolve product by SKU, append a batch, recompute totals.
  revalidatePath('/console/inventory');
  return { ok: true };
}

export async function importBatchesAction(rows: unknown[]): Promise<ActionResult> {
  if (!(await guard(['admin']))) return NOT_AUTHORIZED;
  await sleep(1000);
  revalidatePath('/console/inventory');
  return { ok: true, data: summarize(rows, batchImportRowSchema) };
}