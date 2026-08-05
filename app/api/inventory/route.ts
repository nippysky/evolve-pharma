import { NextRequest } from 'next/server';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiPaginated,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
  parsePagination,
} from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp, { limit: 20 });

    const productId  = sp.get('product_id') ? parseInt(sp.get('product_id')!, 10) : undefined;
    const nearExpiry = sp.get('near_expiry') === 'true'; // within 30 days
    const lowStock   = sp.get('low_stock')   === 'true'; // quantity < product.minimum_stock_level

    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const where = {
      product: { deleted_at: null },           // never show batches for soft-deleted products
      ...(productId  ? { product_id: productId }                          : {}),
      ...(nearExpiry ? { expiry_date: { not: null, lte: thirtyDays } }    : {}),
      ...(lowStock   ? { quantity: { gt: 0 } }                            : {}), // refined below
    };

    const batches = await db.inventoryBatch.findMany({
      where,
      orderBy:  { received_at: 'desc' },
      skip,
      take:     limit,
      include:  {
        product: {
          select: {
            id:                  true,
            sku:                 true,
            brand_name:          true,
            generic_name:        true,
            minimum_stock_level: true,
            images:              { where: { is_primary: true }, take: 1 },
          },
        },
      },
    });
    const total = await db.inventoryBatch.count({ where });

    const records = batches.map(b => ({
      id:            b.id,
      batch_number:  b.batch_number,
      quantity:      b.quantity,
      cost_price:    Number(b.cost_price),
      expiry_date:   b.expiry_date,
      received_at:   b.received_at,
      is_low_stock:  b.quantity < b.product.minimum_stock_level,
      is_near_expiry:b.expiry_date ? b.expiry_date <= thirtyDays : false,
      product: {
        id:                  b.product.id,
        sku:                 b.product.sku,
        brand_name:          b.product.brand_name,
        generic_name:        b.product.generic_name,
        minimum_stock_level: b.product.minimum_stock_level,
        primary_image:       b.product.images[0]?.url ?? null,
      },
    }));

    return apiPaginated(records, { page, limit, total }, 'Inventory retrieved successfully');
  } catch (err) {
    console.error('[GET /api/inventory]', err);
    return apiInternalError();
  }
}
