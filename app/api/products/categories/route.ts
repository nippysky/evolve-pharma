/**
 * GET  /api/products/categories — list all categories
 * POST /api/products/categories — create category (Admin/Staff)
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
  apiInternalError,
} from '@/lib/api/response';

const createSchema = z.object({
  name: z.string().min(1).max(150),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();

    const categories = await db.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: { deleted_at: null } } } } },
    });

    return apiSuccess({
      categories: categories.map(c => ({
        id:            c.id,
        name:          c.name,
        product_count: c._count.products,
        created_at:    c.created_at,
      })),
    });
  } catch (err) {
    console.error('[GET /api/products/categories]', err);
    return apiInternalError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const [field, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        errors[field] = msgs as string[];
      }
      return apiError('Please review the fields below.', 422, errors);
    }

    const existing = await db.category.findUnique({ where: { name: parsed.data.name } });
    if (existing) return apiError('A category with this name already exists.', 409);

    const category = await db.category.create({ data: { name: parsed.data.name } });
    return apiSuccess({ category }, 201, 'Category created successfully');
  } catch (err) {
    console.error('[POST /api/products/categories]', err);
    return apiInternalError();
  }
}
