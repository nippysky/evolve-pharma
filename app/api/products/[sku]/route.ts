/**
 * GET    /api/products/[sku] — single product detail
 * PATCH  /api/products/[sku] — partial update
 * DELETE /api/products/[sku] — soft delete
 */

import { NextRequest } from 'next/server';
import { z }           from 'zod';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';
import { writeAuditLog } from '@/lib/audit';

// ─── Validation ───────────────────────────────────────────────────────────────

const patchSchema = z.object({
  brand_name:          z.string().min(1).max(255).optional(),
  generic_name:        z.string().min(1).max(255).optional(),
  category_id:         z.number().int().positive().nullable().optional(),
  manufacturer_id:     z.number().int().positive().nullable().optional(),
  product_strength:    z.string().max(100).nullable().optional(),
  pack_size:           z.string().max(100).nullable().optional(),
  quantity_per_carton: z.number().int().positive().nullable().optional(),
  description:         z.string().nullable().optional(),
  allow_unit_sale:     z.boolean().optional(),
  minimum_order:       z.number().int().positive().optional(),
  selling_price:       z.number().positive().optional(),
  last_cost_price:     z.number().positive().nullable().optional(),
  final_price:         z.number().positive().nullable().optional(),
  discount_percentage: z.number().min(0).max(100).nullable().optional(),
  minimum_stock_level: z.number().int().min(0).optional(),
  reorder_quantity:    z.number().int().min(0).optional(),
  status:              z.enum(['ACTIVE', 'DRAFT', 'DISCONTINUED']).optional(),
});

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const { sku } = await params;

    const product = await db.product.findFirst({
      where:   { sku, deleted_at: null },
      include: {
        category:     true,
        manufacturer: true,
        images:       { orderBy: { is_primary: 'desc' } },
        inventoryBatches: {
          orderBy: { received_at: 'desc' },
          take:    10,
        },
      },
    });

    if (!product) return apiNotFound('Product');

    const totalStock = product.inventoryBatches.reduce((s, b) => s + b.quantity, 0);

    return apiSuccess({
      product: {
        ...product,
        selling_price:       Number(product.selling_price),
        last_cost_price:     product.last_cost_price ? Number(product.last_cost_price) : null,
        final_price:         product.final_price      ? Number(product.final_price)      : null,
        discount_percentage: product.discount_percentage ? Number(product.discount_percentage) : null,
        total_stock:         totalStock,
        inventoryBatches:    product.inventoryBatches.map(b => ({
          ...b,
          cost_price: Number(b.cost_price),
        })),
      },
    });
  } catch (err) {
    console.error('[GET /api/products/[sku]]', err);
    return apiInternalError();
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const { sku } = await params;

    const existing = await db.product.findFirst({ where: { sku, deleted_at: null } });
    if (!existing) return apiNotFound('Product');

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const [field, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        errors[field] = msgs as string[];
      }
      return apiError('Please review the fields below.', 422, errors);
    }

    const updated = await db.product.update({
      where: { id: existing.id },
      data:  { ...parsed.data, updated_by_id: session.userId },
    });

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'UPDATE_PRODUCT',
      entityType:  'Product',
      entityId:    String(updated.id),
      description: `Updated product ${updated.brand_name} (${updated.sku})`,
      req,
    });

    return apiSuccess({ product: { id: updated.id, sku: updated.sku } }, 200, 'Product updated successfully');
  } catch (err) {
    console.error('[PATCH /api/products/[sku]]', err);
    return apiInternalError();
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'ADMIN') return apiForbidden();

    const { sku } = await params;

    const product = await db.product.findFirst({ where: { sku, deleted_at: null } });
    if (!product) return apiNotFound('Product');

    await db.product.update({
      where: { id: product.id },
      data:  {
        deleted_at:    new Date(),
        deleted_by_id: session.userId,
        status:        'DISCONTINUED',
      },
    });

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'DELETE_PRODUCT',
      entityType:  'Product',
      entityId:    String(product.id),
      description: `Soft-deleted product ${product.brand_name} (${product.sku})`,
      req,
    });

    return apiSuccess({ deleted: true }, 200, 'Product deleted successfully');
  } catch (err) {
    console.error('[DELETE /api/products/[sku]]', err);
    return apiInternalError();
  }
}
