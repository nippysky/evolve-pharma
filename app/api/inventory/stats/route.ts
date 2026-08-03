/**
 * GET /api/inventory/stats
 *
 * Returns dashboard summary counts for the Inventory page:
 *   total_skus       — distinct products that have at least one inventory batch
 *   low_stock_count  — products whose total stock < minimum_stock_level
 *   expiring_count   — batches with expiry_date within the next 30 days
 *   total_stock      — sum of all batch quantities
 *
 * Responses:
 *   200  { total_skus, low_stock_count, expiring_count, total_stock }
 *   401  unauthenticated
 *   403  forbidden
 *   500  server error
 */

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

    const [totalSkus, expiringCount, stockAgg, products] = await Promise.all([
      // Distinct product count with any inventory (exclude soft-deleted products)
      db.inventoryBatch.groupBy({
        by:    ['product_id'],
        where: { product: { deleted_at: null } },
        _count: { product_id: true },
      }).then(r => r.length),

      // Batches expiring within 30 days (exclude soft-deleted products)
      db.inventoryBatch.count({
        where: {
          product:     { deleted_at: null },
          expiry_date: { not: null, lte: thirtyDays, gte: new Date() },
          quantity:    { gt: 0 },
        },
      }),

      // Total stock across all batches (exclude soft-deleted products)
      db.inventoryBatch.aggregate({
        where: { product: { deleted_at: null } },
        _sum:  { quantity: true },
      }),

      // Products with their total stock for low-stock check
      db.product.findMany({
        where: {
          deleted_at: null,
          inventoryBatches: { some: {} },
        },
        select: {
          id:                  true,
          minimum_stock_level: true,
          inventoryBatches:    { select: { quantity: true } },
        },
      }),
    ]);

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
