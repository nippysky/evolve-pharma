import { NextRequest }    from 'next/server';
import { z }              from 'zod';
import { revalidateProducts } from '@/lib/revalidate';
import { db }             from '@/lib/db';
import { getSession }     from '@/lib/auth';
import { identityKey, findExistingByIdentity } from '@/lib/products/identity';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';
import { writeAuditLog }        from '@/lib/audit';
import { deleteFromCloudinary } from '@/lib/cloudinary';

const patchSchema = z.object({
  brand_name:          z.string().min(1).max(255).optional(),
  generic_name:        z.string().min(1).max(255).optional(),
  category_id:         z.number().int().positive().nullable().optional(),
  manufacturer_id:     z.number().int().positive().nullable().optional(),
  product_strength:    z.string().max(100).nullable().optional(),
  pack_size:           z.string().max(100).nullable().optional(),
  quantity_per_carton: z.number().int().positive().nullable().optional(),
  allow_unit_sale:     z.boolean().optional(),
  minimum_order:       z.number().int().positive().optional(),
  selling_price:       z.number().positive().optional(),
  last_cost_price:     z.number().positive().nullable().optional(),
  final_price:         z.number().positive().nullable().optional(),
  discount_percentage: z.number().min(0).max(100).nullable().optional(),
  minimum_stock_level: z.number().int().min(0).optional(),
  reorder_quantity:    z.number().int().min(0).optional(),
  shelf_location:      z.string().max(50).nullable().optional(),
  status:              z.enum(['ACTIVE', 'DRAFT', 'DISCONTINUED']).optional(),
});

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

    // Identity guard — editing is the third door into a duplicate.
    //
    // Creating and importing both refuse to make a second copy of a product,
    // but nothing stopped you *editing* one product's brand, strength or pack
    // size until it matched another. The SKU stays as it is either way (SKUs
    // are generated once, at creation, and never rewritten), so the collision
    // would be invisible in the catalogue's own identifiers.
    const touchesIdentity =
      parsed.data.brand_name       !== undefined ||
      parsed.data.product_strength !== undefined ||
      parsed.data.pack_size        !== undefined ||
      parsed.data.manufacturer_id  !== undefined;

    /** Set when the edit moves an identity field — used to rewrite the key. */
    let nextIdentity: {
      manufacturer: string | null;
      brand_name: string;
      product_strength: string | null;
      pack_size: string | null;
    } | null = null;

    if (touchesIdentity) {
      const manufacturerId = parsed.data.manufacturer_id !== undefined
        ? parsed.data.manufacturer_id
        : existing.manufacturer_id;

      let manufacturerName: string | null = null;
      if (manufacturerId) {
        const mfr = await db.manufacturer.findUnique({
          where:  { id: manufacturerId },
          select: { name: true },
        });
        manufacturerName = mfr?.name ?? null;
      }

      const next = {
        manufacturer:     manufacturerName,
        brand_name:       parsed.data.brand_name       ?? existing.brand_name,
        product_strength: parsed.data.product_strength !== undefined
          ? parsed.data.product_strength : existing.product_strength,
        pack_size:        parsed.data.pack_size        !== undefined
          ? parsed.data.pack_size : existing.pack_size,
      };

      nextIdentity = next;

      const clash = (await findExistingByIdentity([next])).get(identityKey(next));
      // A product always matches itself — only a *different* row is a conflict.
      if (clash && clash.id !== existing.id) {
        return apiError(
          `Those details belong to another product already in the catalogue (${clash.sku}).`,
          409,
          { brand_name: ['A product with this manufacturer, brand, strength and pack size already exists.'] },
        );
      }
    }

    // Price guard — a product cannot go ACTIVE without a real selling price.
    // Quick-added products sit at 0 until priced; publishing one would put it
    // in the catalogue orderable at zero. Mirrors the bulk-publish guard.
    if (parsed.data.status === 'ACTIVE') {
      const effectivePrice = parsed.data.selling_price ?? Number(existing.selling_price);
      if (!effectivePrice || effectivePrice <= 0) {
        return apiError(
          'Set a selling price before activating this product.',
          422,
          { selling_price: ['A selling price greater than zero is required to publish.'] },
        );
      }
    }

    const updated = await db.product.update({
      where: { id: existing.id },
      data: {
        ...parsed.data,
        // Recomputed whenever an identity field moves, so the stored key never
        // drifts from the columns it describes — a stale key would let the
        // next import create a duplicate of this very product.
        ...(nextIdentity ? { identity_key: identityKey(nextIdentity) } : {}),
        updated_by_id: session.userId,
      },
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

    revalidateProducts(sku);

    return apiSuccess({ product: { id: updated.id, sku: updated.sku } }, 200, 'Product updated successfully');
  } catch (err) {
    console.error('[PATCH /api/products/[sku]]', err);
    return apiInternalError();
  }
}
//
//   1. StockMovements → hard-deleted (references product_id + batch_id)
//   2. InventoryBatches → hard-deleted (references product_id)
//   4. Product → soft-deleted (deleted_at set; preserves FK targets for OrderItems)
//
//   OrderItems are intentionally untouched — order history must remain intact.
//
// Only ADMIN can delete products.

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'ADMIN') return apiForbidden();

    const { sku } = await params;

    // Load product + images in one query; count order items for the response
    const [product, orderItemCount] = await Promise.all([
      db.product.findFirst({
        where:   { sku, deleted_at: null },
        include: { images: { select: { id: true, cloudinary_public_id: true } } },
      }),
      db.orderItem.count({ where: { product: { sku } } }),
    ]);

    if (!product) return apiNotFound('Product');

    // 1. Hard-delete stock movements for this product
    const { count: movementsDeleted } = await db.stockMovement.deleteMany({
      where: { product_id: product.id },
    });

    // 2. Hard-delete inventory batches
    const { count: batchesDeleted } = await db.inventoryBatch.deleteMany({
      where: { product_id: product.id },
    });

    if (product.images.length > 0) {
      await db.productImage.deleteMany({ where: { product_id: product.id } });

      void Promise.allSettled(
        product.images.map(img =>
          deleteFromCloudinary(img.cloudinary_public_id, 'image').catch(e =>
            console.warn('[cloudinary delete warn]', img.cloudinary_public_id, e),
          ),
        ),
      );
    }

    // 4. Soft-delete the product (preserves FK target for any order items).
    //    Mangle the SKU so the unique constraint slot is freed — re-adding the
    //    same drug name/manufacturer via bulk import or manual form will work.
    await db.product.update({
      where: { id: product.id },
      data:  {
        sku:           `${product.sku}__DEL_${product.id}`,
        // Cleared for the same reason the SKU is mangled. MySQL's unique index
        // covers deleted rows too, so a soft-deleted product would otherwise
        // keep occupying its identity and block the drug being re-added.
        // Multiple NULLs are permitted in a MySQL unique index; multiple equal
        // values are not.
        identity_key:  null,
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
      description: `Deleted "${product.brand_name}" (${product.sku}) — ${product.images.length} images, ${batchesDeleted} batches, ${movementsDeleted} stock movements removed`,
      req,
    });

    revalidateProducts(sku);

    return apiSuccess(
      {
        deleted:           true,
        images_removed:    product.images.length,
        batches_deleted:   batchesDeleted,
        movements_deleted: movementsDeleted,
        has_order_history: orderItemCount > 0,
      },
      200,
      `"${product.brand_name}" and all associated data deleted.`,
    );
  } catch (err) {
    console.error('[DELETE /api/products/[sku]]', err);
    return apiInternalError();
  }
}
