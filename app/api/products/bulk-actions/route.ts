import { NextRequest }          from 'next/server';
import { z }                    from 'zod';
import { revalidateProducts }   from '@/lib/revalidate';
import { db }                   from '@/lib/db';
import { getSession }           from '@/lib/auth';
import { deleteFromCloudinary } from '@/lib/cloudinary';
import { writeAuditLog }        from '@/lib/audit';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
} from '@/lib/api/response';

const bodySchema = z.object({
  action: z.enum(['publish', 'delete']),
  skus:   z.array(z.string().min(1)).min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body.', 400); }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? 'Invalid request body.',
        400,
      );
    }

    const { action, skus } = parsed.data;

    // ── delete is ADMIN-only ─────────────────────────────────────────────────
    if (action === 'delete' && session.role !== 'ADMIN') return apiForbidden();

    // ── Normalise SKUs (uppercase, unique) ───────────────────────────────────
    const normalised = [...new Set(skus.map(s => s.toUpperCase()))];
    if (!normalised.length) return apiError('No valid SKUs provided.', 400);
    //  PUBLISH
    if (action === 'publish') {
      // Single updateMany — only affects DRAFT products; ACTIVE/DISCONTINUED
      // are silently skipped (counted as `skipped`).
      const result = await db.product.updateMany({
        where: {
          sku:        { in: normalised },
          status:     'DRAFT',
          deleted_at: null,
        },
        data: {
          status:        'ACTIVE',
          updated_by_id: session.userId,
        },
      });

      const published = result.count;
      const skipped   = normalised.length - published;

      void writeAuditLog({
        userId:      session.userId,
        userType:    session.role,
        userName:    `${session.first_name} ${session.last_name}`,
        email:       session.email,
        action:      'BULK_PUBLISH_PRODUCTS',
        entityType:  'Product',
        entityId:    normalised.join(','),
        description: `Bulk published ${published} product(s) (${skipped} skipped — already active or discontinued)`,
        req,
      });

      revalidateProducts();

      return apiSuccess(
        { action: 'publish', published, skipped },
        200,
        published === 0
          ? 'No DRAFT products found in the selection.'
          : `${published} product${published !== 1 ? 's' : ''} published successfully.`,
      );
    }
    //  DELETE

    // Load all matching products + their images (1 query)
    const products = await db.product.findMany({
      where: {
        sku:        { in: normalised },
        deleted_at: null,
      },
      select: {
        id:         true,
        sku:        true,
        brand_name: true,
        images:     { select: { id: true, cloudinary_public_id: true } },
      },
    });

    if (!products.length) return apiError('No matching products found.', 404);

    const productIds   = products.map(p => p.id);
    const allImages    = products.flatMap(p => p.images);
    const totalImages  = allImages.length;
    const deletedCount = products.length;
    const skippedCount = normalised.length - deletedCount;

    // Hard-delete stock movements (1 query) — must precede batch delete
    const { count: movementsDeleted } = await db.stockMovement.deleteMany({
      where: { product_id: { in: productIds } },
    });

    // Hard-delete inventory batches (1 query)
    const { count: batchesDeleted } = await db.inventoryBatch.deleteMany({
      where: { product_id: { in: productIds } },
    });

    // Hard-delete image DB records (1 query)
    if (totalImages > 0) {
      await db.productImage.deleteMany({
        where: { product_id: { in: productIds } },
      });
    }

    // Soft-delete all matched products one by one so we can mangle each SKU
    // (frees the unique slot so the same drug can be re-imported later).
    for (const p of products) {
      await db.product.update({
        where: { id: p.id },
        data:  {
          sku:           `${p.sku}__DEL_${p.id}`,
          deleted_at:    new Date(),
          deleted_by_id: session.userId,
          status:        'DISCONTINUED',
        },
      });
    }

    // Fire-and-forget: Cloudinary cleanup + audit log
    if (totalImages > 0) {
      void Promise.allSettled(
        allImages.map(img =>
          deleteFromCloudinary(img.cloudinary_public_id, 'image').catch(e =>
            console.warn('[bulk-delete cloudinary warn]', img.cloudinary_public_id, e),
          ),
        ),
      );
    }

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'BULK_DELETE_PRODUCTS',
      entityType:  'Product',
      entityId:    productIds.join(','),
      description: `Bulk deleted ${deletedCount} product(s) — ${totalImages} image(s), ${batchesDeleted} batch(es), ${movementsDeleted} stock movement(s) removed`,
      req,
    });

    return apiSuccess(
      {
        action:            'delete',
        deleted:           deletedCount,
        images_removed:    totalImages,
        batches_deleted:   batchesDeleted,
        movements_deleted: movementsDeleted,
        skipped:           skippedCount,
      },
      200,
      `${deletedCount} product${deletedCount !== 1 ? 's' : ''} and all associated data deleted.`,
    );
  } catch (err) {
    console.error('[POST /api/products/bulk-actions]', err);
    return apiInternalError();
  }
}
