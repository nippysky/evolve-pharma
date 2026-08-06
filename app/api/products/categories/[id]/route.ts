import { NextRequest }          from 'next/server';
import { z }                    from 'zod';
import { db }                   from '@/lib/db';
import { getSession }           from '@/lib/auth';
import { revalidateProducts }   from '@/lib/revalidate';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
  handlePrismaError,
} from '@/lib/api/response';

type RouteContext = { params: Promise<{ id: string }> };

const renameSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(150, 'Name is too long'),
});

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const { id } = await params;
    const catId  = parseInt(id, 10);
    if (isNaN(catId)) return apiError('Invalid category ID', 400);

    const existing = await db.category.findUnique({ where: { id: catId } });
    if (!existing) return apiNotFound('Category');

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = renameSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid name', 422);
    }

    const { name } = parsed.data;

    const nameTaken = await db.category.findFirst({
      where: { name, id: { not: catId } },
    });
    if (nameTaken) return apiError('A category with this name already exists.', 409);

    const category = await db.category.update({
      where: { id: catId },
      data:  { name },
      include: { _count: { select: { products: true } } },
    });

    revalidateProducts();
    return apiSuccess({
      category: {
        id:            category.id,
        name:          category.name,
        product_count: category._count.products,
        created_at:    category.created_at,
      },
    }, 200, 'Category renamed successfully');
  } catch (err) {
    console.error('[PATCH /api/products/categories/[id]]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'ADMIN') return apiForbidden();

    const { id } = await params;
    const catId  = parseInt(id, 10);
    if (isNaN(catId)) return apiError('Invalid category ID', 400);

    const existing = await db.category.findUnique({
      where:   { id: catId },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) return apiNotFound('Category');

    await db.category.delete({ where: { id: catId } });

    revalidateProducts();
    return apiSuccess(
      { deleted: true, affected_products: existing._count.products },
      200,
      `Category deleted. ${existing._count.products} product(s) are now uncategorised.`,
    );
  } catch (err) {
    console.error('[DELETE /api/products/categories/[id]]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
