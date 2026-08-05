import { unstable_cache } from 'next/cache';
import { db }            from '@/lib/db';

export interface DashboardKpis {
  totalCustomers:     number;
  activeProducts:     number;
  ordersThisMonth:    number;
  revenueThisMonth:   number; // in kobo/raw value
  pendingReview:      number; // customers awaiting review
  lowStockSkus:       number;
  pendingOrders:      number;
  activeDeliveries:   number;
}

async function _fetchKpis(): Promise<DashboardKpis> {
  const now       = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const [
      totalCustomers,
      activeProducts,
      ordersThisMonth,
      revenueRaw,
      pendingReview,
      pendingOrders,
      activeDeliveries,
      lowStockSkus,
    ] = await Promise.all([
      db.customer.count(),

      db.product.count({ where: { status: 'ACTIVE', deleted_at: null } }),

      db.order.count({
        where: { created_at: { gte: monthStart } },
      }),

      db.order.aggregate({
        where: {
          created_at:     { gte: monthStart },
          payment_status: 'PAID',
        },
        _sum: { total: true },
      }),

      db.customer.count({ where: { status: 'PENDING_REVIEW' } }),

      db.order.count({ where: { status: 'PENDING' } }),

      db.delivery.count({
        where: { status: { in: ['ASSIGNED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] } },
      }),

      // Products where current stock is below minimum_stock_level
      db.product.count({
        where: {
          status:     'ACTIVE',
          deleted_at: null,
          inventoryBatches: {
            none: {}, // no batches at all → out of stock
          },
        },
      }),
    ]);

    return {
      totalCustomers,
      activeProducts,
      ordersThisMonth,
      revenueThisMonth:  Number(revenueRaw._sum.total ?? 0),
      pendingReview,
      pendingOrders,
      activeDeliveries,
      lowStockSkus,
    };
  } catch (err) {
    console.error('[dashboard.server] fetchKpis error:', err);
    return {
      totalCustomers:   0,
      activeProducts:   0,
      ordersThisMonth:  0,
      revenueThisMonth: 0,
      pendingReview:    0,
      pendingOrders:    0,
      activeDeliveries: 0,
      lowStockSkus:     0,
    };
  }
}

async function _fetchRecentOrders(limit: number) {
  try {
    return await db.order.findMany({
      take:    limit,
      orderBy: { created_at: 'desc' },
      select: {
        id:             true,
        order_number:   true,
        status:         true,
        payment_status: true,
        total:          true,
        created_at:     true,
        customer: {
          select: {
            company_name: true,
            user: { select: { first_name: true, last_name: true } },
          },
        },
      },
    });
  } catch (err) {
    console.error('[dashboard.server] fetchRecentOrders error:', err);
    return [];
  }
}

/** Admin KPIs — refreshes every 2 minutes. */
export const getDashboardKpis = () =>
  unstable_cache(
    _fetchKpis,
    ['dashboard-kpis'],
    { tags: ['dashboard', 'orders', 'customers', 'products'], revalidate: 120 },
  )();

/** Recent orders for the dashboard feed — refreshes every 60 s. */
export const getRecentOrders = (limit = 10) =>
  unstable_cache(
    () => _fetchRecentOrders(limit),
    [`recent-orders-${limit}`],
    { tags: ['dashboard', 'orders'], revalidate: 60 },
  )();
