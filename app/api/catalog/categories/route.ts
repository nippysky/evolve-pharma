import { NextRequest }  from 'next/server';
import { db }           from '@/lib/db';
import { apiSuccess, apiInternalError } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await db.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            products: {
              where: { status: 'ACTIVE', deleted_at: null },
            },
          },
        },
      },
    });

    const result = categories
      .filter(c => c._count.products > 0)
      .map(c => ({
        id:            c.id,
        name:          c.name,
        product_count: c._count.products,
      }));

    return apiSuccess({ categories: result }, 200, 'Categories retrieved successfully.');
  } catch (err) {
    console.error('[GET /api/catalog/categories]', err);
    return apiInternalError();
  }
}
