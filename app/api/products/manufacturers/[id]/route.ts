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
  name: z.string().min(1, 'Manufacturer name is required').max(255, 'Name is too long'),
});

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    // Catalogue writes are ADMIN-only (client decision, Aug 2026). Reps read
    // the catalogue all day while a pharmacy is on the phone, but they no
    // longer shape it. Every GET on this route stays open to STAFF.
    if (session.role !== 'ADMIN') {
      return apiForbidden('Only an administrator can rename a manufacturer.');
    }

    const { id } = await params;
    const mfrId  = parseInt(id, 10);
    if (isNaN(mfrId)) return apiError('Invalid manufacturer ID', 400);

    const existing = await db.manufacturer.findUnique({ where: { id: mfrId } });
    if (!existing) return apiNotFound('Manufacturer');

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = renameSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid name', 422);
    }

    const { name } = parsed.data;

    const nameTaken = await db.manufacturer.findFirst({
      where: { name, id: { not: mfrId } },
    });
    if (nameTaken) return apiError('A manufacturer with this name already exists.', 409);

    const manufacturer = await db.manufacturer.update({
      where:   { id: mfrId },
      data:    { name },
      include: { _count: { select: { products: true } } },
    });

    revalidateProducts();
    return apiSuccess({
      manufacturer: {
        id:            manufacturer.id,
        name:          manufacturer.name,
        product_count: manufacturer._count.products,
        created_at:    manufacturer.created_at,
      },
    }, 200, 'Manufacturer renamed successfully');
  } catch (err) {
    console.error('[PATCH /api/products/manufacturers/[id]]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'ADMIN') return apiForbidden();

    const { id } = await params;
    const mfrId  = parseInt(id, 10);
    if (isNaN(mfrId)) return apiError('Invalid manufacturer ID', 400);

    const existing = await db.manufacturer.findUnique({
      where:   { id: mfrId },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) return apiNotFound('Manufacturer');

    await db.manufacturer.delete({ where: { id: mfrId } });

    revalidateProducts();
    return apiSuccess(
      { deleted: true, affected_products: existing._count.products },
      200,
      `Manufacturer deleted. ${existing._count.products} product(s) are now unassigned.`,
    );
  } catch (err) {
    console.error('[DELETE /api/products/manufacturers/[id]]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
