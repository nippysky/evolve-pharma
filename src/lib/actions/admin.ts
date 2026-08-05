'use server';

import { revalidatePath } from 'next/cache';
import { cookies, headers }              from 'next/headers';
import { db }                            from '@/lib/db';
import { getSession }                    from '@/lib/auth';
import { hasPermission }                 from '@/types';
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
import type { ActionResult } from '@/lib/actions';
import type { Role, SessionUser } from '@/types';

const NOT_AUTHORIZED: ActionResult = { ok: false, message: 'You are not authorized to do this.' };

function fail(err: unknown, fallback = 'Something went wrong. Please try again.'): ActionResult {
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

/**
 * Fire a fetch to an internal Next.js API route, forwarding the session cookies.
 * Uses request headers to derive the correct protocol + host (works on Vercel too).
 */
async function internalFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const h     = await headers();
  const proto = h.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const host  = h.get('host') ?? 'localhost:3000';

  const jar          = await cookies();
  const cookieHeader = jar.toString();

  const res = await fetch(`${proto}://${host}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Cookie: cookieHeader,
    },
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

function fromApiResult(result: Awaited<ReturnType<typeof internalFetch>>): ActionResult {
  if (result.ok) return { ok: true };
  const message     = (result.json?.message as string | undefined)
    ?? 'Something went wrong. Please try again.';
  const fieldErrors = result.json?.errors as Record<string, string[]> | undefined;
  return { ok: false, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

export async function inviteAgentAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard(['ADMIN']))) return NOT_AUTHORIZED;

  const parsed = agentInviteSchema.safeParse({
    first_name: formData.get('first_name'),
    last_name:  formData.get('last_name'),
    email:      formData.get('email'),
    phone:      formData.get('phone'),
    region:     formData.get('region') || undefined,
  });
  if (!parsed.success) return fail(parsed.error);

  const result = await internalFetch('/api/staff', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...parsed.data, role: 'STAFF' }),
  });

  if (!result.ok) return fromApiResult(result);

  revalidatePath('/admin/staff');
  return { ok: true };
}

export async function importAgentsAction(rows: unknown[]): Promise<ActionResult> {
  if (!(await guard(['ADMIN']))) return NOT_AUTHORIZED;
  // Validate rows client-side — no batch endpoint yet.
  revalidatePath('/admin/staff');
  return { ok: true, data: summarize(rows, agentImportRowSchema) };
}

export async function inviteStaffAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard(['ADMIN']))) return NOT_AUTHORIZED;

  const parsed = staffInviteSchema.safeParse({
    first_name:  formData.get('first_name'),
    middle_name: formData.get('middle_name') || undefined,
    last_name:   formData.get('last_name'),
    email:       formData.get('email'),
    phone:       formData.get('phone'),
    department:  formData.get('department'),
    job_title:   formData.get('job_title'),
  });
  if (!parsed.success) return fail(parsed.error);

  const result = await internalFetch('/api/staff', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...parsed.data, role: 'STAFF' }),
  });

  if (!result.ok) return fromApiResult(result);

  revalidatePath('/admin/staff');
  return { ok: true };
}

export async function importStaffAction(rows: unknown[]): Promise<ActionResult> {
  if (!(await guard(['ADMIN']))) return NOT_AUTHORIZED;
  // Validate rows client-side — bulk-upload endpoint expects a File, not parsed rows.
  revalidatePath('/admin/staff');
  return { ok: true, data: summarize(rows, staffImportRowSchema) };
}

export async function inviteDriverAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard(['ADMIN', 'STAFF']))) return NOT_AUTHORIZED;

  const firstName    = (formData.get('first_name')    as string | null)?.trim();
  const lastName     = (formData.get('last_name')     as string | null)?.trim();
  const email        = (formData.get('email')         as string | null)?.trim().toLowerCase();
  const phone        = (formData.get('phone')         as string | null)?.trim();
  const vehiclePlate = (formData.get('vehicle_plate') as string | null)?.trim();
  const vehicleType  = (formData.get('vehicle_type')  as string | null)?.trim();
  const region       = (formData.get('region')        as string | null)?.trim();

  if (!firstName || !lastName || !email || !phone) {
    return { ok: false, message: 'First name, last name, email, and phone are required.' };
  }

  const result = await internalFetch('/api/staff', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      first_name:    firstName,
      last_name:     lastName,
      email,
      phone,
      role:          'DRIVER',
      vehicle_plate: vehiclePlate,
      vehicle_type:  vehicleType,
      region,
    }),
  });

  if (!result.ok) return fromApiResult(result);

  revalidatePath('/admin/drivers');
  return { ok: true };
}

export async function onboardCustomerAction(formData: FormData): Promise<ActionResult> {
  const session = await guard(['ADMIN', 'STAFF']);
  if (!session) return NOT_AUTHORIZED;

  const parsed = customerOnboardSchema.safeParse({
    first_name:   formData.get('first_name'),
    middle_name:  formData.get('middle_name') || undefined,
    last_name:    formData.get('last_name'),
    company_name: formData.get('company_name'),
    email:        formData.get('email'),
    phone:        formData.get('phone'),
    address:      formData.get('address'),
    city:         formData.get('city'),
    state:        formData.get('state'),
    country:      formData.get('country'),
  });
  if (!parsed.success) return fail(parsed.error);

  const { first_name, middle_name, last_name, company_name, email, phone, address, city, state } =
    parsed.data;

  try {
    // Check email uniqueness
    const existing = await db.user.findUnique({
      where:  { email: email.toLowerCase() },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, message: 'An account with this email already exists.' };
    }

    const referralCode = 'ENV' + Math.random().toString(36).substring(2, 10).toUpperCase();

    await db.$transaction(async (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => {
      const u = await tx.user.create({
        data: {
          first_name,
          middle_name: middle_name ?? null,
          last_name,
          email:         email.toLowerCase(),
          phone:         phone ?? null,
          password_hash: 'UNSET',
          role:          'CUSTOMER',
          status:        'INACTIVE',
        },
      });
      await tx.customer.create({
        data: {
          user_id:       u.id,
          company_name:  company_name ?? null,
          address:       address ?? null,
          city:          city ?? null,
          state:         state ?? null,
          referral_code: referralCode,
          // Admin-created accounts skip PCN upload — mark as pending review
          status:        'PENDING_REVIEW',
        },
      });
    });

    revalidatePath('/admin/customers');
    return { ok: true };
  } catch (err) {
    console.error('[onboardCustomerAction]', err);
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'P2002') return { ok: false, message: 'An account with this email already exists.' };
    }
    return { ok: false, message: 'Failed to create customer account. Please try again.' };
  }
}

export async function importCustomersAction(rows: unknown[]): Promise<ActionResult> {
  if (!(await guard(['ADMIN', 'STAFF']))) return NOT_AUTHORIZED;
  revalidatePath('/admin/customers');
  return { ok: true, data: summarize(rows, customerImportRowSchema) };
}

export async function reviewCustomerAction(
  customerId: number,
  decision:   'approve' | 'reject',
  reviewNote?: string,
): Promise<ActionResult> {
  if (!(await guard(['ADMIN']))) return { ok: false, message: 'Only admins can review signups.' };
  if (!Number.isFinite(customerId)) return { ok: false, message: 'Invalid customer ID.' };

  const result = await internalFetch(`/api/customers/${customerId}/review`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ decision, review_note: reviewNote }),
  });

  if (!result.ok) return fromApiResult(result);

  revalidatePath('/admin/customers');
  return { ok: true };
}

function parseProductForm(formData: FormData) {
  return productSchema.safeParse({
    name:                  formData.get('name'),
    generic_name:          formData.get('generic_name'),
    sku:                   formData.get('sku'),
    cost_price:            formData.get('cost_price'),
    selling_price:         formData.get('selling_price'),
    category:              formData.get('category'),
    manufacturer:          formData.get('manufacturer'),
    form:                  formData.get('form'),
    strength:              formData.get('strength'),
    pack_size:             formData.get('pack_size'),
    shelf_location:        formData.get('shelf_location')   || undefined,
    min_stock_level:       formData.get('min_stock_level')  || undefined,
    reorder_qty:           formData.get('reorder_qty')      || undefined,
    prescription_required: formData.get('prescription_required') === 'on',
    image_url:             formData.get('image_url'),
    status:                formData.get('status')           || undefined,
  });
}

export async function createProductAction(formData: FormData): Promise<ActionResult> {
  const session = await guard(['ADMIN', 'STAFF']);
  if (!session || !hasPermission(session, 'manage_products')) return NOT_AUTHORIZED;

  const parsed = parseProductForm(formData);
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;

  try {
    // Resolve or create category by name
    let categoryId: number | undefined;
    if (d.category) {
      let cat = await db.category.findFirst({ where: { name: d.category } });
      if (!cat) cat = await db.category.create({ data: { name: d.category } });
      categoryId = cat.id;
    }

    // Resolve or create manufacturer by name
    let manufacturerId: number | undefined;
    if (d.manufacturer) {
      let mfr = await db.manufacturer.findFirst({ where: { name: d.manufacturer } });
      if (!mfr) mfr = await db.manufacturer.create({ data: { name: d.manufacturer } });
      manufacturerId = mfr.id;
    }

    await db.product.create({
      data: {
        sku:                 d.sku,
        brand_name:          d.name,
        generic_name:        d.generic_name,
        category_id:         categoryId,
        manufacturer_id:     manufacturerId,
        product_strength:    [d.strength, d.form].filter(Boolean).join(' ') || null,
        pack_size:           d.pack_size,
        selling_price:       d.selling_price,
        last_cost_price:     d.cost_price,
        minimum_stock_level: d.min_stock_level ?? 0,
        reorder_quantity:    d.reorder_qty ?? 0,
        status:              (d.status ?? 'draft').toUpperCase() as 'ACTIVE' | 'DRAFT' | 'DISCONTINUED',
        created_by_id:       session.userId,
        updated_by_id:       session.userId,
      },
    });

    revalidatePath('/admin/products');
    revalidatePath('/admin/products');
    return { ok: true };
  } catch (err) {
    console.error('[createProductAction]', err);
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'P2002') return { ok: false, message: 'A product with this SKU already exists. Choose a unique SKU.' };
    }
    return { ok: false, message: 'Failed to create product. Please try again.' };
  }
}

export async function updateProductAction(id: number, formData: FormData): Promise<ActionResult> {
  const session = await guard(['ADMIN', 'STAFF']);
  if (!session || !hasPermission(session, 'manage_products')) return NOT_AUTHORIZED;
  if (!Number.isFinite(id)) return { ok: false, message: 'Invalid product ID.' };

  const parsed = parseProductForm(formData);
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;

  try {
    let categoryId: number | undefined;
    if (d.category) {
      let cat = await db.category.findFirst({ where: { name: d.category } });
      if (!cat) cat = await db.category.create({ data: { name: d.category } });
      categoryId = cat.id;
    }

    let manufacturerId: number | undefined;
    if (d.manufacturer) {
      let mfr = await db.manufacturer.findFirst({ where: { name: d.manufacturer } });
      if (!mfr) mfr = await db.manufacturer.create({ data: { name: d.manufacturer } });
      manufacturerId = mfr.id;
    }

    await db.product.update({
      where: { id },
      data: {
        brand_name:          d.name,
        generic_name:        d.generic_name,
        category_id:         categoryId,
        manufacturer_id:     manufacturerId,
        product_strength:    [d.strength, d.form].filter(Boolean).join(' ') || null,
        pack_size:           d.pack_size,
        selling_price:       d.selling_price,
        last_cost_price:     d.cost_price,
        minimum_stock_level: d.min_stock_level ?? 0,
        reorder_quantity:    d.reorder_qty ?? 0,
        status:              (d.status ?? 'draft').toUpperCase() as 'ACTIVE' | 'DRAFT' | 'DISCONTINUED',
        updated_by_id:       session.userId,
      },
    });

    revalidatePath('/admin/products');
    revalidatePath('/admin/products');
    return { ok: true };
  } catch (err) {
    console.error('[updateProductAction]', err);
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'P2025') return { ok: false, message: 'Product not found — it may have been deleted.' };
      if (code === 'P2002') return { ok: false, message: 'A product with this SKU already exists.' };
    }
    return { ok: false, message: 'Failed to update product. Please try again.' };
  }
}

export async function importProductsAction(rows: unknown[]): Promise<ActionResult> {
  const session = await guard(['ADMIN', 'STAFF']);
  if (!session || !hasPermission(session, 'manage_products')) return NOT_AUTHORIZED;
  // Bulk import uses the /api/products/bulk-import File endpoint from the UI — not this action.
  revalidatePath('/admin/products');
  return { ok: true, data: summarize(rows, productImportRowSchema) };
}

export async function receiveStockAction(formData: FormData): Promise<ActionResult> {
  const session = await guard(['ADMIN', 'STAFF']);
  if (!session || !hasPermission(session, 'manage_inventory')) return NOT_AUTHORIZED;

  const parsed = batchReceiveSchema.safeParse({
    sku:         formData.get('sku'),
    batch_no:    formData.get('batch_no'),
    quantity:    formData.get('quantity'),
    expiry_date: formData.get('expiry_date'),
  });
  if (!parsed.success) return fail(parsed.error);
  const { sku, batch_no, quantity, expiry_date } = parsed.data;

  // Resolve product by SKU
  const product = await db.product.findUnique({
    where:  { sku },
    select: { id: true, last_cost_price: true },
  });
  if (!product) {
    return { ok: false, message: `No product found with SKU "${sku}". Please check and try again.` };
  }

  const result = await internalFetch('/api/inventory/receive', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      product_id:   product.id,
      batch_number: batch_no,
      quantity,
      cost_price:   product.last_cost_price ? Number(product.last_cost_price) : 0,
      expiry_date,
    }),
  });

  if (!result.ok) return fromApiResult(result);

  revalidatePath('/admin/inventory');
  return { ok: true };
}

export async function importBatchesAction(rows: unknown[]): Promise<ActionResult> {
  const session = await guard(['ADMIN', 'STAFF']);
  if (!session || !hasPermission(session, 'manage_inventory')) return NOT_AUTHORIZED;
  revalidatePath('/admin/inventory');
  return { ok: true, data: summarize(rows, batchImportRowSchema) };
}
