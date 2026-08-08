import { NextRequest }    from 'next/server';
import { db }             from '@/lib/db';
import { getSession }     from '@/lib/auth';
import {
  apiSuccess,
  apiForbidden,
  apiUnauthorized,
  apiInternalError,
} from '@/lib/api/response';

type RawDayRow      = { date: string; revenue: string };
type RawCustomerRow = { id: number; name: string; company: string | null; revenue: string; orders: string };
type RawProductRow  = { id: number; name: string; sku: string; revenue: string; units: string };
type RawCategoryRow = { category: string; revenue: string };
type RawCountRow    = { cnt: string | bigint };
type RawSumRow      = { total: string | null };

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

    // ── Period ────────────────────────────────────────────────────────────────
    const rawPeriod = req.nextUrl.searchParams.get('period') ?? '30';
    const days = [7, 30, 90, 365].includes(parseInt(rawPeriod, 10))
      ? parseInt(rawPeriod, 10)
      : 30;

    const now             = new Date();
    const periodStart     = new Date(now.getTime() - days * 86_400_000);
    const prevPeriodStart = new Date(periodStart.getTime() - days * 86_400_000);

    // ── Staff scope ───────────────────────────────────────────────────────────
    // STAFF always sees only their own data.
    // ADMIN can pass ?staff_id=X to drill into a specific staff member's report.
    let staffId: number | null = null;
    if (session.role === 'STAFF') {
      staffId = session.userId;
    } else {
      const rawStaffId = req.nextUrl.searchParams.get('staff_id');
      if (rawStaffId) {
        const parsed = parseInt(rawStaffId, 10);
        if (!isNaN(parsed)) staffId = parsed;
      }
    }

    // ── Staff-scoped branch (raw SQL throughout) ──────────────────────────────
    if (staffId !== null) {
      return await getStaffReport({ staffId, days, periodStart, prevPeriodStart });
    }

    // ── Platform-wide branch (admin, no staff filter) ─────────────────────────
    return await getPlatformReport({ days, periodStart, prevPeriodStart });

  } catch (err) {
    console.error('[GET /api/reports/summary]', err);
    return apiInternalError();
  }
}

// ── Platform-wide (admin, all data) ──────────────────────────────────────────

async function getPlatformReport(opts: {
  days:             number;
  periodStart:      Date;
  prevPeriodStart:  Date;
}) {
  const { days, periodStart, prevPeriodStart } = opts;

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

  const prevAgg = await db.order.aggregate({
    where: {
      created_at:     { gte: prevPeriodStart, lt: periodStart },
      payment_status: 'PAID',
      status:         { notIn: ['CANCELLED'] },
    },
    _sum:   { total: true },
    _count: { id: true },
  });

  const activeShipments = await db.delivery.count({
    where: { status: { in: ['AWAITING_DISPATCH', 'ASSIGNED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] } },
  });

  const newCustomers = await db.customer.count({
    where: { created_at: { gte: periodStart } },
  });
  const prevNewCustomers = await db.customer.count({
    where: { created_at: { gte: prevPeriodStart, lt: periodStart } },
  });

  const totalCustomers = await db.customer.count();

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

  const statusGroups = await db.order.groupBy({
    by:     ['status'],
    _count: { id: true },
  });

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

  const deliveryGroups = await db.delivery.groupBy({
    by:     ['status'],
    _count: { id: true },
  });

  const revenue     = toNum(currentAgg._sum.total);
  const prevRevenue = toNum(prevAgg._sum.total);
  const orders      = currentAgg._count.id;
  const prevOrders  = prevAgg._count.id;

  return apiSuccess({
    scope:  'platform',
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
      totalCustomers,
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
}

// ── Staff-scoped (filters through assigned_staff_id) ─────────────────────────

async function getStaffReport(opts: {
  staffId:          number;
  days:             number;
  periodStart:      Date;
  prevPeriodStart:  Date;
}) {
  const { staffId, days, periodStart, prevPeriodStart } = opts;

  // Revenue + orders this period
  const revenueRows = await db.$queryRaw<RawSumRow[]>`
    SELECT CAST(SUM(o.total) AS CHAR) AS total
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE c.assigned_staff_id = ${staffId}
      AND o.created_at        >= ${periodStart}
      AND o.payment_status     = 'PAID'
      AND o.status            != 'CANCELLED'
  `;
  const revenue = toNum(revenueRows[0]?.total);

  const orderCountRows = await db.$queryRaw<RawCountRow[]>`
    SELECT CAST(COUNT(o.id) AS CHAR) AS cnt
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE c.assigned_staff_id = ${staffId}
      AND o.created_at        >= ${periodStart}
      AND o.payment_status     = 'PAID'
      AND o.status            != 'CANCELLED'
  `;
  const orders = toNum(orderCountRows[0]?.cnt);

  // Revenue + orders previous period
  const prevRevenueRows = await db.$queryRaw<RawSumRow[]>`
    SELECT CAST(SUM(o.total) AS CHAR) AS total
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE c.assigned_staff_id = ${staffId}
      AND o.created_at        >= ${prevPeriodStart}
      AND o.created_at         < ${periodStart}
      AND o.payment_status     = 'PAID'
      AND o.status            != 'CANCELLED'
  `;
  const prevRevenue = toNum(prevRevenueRows[0]?.total);

  const prevOrderRows = await db.$queryRaw<RawCountRow[]>`
    SELECT CAST(COUNT(o.id) AS CHAR) AS cnt
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE c.assigned_staff_id = ${staffId}
      AND o.created_at        >= ${prevPeriodStart}
      AND o.created_at         < ${periodStart}
      AND o.payment_status     = 'PAID'
      AND o.status            != 'CANCELLED'
  `;
  const prevOrders = toNum(prevOrderRows[0]?.cnt);

  // Avg order value
  const avgRows = await db.$queryRaw<RawSumRow[]>`
    SELECT CAST(AVG(o.total) AS CHAR) AS total
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE c.assigned_staff_id = ${staffId}
      AND o.created_at        >= ${periodStart}
      AND o.payment_status     = 'PAID'
      AND o.status            != 'CANCELLED'
  `;
  const avgOrderValue = toNum(avgRows[0]?.total);

  // Total customers assigned to this staff
  const totalCustRows = await db.$queryRaw<RawCountRow[]>`
    SELECT CAST(COUNT(*) AS CHAR) AS cnt
    FROM customers
    WHERE assigned_staff_id = ${staffId}
  `;
  const totalCustomers = toNum(totalCustRows[0]?.cnt);

  // New customers assigned this period
  const newCustRows = await db.$queryRaw<RawCountRow[]>`
    SELECT CAST(COUNT(*) AS CHAR) AS cnt
    FROM customers
    WHERE assigned_staff_id = ${staffId}
      AND created_at        >= ${periodStart}
  `;
  const newCustomers = toNum(newCustRows[0]?.cnt);

  const prevNewCustRows = await db.$queryRaw<RawCountRow[]>`
    SELECT CAST(COUNT(*) AS CHAR) AS cnt
    FROM customers
    WHERE assigned_staff_id = ${staffId}
      AND created_at        >= ${prevPeriodStart}
      AND created_at         < ${periodStart}
  `;
  const prevNewCustomers = toNum(prevNewCustRows[0]?.cnt);

  // Active shipments for this staff's customers
  const activeShipRows = await db.$queryRaw<RawCountRow[]>`
    SELECT CAST(COUNT(d.id) AS CHAR) AS cnt
    FROM deliveries d
    JOIN orders     o ON d.order_id    = o.id
    JOIN customers  c ON o.customer_id = c.id
    WHERE c.assigned_staff_id = ${staffId}
      AND d.status IN ('AWAITING_DISPATCH','ASSIGNED','IN_TRANSIT','OUT_FOR_DELIVERY')
  `;
  const activeShipments = toNum(activeShipRows[0]?.cnt);

  // Revenue by day
  const rawByDay = await db.$queryRaw<RawDayRow[]>`
    SELECT
      DATE_FORMAT(o.created_at, '%Y-%m-%d') AS date,
      CAST(SUM(o.total) AS CHAR)            AS revenue
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE c.assigned_staff_id = ${staffId}
      AND o.created_at        >= ${periodStart}
      AND o.payment_status     = 'PAID'
      AND o.status            != 'CANCELLED'
    GROUP BY DATE_FORMAT(o.created_at, '%Y-%m-%d')
    ORDER BY date ASC
  `;

  // Top customers for this staff
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
    WHERE c.assigned_staff_id = ${staffId}
      AND o.created_at        >= ${periodStart}
      AND o.payment_status     = 'PAID'
      AND o.status            != 'CANCELLED'
    GROUP BY c.id, u.first_name, u.last_name, c.company_name
    ORDER BY SUM(o.total) DESC
    LIMIT 10
  `;

  // Top products for this staff
  const rawTopProducts = await db.$queryRaw<RawProductRow[]>`
    SELECT
      p.id,
      p.brand_name                   AS name,
      p.sku,
      CAST(SUM(oi.subtotal) AS CHAR) AS revenue,
      CAST(SUM(oi.quantity) AS CHAR) AS units
    FROM order_items oi
    JOIN products  p  ON oi.product_id = p.id
    JOIN orders    o  ON oi.order_id   = o.id
    JOIN customers c  ON o.customer_id = c.id
    WHERE c.assigned_staff_id = ${staffId}
      AND o.created_at        >= ${periodStart}
      AND o.payment_status     = 'PAID'
      AND o.status            != 'CANCELLED'
    GROUP BY p.id, p.brand_name, p.sku
    ORDER BY SUM(oi.subtotal) DESC
    LIMIT 10
  `;

  // Orders by status for this staff
  type RawStatusRow = { status: string; cnt: string };
  const rawStatusGroups = await db.$queryRaw<RawStatusRow[]>`
    SELECT o.status, CAST(COUNT(o.id) AS CHAR) AS cnt
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE c.assigned_staff_id = ${staffId}
    GROUP BY o.status
  `;

  // Revenue by category for this staff
  const rawByCategory = await db.$queryRaw<RawCategoryRow[]>`
    SELECT
      COALESCE(cat.name, 'Uncategorised') AS category,
      CAST(SUM(oi.subtotal) AS CHAR)      AS revenue
    FROM order_items oi
    JOIN products   p   ON oi.product_id = p.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    JOIN orders     o   ON oi.order_id   = o.id
    JOIN customers  c   ON o.customer_id = c.id
    WHERE c.assigned_staff_id = ${staffId}
      AND o.created_at        >= ${periodStart}
      AND o.payment_status     = 'PAID'
      AND o.status            != 'CANCELLED'
    GROUP BY cat.id, cat.name
    ORDER BY SUM(oi.subtotal) DESC
    LIMIT 8
  `;

  return apiSuccess({
    scope:   'staff',
    staffId,
    period:  days,

    kpis: {
      revenue,
      revenueTrend:       trendPct(revenue, prevRevenue),
      orders,
      ordersTrend:        trendPct(orders, prevOrders),
      avgOrderValue,
      activeShipments,
      newCustomers,
      newCustomersTrend:  trendPct(newCustomers, prevNewCustomers),
      totalCustomers,
    },

    revenueByDay: rawByDay.map(r => ({
      date:    r.date,
      revenue: toNum(r.revenue),
    })),

    ordersByStatus: rawStatusGroups.map(r => ({
      status: r.status,
      count:  toNum(r.cnt),
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
      byStatus: [],  // not shown in staff view
    },
  });
}
