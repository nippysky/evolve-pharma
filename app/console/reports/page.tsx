/**
 * Console · Reports (admin + staff with view_reports permission)
 *
 * World-class analytics page. All computation is server-side.
 * API-ready: replace each const block with an async fetch call.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, hasPermission } from '@/lib/auth';
import {
  TrendingUp,
  TrendingDown,
  Box,
  CreditCard,
  Building,
  Truck,
  Users,
} from '@/components/icons';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Avatar, Badge } from '@/components/ui/Primitives';
import { PageHead } from '@/components/shared/PageHead';
import { ORDERS, CUSTOMERS, DELIVERIES } from '@/lib/data/operational';
import { STAFF_MEMBERS } from '@/lib/data/staff';
import { getAllProducts } from '@/lib/data/products';
import { formatNaira, formatCompact } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/types';

async function getSessionWithPermCheck(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role === 'customer') redirect('/portal/catalog');
  if (session.role === 'driver') redirect('/console/driver');
  if (!hasPermission(session, 'view_reports')) redirect('/console/overview');
  return session;
}

export const metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const session = await getSessionWithPermCheck();
  const isAdmin = session.role === 'admin';

  // ── Revenue ─────────────────────────────────────────────────────────────
  const paidOrders   = ORDERS.filter((o) => o.payment_status === 'paid');
  const totalRevenue = paidOrders.reduce((s, o) => s + o.total_amount, 0);
  const avgOrder     = totalRevenue / Math.max(1, paidOrders.length);

  // ── Orders ───────────────────────────────────────────────────────────────
  const ordersByStatus = ORDERS.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  // ── Deliveries ──────────────────────────────────────────────────────────
  const inFlight  = DELIVERIES.filter((d) => d.status !== 'delivered' && d.status !== 'failed').length;
  const delivered = DELIVERIES.filter((d) => d.status === 'delivered').length;

  // ── Top customers ────────────────────────────────────────────────────────
  const topCustomers = [...CUSTOMERS]
    .map((c) => {
      const spend      = ORDERS.filter((o) => o.customer_id === c.id && o.payment_status === 'paid').reduce((s, o) => s + o.total_amount, 0);
      const orderCount = ORDERS.filter((o) => o.customer_id === c.id).length;
      const agent      = c.agent;
      return { ...c, spend, orderCount, agent };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8);

  // ── Revenue by category ──────────────────────────────────────────────────
  const products = getAllProducts();
  const byCategory = Object.entries(
    products.reduce<Record<string, number>>((acc, p) => {
      const units = ORDERS.flatMap((o) => o.items)
        .filter((i) => i.product_id === p.id)
        .reduce((s, i) => s + i.quantity, 0);
      acc[p.category] = (acc[p.category] ?? 0) + units * p.selling_price;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // ── Top products ─────────────────────────────────────────────────────────
  const topProducts = products
    .map((p) => {
      const units   = ORDERS.flatMap((o) => o.items).filter((i) => i.product_id === p.id).reduce((s, i) => s + i.quantity, 0);
      const revenue = units * p.selling_price;
      return { ...p, units, revenue };
    })
    .filter((p) => p.units > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // ── Staff performance (admin only) ───────────────────────────────────────
  const staffPerf = STAFF_MEMBERS.map((s) => {
    const onboarded = CUSTOMERS.filter((c) => c.onboarded_by === s.id).length;
    const gmv       = CUSTOMERS.filter((c) => c.onboarded_by === s.id)
      .reduce((sum, c) => {
        return sum + ORDERS.filter((o) => o.customer_id === c.id && o.payment_status === 'paid')
          .reduce((ss, o) => ss + o.total_amount, 0);
      }, 0);
    return { ...s, onboarded, gmv };
  }).sort((a, b) => b.gmv - a.gmv);

  const kpis = [
    { label: 'Total revenue',       value: formatNaira(totalRevenue), delta: '+12.4%', up: true,  Icon: CreditCard },
    { label: 'Orders',              value: String(ORDERS.length),     delta: '+3.2%',  up: true,  Icon: Box        },
    { label: 'Avg. order value',    value: formatNaira(avgOrder),     delta: '+1.8%',  up: true,  Icon: Building   },
    { label: 'Active shipments',    value: String(inFlight),          delta: '0',      up: true,  Icon: Truck      },
  ];

  return (
    <>
      <PageHead title="Reports" subtitle="Operational and commercial metrics across the business." />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{k.label}</span>
              <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-50 text-brand-600">
                <k.Icon size={14} />
              </span>
            </div>
            <div className="num font-display text-3xl tracking-tight leading-none">{k.value}</div>
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium', k.up ? 'text-leaf-600' : 'text-danger')}>
              {k.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {k.delta} vs last month
            </span>
            <SparkSvg points={[4,6,5,8,7,11,10,14,12,16,18,22]} className="mt-1 h-9 w-full" />
          </div>
        ))}
      </div>

      {/* Order status breakdown */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        {(['pending','processing','dispatched','delivered','cancelled'] as const).map((s) => (
          <div key={s} className="rounded-xl border border-line bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{s}</div>
            <div className="num mt-1 font-display text-2xl tracking-tight text-ink">{ordersByStatus[s] ?? 0}</div>
          </div>
        ))}
      </div>

      {/* Top customers + Revenue by category */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <header className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
            <span className="text-base font-medium tracking-tight text-ink">Top customers by spend</span>
            <Link href="/console/customers" className="text-xs font-medium text-brand-600 hover:underline">View all →</Link>
          </header>
          <TableWrap className="border-0">
            <Table compact>
              <Thead>
                <tr>
                  <Th>Customer</Th>
                  <Th align="right">Orders</Th>
                  <Th align="right">Spend</Th>
                </tr>
              </Thead>
              <Tbody>
                {topCustomers.map((c) => (
                  <Tr key={c.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.company_name} size={28} />
                        <div className="min-w-0">
                          <Link href={`/console/customers/${c.id}`} className="truncate font-medium text-ink hover:text-brand-600 block">
                            {c.company_name}
                          </Link>
                          {c.agent && (
                            <div className="truncate text-xs text-ink-3">via {c.agent.fname} {c.agent.lname}</div>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td right num>{c.orderCount}</Td>
                    <Td right num>{formatNaira(c.spend)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <header className="border-b border-line-subtle px-5 py-4 text-base font-medium tracking-tight text-ink">
            Revenue by category
          </header>
          <ul className="p-5 space-y-4">
            {byCategory.map(([cat, value], idx) => {
              const max = byCategory[0]?.[1] ?? 1;
              const pct = Math.max(4, Math.round((value / max) * 100));
              return (
                <li key={cat}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-ink-2">
                      <span className="num mr-2 text-ink-4">{String(idx + 1).padStart(2, '0')}</span>
                      {cat}
                    </span>
                    <span className="num font-medium text-ink">{formatCompact(value)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-muted">
                    <div className="h-full rounded-full bg-linear-to-r from-brand-500 to-leaf-500" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Top products */}
      <div className="mt-6 overflow-hidden rounded-xl border border-line bg-white">
        <header className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
          <span className="text-base font-medium tracking-tight text-ink">Top products by revenue</span>
          <Link href="/console/products" className="text-xs font-medium text-brand-600 hover:underline">View all →</Link>
        </header>
        <TableWrap className="border-0">
          <Table compact>
            <Thead>
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th align="right">Units sold</Th>
                <Th align="right">Revenue</Th>
              </tr>
            </Thead>
            <Tbody>
              {topProducts.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <Link href={`/console/products/${p.sku}`} className="font-medium text-ink hover:text-brand-600">
                      {p.name}
                    </Link>
                    <div className="mt-0.5 font-mono text-xs text-ink-3">{p.sku}</div>
                  </Td>
                  <Td muted>{p.category}</Td>
                  <Td right num>{formatCompact(p.units)}</Td>
                  <Td right num>{formatNaira(p.revenue)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      </div>

      {/* Staff performance (admin only) */}
      {isAdmin && (
        <div className="mt-6 overflow-hidden rounded-xl border border-line bg-white">
          <header className="flex items-center gap-2 border-b border-line-subtle px-5 py-4">
            <Users size={15} className="text-ink-3" />
            <span className="text-base font-medium tracking-tight text-ink">Staff performance</span>
          </header>
          <TableWrap className="border-0">
            <Table compact>
              <Thead>
                <tr>
                  <Th>Staff member</Th>
                  <Th>Role</Th>
                  <Th align="right">Customers onboarded</Th>
                  <Th align="right">GMV attributed</Th>
                </tr>
              </Thead>
              <Tbody>
                {staffPerf.map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={`${s.fname} ${s.lname}`} size={28} />
                        <span className="font-medium text-ink">{s.fname} {s.lname}</span>
                      </div>
                    </Td>
                    <Td muted className="capitalize">{s.permission_preset?.replace('_', ' ') ?? 'Staff'}</Td>
                    <Td right num>{s.onboarded}</Td>
                    <Td right num>{formatNaira(s.gmv)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      {/* Trend charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium tracking-tight text-ink">Order volume trend</h3>
            <Badge tone="success" noDot>+18% MoM</Badge>
          </div>
          <SparkSvg points={[12,18,16,22,24,20,28,32,30,38,42,48,46,52]} className="mt-3 h-32 w-full" />
          <div className="mt-2 flex justify-between text-[10px] text-ink-4">
            <span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span>
            <span>Oct</span><span>Nov</span><span>Dec</span><span>Jan</span>
            <span>Feb</span><span>Mar</span><span>Apr</span><span>May</span>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium tracking-tight text-ink">Revenue trend</h3>
            <Badge tone="success" noDot>+12.4% MoM</Badge>
          </div>
          <SparkSvg points={[8,14,12,20,18,16,26,30,28,36,40,44,48,56]} className="mt-3 h-32 w-full" />
          <div className="mt-2 flex justify-between text-[10px] text-ink-4">
            <span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span>
            <span>Oct</span><span>Nov</span><span>Dec</span><span>Jan</span>
            <span>Feb</span><span>Mar</span><span>Apr</span><span>May</span>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-ink-4">
        All figures are computed from mock data. Swap the data imports for real API calls when the backend is ready.
        Replace each <code className="rounded bg-bg-muted px-1">const ORDERS = …</code> with{' '}
        <code className="rounded bg-bg-muted px-1">await fetchOrders()</code>.
      </p>
    </>
  );
}

function SparkSvg({ points, className }: { points: number[]; className: string }) {
  const max    = Math.max(...points);
  const min    = Math.min(...points);
  const w      = 100;
  const h      = 100;
  const stepX  = w / (points.length - 1);
  const norm   = (n: number) => h - ((n - min) / (max - min)) * h * 0.85 - 4;
  const path   = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${norm(p).toFixed(1)}`).join(' ');
  const area   = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="sparkR" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   className="spark-fill-from" />
          <stop offset="100%" className="spark-fill-to"   />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkR)" />
      <path d={path} stroke="var(--color-brand-500)" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
