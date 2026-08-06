import { NextRequest }             from 'next/server';
import { db }                      from '@/lib/db';
import { getSession }              from '@/lib/auth';
import { deleteFromCloudinary }    from '@/lib/cloudinary';
import { revalidateProducts }      from '@/lib/revalidate';
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';

type RouteContext = { params: Promise<{ sku: string; imageId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const { sku, imageId } = await params;
    const imageIdNum       = parseInt(imageId, 10);

    const product = await db.product.findFirst({ where: { sku, deleted_at: null } });
    if (!product) return apiNotFound('Product');

    const image = await db.productImage.findFirst({
      where: { id: imageIdNum, product_id: product.id },
    });
    if (!image) return apiNotFound('Image');

    // Clear existing primary, set new one
    await db.$transaction([
      db.productImage.updateMany({
        where: { product_id: product.id, is_primary: true },
        data:  { is_primary: false },
      }),
      db.productImage.update({
        where: { id: imageIdNum },
        data:  { is_primary: true },
      }),
    ]);

    const allImages = await db.productImage.findMany({
      where:   { product_id: product.id },
      orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
    });

    revalidateProducts(sku);
    return apiSuccess({ images: allImages }, 200, 'Primary image updated');
  } catch (err) {
    console.error('[PATCH /api/products/[sku]/images/[imageId]]', err);
    return apiInternalError();
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const { sku, imageId } = await params;
    const imageIdNum       = parseInt(imageId, 10);

    const product = await db.product.findFirst({ where: { sku, deleted_at: null } });
    if (!product) return apiNotFound('Product');

    const image = await db.productImage.findFirst({
      where: { id: imageIdNum, product_id: product.id },
    });
    if (!image) return apiNotFound('Image');

    const wasPrimary = image.is_primary;

    // Delete from DB first
    await db.productImage.delete({ where: { id: imageIdNum } });

    // If was primary, promote the next oldest
    if (wasPrimary) {
      const next = await db.productImage.findFirst({
        where:   { product_id: product.id },
        orderBy: { created_at: 'asc' },
      });
      if (next) {
        await db.productImage.update({ where: { id: next.id }, data: { is_primary: true } });
      }
    }

    // Delete from Cloudinary (non-blocking — don't fail the request if this errors)
    void deleteFromCloudinary(image.cloudinary_public_id, 'image').catch(e =>
      console.warn('[cloudinary delete warn]', e),
    );

    const allImages = await db.productImage.findMany({
      where:   { product_id: product.id },
      orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
    });

    revalidateProducts(sku);
    return apiSuccess({ images: allImages, deleted: true }, 200, 'Image deleted');
  } catch (err) {
    console.error('[DELETE /api/products/[sku]/images/[imageId]]', err);
    return apiInternalError();
  }
}
