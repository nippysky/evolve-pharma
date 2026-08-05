import { NextRequest } from 'next/server';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
} from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const skuGroups = await db.inventoryBatch.groupBy({
      by:    ['product_id'],
      where: { product: { deleted_at: null } },
      _count: { product_id: true },
    });
    const totalSkus = skuGroups.length;

    const expiringCount = await db.inventoryBatch.count({
      where: {
        product:     { deleted_at: null },
        expiry_date: { not: null, lte: thirtyDays, gte: new Date() },
        quantity:    { gt: 0 },
      },
    });

    const stockAgg = await db.inventoryBatch.aggregate({
      where: { product: { deleted_at: null } },
      _sum:  { quantity: true },
    });

    const products = await db.product.findMany({
      where: {
        deleted_at: null,
        inventoryBatches: { some: {} },
      },
      select: {
        id:                  true,
        minimum_stock_level: true,
        inventoryBatches:    { select: { quantity: true } },
      },
    });

    const lowStockCount = products.filter(p => {
      const totalQty = p.inventoryBatches.reduce((s, b) => s + b.quantity, 0);
      return totalQty < p.minimum_stock_level;
    }).length;

    return apiSuccess({
      total_skus:      totalSkus,
      low_stock_count: lowStockCount,
      expiring_count:  expiringCount,
      total_stock:     stockAgg._sum.quantity ?? 0,
    });
  } catch (err) {
    console.error('[GET /api/inventory/stats]', err);
    return apiInternalError();
  }
}
