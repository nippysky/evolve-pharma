import { NextRequest }   from 'next/server';
import { db }            from '@/lib/db';
import {
  apiPaginated,
  apiInternalError,
  parsePagination,
} from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sp         = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp, { limit: 20 });

    const search     = sp.get('search') ?? '';
    const categoryId = sp.get('category') ? Number(sp.get('category')) : undefined;
    const sort       = sp.get('sort') ?? 'newest';

    const where = {
      status:     'ACTIVE' as const,
      deleted_at: null,
      ...(search ? {
        OR: [
          { brand_name:   { contains: search } },
          { generic_name: { contains: search } },
          { sku:          { contains: search } },
        ],
      } : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
    };

    const orderBy =
      sort === 'price_asc'  ? { selling_price: 'asc'  as const } :
      sort === 'price_desc' ? { selling_price: 'desc' as const } :
      sort === 'name_asc'   ? { brand_name:    'asc'  as const } :
      sort === 'name_desc'  ? { brand_name:    'desc' as const } :
                              { created_at:     'desc' as const };
    const total = await db.product.count({ where });

    const records = await db.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id:               true,
        uuid:             true,
        sku:              true,
        brand_name:       true,
        generic_name:     true,
        product_strength: true,
        pack_size:        true,
        minimum_order:    true,
        selling_price:    true,
        final_price:      true,
        discount_percentage: true,
        category:         { select: { id: true, name: true } },
        manufacturer:     { select: { id: true, name: true } },
        images:           { where: { is_primary: true }, take: 1, select: { url: true } },
        inventoryBatches: { select: { quantity: true }, where: { quantity: { gt: 0 } } },
      },
    });

    const products = records.map(p => ({
      id:                  p.id,
      uuid:                p.uuid,
      sku:                 p.sku,
      brand_name:          p.brand_name,
      generic_name:        p.generic_name,
      product_strength:    p.product_strength,
      pack_size:           p.pack_size,
      minimum_order:       p.minimum_order,
      selling_price:       Number(p.selling_price),
      final_price:         p.final_price         ? Number(p.final_price)         : null,
      discount_percentage: p.discount_percentage ? Number(p.discount_percentage) : null,
      category:            p.category,
      manufacturer:        p.manufacturer,
      primary_image:       p.images[0]?.url ?? null,
      in_stock:            p.inventoryBatches.reduce((s, b) => s + b.quantity, 0) > 0,
      total_stock:         p.inventoryBatches.reduce((s, b) => s + b.quantity, 0),
    }));

    return apiPaginated(products, { page, limit, total }, 'Products retrieved successfully.');
  } catch (err) {
    console.error('[GET /api/catalog/products]', err);
    return apiInternalError();
  }
}
