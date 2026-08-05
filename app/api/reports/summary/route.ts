import { NextRequest }    from 'next/server';
import { db }             from '@/lib/db';
import { getSession }     from '@/lib/auth';
import {
  apiSuccess,
  apiForbidden,
  apiUnauthorized,
  apiInternalError,
} from '@/lib/api/response';

type RawDayRow = { date: string; revenue: string };
type RawCustomerRow = { id: number; name: string; company: string | null; revenue: string; orders: string };
type RawProductRow  = { id: number; name: string; sku: string; revenue: string; units: string };
type RawCategoryRow = { category: string; revenue: string };

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'number') return v;
  return parseFloat(String(v)) || 0;
}

function trendPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    // ── Period setup ──────────────────────────────────────────────────────────
    const rawPeriod = req.nextUrl.searchParams.get('period') ?? '30';
    const days = [7, 30, 90, 365].includes(parseInt(rawPeriod, 10))
      ? parseInt(rawPeriod, 10)
      : 30;

    const now              = new Date();
    const periodStart      = new Date(now.getTime() - days * 86_400_000);
    const prevPeriodStart  = new Date(periodStart.getTime() - days * 86_400_000);

    // Current-period order aggregates
    const currentAgg = await db.order.aggregate({
      where: {
        created_at:     { gte: periodStart },
        payment_status: 'PAID',
        status:         { notIn: ['CANCELLED'] },
      },
      _sum:   { total: true },
      _count: { id: true },
      _avg:   { total: true },
    });

    // Previous-period order aggregates
    const prevAgg = await db.order.aggregate({
      where: {
        created_at:     { gte: prevPeriodStart, lt: periodStart },
        payment_status: 'PAID',
        status:         { notIn: ['CANCELLED'] },
      },
      _sum:   { total: true },
      _count: { id: true },
    });

    // Active shipments (live snapshot)
    const activeShipments = await db.delivery.count({
      where: { status: { in: ['AWAITING_DISPATCH', 'ASSIGNED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] } },
    });

    // New customers this period
    const newCustomers = await db.customer.count({
      where: { created_at: { gte: periodStart } },
    });
    const prevNewCustomers = await db.customer.count({
      where: { created_at: { gte: prevPeriodStart, lt: periodStart } },
    });

    // Revenue by day (raw SQL — Prisma has no date-trunc grouping)
    const rawByDay = await db.$queryRaw<RawDayRow[]>`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
        CAST(SUM(total) AS CHAR)            AS revenue
      FROM orders
      WHERE created_at      >= ${periodStart}
        AND payment_status  = 'PAID'
        AND status         != 'CANCELLED'
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
      ORDER BY date ASC
    `;

    // Orders by status (all-time snapshot)
    const statusGroups = await db.order.groupBy({
      by:     ['status'],
      _count: { id: true },
    });

    // Top customers by spend (period)
    const rawTopCustomers = await db.$queryRaw<RawCustomerRow[]>`
      SELECT
        c.id,
        CONCAT(u.first_name, ' ', u.last_name)  AS name,
        c.company_name                            AS company,
        CAST(SUM(o.total) AS CHAR)               AS revenue,
        CAST(COUNT(o.id)  AS CHAR)               AS orders
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN users     u ON c.user_id     = u.id
      WHERE o.created_at     >= ${periodStart}
        AND o.payment_status  = 'PAID'
        AND o.status         != 'CANCELLED'
      GROUP BY c.id, u.first_name, u.last_name, c.company_name
      ORDER BY SUM(o.total) DESC
      LIMIT 10
    `;

    // Top products by revenue (period)
    const rawTopProducts = await db.$queryRaw<RawProductRow[]>`
      SELECT
        p.id,
        p.brand_name               AS name,
        p.sku,
        CAST(SUM(oi.subtotal) AS CHAR) AS revenue,
        CAST(SUM(oi.quantity) AS CHAR) AS units
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders   o ON oi.order_id   = o.id
      WHERE o.created_at     >= ${periodStart}
        AND o.payment_status  = 'PAID'
        AND o.status         != 'CANCELLED'
      GROUP BY p.id, p.brand_name, p.sku
      ORDER BY SUM(oi.subtotal) DESC
      LIMIT 10
    `;

    // Revenue by category (period)
    const rawByCategory = await db.$queryRaw<RawCategoryRow[]>`
      SELECT
        COALESCE(cat.name, 'Uncategorised') AS category,
        CAST(SUM(oi.subtotal) AS CHAR)      AS revenue
      FROM order_items oi
      JOIN products   p   ON oi.product_id = p.id
      LEFT JOIN categories cat ON p.category_id = cat.id
      JOIN orders     o   ON oi.order_id   = o.id
      WHERE o.created_at     >= ${periodStart}
        AND o.payment_status  = 'PAID'
        AND o.status         != 'CANCELLED'
      GROUP BY cat.id, cat.name
      ORDER BY SUM(oi.subtotal) DESC
      LIMIT 8
    `;

    // Delivery status breakdown (live snapshot)
    const deliveryGroups = await db.delivery.groupBy({
      by:     ['status'],
      _count: { id: true },
    });

    // ── Shape + return ────────────────────────────────────────────────────────
    const revenue     = toNum(currentAgg._sum.total);
    const prevRevenue = toNum(prevAgg._sum.total);
    const orders      = currentAgg._count.id;
    const prevOrders  = prevAgg._count.id;

    return apiSuccess({
      period: days,

      kpis: {
        revenue,
        revenueTrend:       trendPct(revenue, prevRevenue),
        orders,
        ordersTrend:        trendPct(orders, prevOrders),
        avgOrderValue:      toNum(currentAgg._avg.total),
        activeShipments,
        newCustomers,
        newCustomersTrend:  trendPct(newCustomers, prevNewCustomers),
      },

      revenueByDay: rawByDay.map(r => ({
        date:    r.date,
        revenue: toNum(r.revenue),
      })),

      ordersByStatus: statusGroups.map(g => ({
        status: g.status,
        count:  g._count.id,
      })),

      topCustomers: rawTopCustomers.map(r => ({
        id:      r.id,
        name:    r.name,
        company: r.company ?? null,
        revenue: toNum(r.revenue),
        orders:  toNum(r.orders),
      })),

      topProducts: rawTopProducts.map(r => ({
        id:      r.id,
        name:    r.name,
        sku:     r.sku,
        revenue: toNum(r.revenue),
        units:   toNum(r.units),
      })),

      revenueByCategory: rawByCategory.map(r => ({
        category: r.category,
        revenue:  toNum(r.revenue),
      })),

      deliveryMetrics: {
        byStatus: deliveryGroups.map(g => ({
          status: g.status,
          count:  g._count.id,
        })),
      },
    });
  } catch (err) {
    console.error('[GET /api/reports/summary]', err);
    return apiInternalError();
  }
}
