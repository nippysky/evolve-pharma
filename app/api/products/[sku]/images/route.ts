import { NextRequest }          from 'next/server';
import { db }                   from '@/lib/db';
import { getSession }           from '@/lib/auth';
import { uploadToCloudinary }   from '@/lib/cloudinary';
import { revalidateProducts }   from '@/lib/revalidate';
import { writeAuditLog }        from '@/lib/audit';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';

const MAX_IMAGES_PER_PRODUCT = 6;
const MAX_IMAGE_BYTES        = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME           = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const { sku } = await params;
    const product = await db.product.findFirst({ where: { sku, deleted_at: null } });
    if (!product) return apiNotFound('Product');

    const images = await db.productImage.findMany({
      where:   { product_id: product.id },
      orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
    });

    return apiSuccess({ images });
  } catch (err) {
    console.error('[GET /api/products/[sku]/images]', err);
    return apiInternalError();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const { sku } = await params;
    const product = await db.product.findFirst({ where: { sku, deleted_at: null } });
    if (!product) return apiNotFound('Product');

    // Check current image count
    const existingCount = await db.productImage.count({ where: { product_id: product.id } });
    if (existingCount >= MAX_IMAGES_PER_PRODUCT) {
      return apiError(
        `This product already has ${MAX_IMAGES_PER_PRODUCT} images. Delete one first.`,
        422,
      );
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) return apiError('Multipart form data required', 400);

    // Collect all uploaded files
    const files: File[] = [];
    for (const [key, val] of formData.entries()) {
      if ((key === 'file' || key === 'files[]' || key.startsWith('file')) && val instanceof File) {
        files.push(val);
      }
    }

    if (files.length === 0) return apiError('No image files provided', 400);

    const slots = MAX_IMAGES_PER_PRODUCT - existingCount;
    if (files.length > slots) {
      return apiError(
        `You can upload at most ${slots} more image(s) — this product already has ${existingCount}.`,
        422,
      );
    }

    // Validate each file
    const validationErrors: string[] = [];
    files.forEach((f, i) => {
      if (!ALLOWED_MIME.has(f.type)) {
        validationErrors.push(`File ${i + 1}: only JPEG, PNG, WEBP images are accepted`);
      }
      if (f.size > MAX_IMAGE_BYTES) {
        validationErrors.push(`File ${i + 1}: exceeds 8 MB limit`);
      }
    });
    if (validationErrors.length) {
      return apiError(validationErrors.join('. '), 422);
    }

    const setPrimaryIdx = parseInt(formData.get('set_primary') as string ?? '-1', 10);
    const hasPrimary    = await db.productImage.findFirst({
      where: { product_id: product.id, is_primary: true },
    });

    // Determine which upload index should be primary — exactly one.
    // If caller requested a specific index, use that.
    // If no existing primary and no explicit request, auto-promote index 0.
    const explicitSet = setPrimaryIdx >= 0 && setPrimaryIdx < files.length;
    const primaryIdx  = explicitSet ? setPrimaryIdx : (!hasPrimary ? 0 : -1);

    // If we're changing the primary, clear existing ones first
    if (primaryIdx >= 0) {
      await db.productImage.updateMany({
        where: { product_id: product.id, is_primary: true },
        data:  { is_primary: false },
      });
    }

    // Upload all files to Cloudinary in parallel
    const uploads = await Promise.all(
      files.map(async (file, idx) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await uploadToCloudinary(buffer, 'evolve/products', {
          resourceType: 'image',
        });
        return { ...result, isPrimary: idx === primaryIdx };
      }),
    );

    // Persist image records
    const created = await db.$transaction(
      uploads.map(u =>
        db.productImage.create({
          data: {
            product_id:           product.id,
            cloudinary_public_id: u.publicId,
            url:                  u.url,
            is_primary:           u.isPrimary,
          },
        }),
      ),
    );

    // Re-fetch all images to return canonical ordered list
    const allImages = await db.productImage.findMany({
      where:   { product_id: product.id },
      orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
    });

    revalidateProducts(sku);
    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'UPLOAD_PRODUCT_IMAGES',
      entityType:  'Product',
      entityId:    sku,
      description: `Uploaded ${created.length} image(s) to product ${sku}.`,
      req,
    });

    return apiSuccess({ images: allImages, uploaded: created.length }, 201, 'Images uploaded successfully');
  } catch (err) {
    console.error('[POST /api/products/[sku]/images]', err);
    return apiInternalError();
  }
}
