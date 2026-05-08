import { TrendingUp, TrendingDown, Box, CreditCard, Building, Truck } from '@/components/icons';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Avatar, Badge } from '@/components/ui/Primitives';
import { PageHead } from '@/components/shared/PageHead';
import { ORDERS, CUSTOMERS, DELIVERIES } from '@/lib/data/operational';
import { getAllProducts } from '@/lib/data/products';
import { formatNaira, formatCompact } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const totalRevenue = ORDERS.filter((o) => o.payment_status === 'paid').reduce((sum, o) => sum + o.total_amount, 0);
  const avgOrder = totalRevenue / Math.max(1, ORDERS.length);
  const inFlight = DELIVERIES.filter((d) => d.status !== 'delivered').length;

  const topCustomers = [...CUSTOMERS]
    .map((c) => {
      const spend = ORDERS
        .filter((o) => o.customer_id === c.id && o.payment_status === 'paid')
        .reduce((sum, o) => sum + o.total_amount, 0);
      const ordersCount = ORDERS.filter((o) => o.customer_id === c.id).length;
      return { ...c, spend, ordersCount };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8);

  const products = getAllProducts();
  const topByCategory = Object.entries(
    products.reduce<Record<string, number>>((acc, p) => {
      const units = ORDERS.flatMap((o) => o.items).filter((i) => i.product_id === p.id).reduce((s, i) => s + i.quantity, 0);
      acc[p.category] = (acc[p.category] ?? 0) + units * p.price;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const kpis = [
    { label: 'Revenue', value: formatNaira(totalRevenue), delta: '+12.4%', up: true, Icon: CreditCard },
    { label: 'Total orders', value: String(ORDERS.length), delta: '+3.2%', up: true, Icon: Box },
    { label: 'Avg. order value', value: formatNaira(avgOrder), delta: '+1.8%', up: true, Icon: Building },
    { label: 'In-flight shipments', value: String(inFlight), delta: '0', up: true, Icon: Truck },
  ];

  return (
    <>
      <PageHead title="Reports" subtitle="Operational and commercial metrics across the business." />

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
            <SparklineMini />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <header className="border-b border-line-subtle px-5 py-4 text-base font-medium tracking-tight text-ink">
            Top customers by spend
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
                          <div className="truncate font-medium text-ink">{c.company_name}</div>
                          <div className="truncate text-xs text-ink-3">{c.address}</div>
                        </div>
                      </div>
                    </Td>
                    <Td right num>{c.ordersCount}</Td>
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
          <ul className="p-5">
            {topByCategory.map(([cat, value], idx) => {
              const max = topByCategory[0]?.[1] ?? 1;
              const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
              return (
                <li key={cat} className="mb-4 last:mb-0">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-ink-2">
                      <span className="num mr-2 text-ink-3">{String(idx + 1).padStart(2, '0')}</span>
                      {cat}
                    </span>
                    <span className="num font-medium text-ink">{formatCompact(value)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-leaf-500" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium tracking-tight text-ink">Order volume</h3>
            <Badge tone="success" noDot>+18% MoM</Badge>
          </div>
          <SparklineLarge />
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium tracking-tight text-ink">Active customers</h3>
            <Badge tone="success" noDot>+1 new</Badge>
          </div>
          <SparklineLarge />
        </div>
      </div>
    </>
  );
}

function SparklineMini() {
  const points = [4, 6, 5, 8, 7, 11, 10, 14, 12, 16, 18, 22];
  return <SparkSvg points={points} className="mt-1 h-9 w-full" />;
}
function SparklineLarge() {
  const points = [12, 18, 16, 22, 24, 20, 28, 32, 30, 38, 42, 48, 46, 52];
  return <SparkSvg points={points} className="mt-3 h-32 w-full" />;
}

function SparkSvg({ points, className }: { points: number[]; className: string }) {
  const max = Math.max(...points), min = Math.min(...points);
  const w = 100, h = 100;
  const stepX = w / (points.length - 1);
  const norm = (n: number) => h - ((n - min) / (max - min)) * h * 0.85 - 4;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${norm(p).toFixed(1)}`).join(' ');
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="sparkR" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" className="spark-fill-from" />
          <stop offset="100%" className="spark-fill-to" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkR)" />
      <path d={path} stroke="var(--color-brand-500)" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
