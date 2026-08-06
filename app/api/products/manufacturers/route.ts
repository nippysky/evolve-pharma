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
  apiInternalError,
} from '@/lib/api/response';

const createSchema = z.object({
  name: z.string().min(1).max(255),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();

    const manufacturers = await db.manufacturer.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });

    return apiSuccess({
      manufacturers: manufacturers.map(m => ({
        id:            m.id,
        name:          m.name,
        product_count: m._count.products,
        created_at:    m.created_at,
      })),
    });
  } catch (err) {
    console.error('[GET /api/products/manufacturers]', err);
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

    const existing = await db.manufacturer.findUnique({ where: { name: parsed.data.name } });
    if (existing) return apiError('A manufacturer with this name already exists.', 409);

    const manufacturer = await db.manufacturer.create({ data: { name: parsed.data.name } });
    revalidateProducts();
    return apiSuccess({ manufacturer }, 201, 'Manufacturer created successfully');
  } catch (err) {
    console.error('[POST /api/products/manufacturers]', err);
    return apiInternalError();
  }
}
