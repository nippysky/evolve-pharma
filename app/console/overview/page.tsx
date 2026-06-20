import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ORDERS, CUSTOMERS, DELIVERIES, INVENTORY } from '@/lib/data/operational';
import { getAllProducts } from '@/lib/data/products';
import { Badge } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { PageHead } from '@/components/shared/PageHead';
import {
  TrendingUp,
  TrendingDown,
  Box,
  Building,
  CreditCard,
  Truck,
  AlertTriangle,
} from '@/components/icons';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/lib/constants';
import { formatNaira, formatCompact } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default async function ConsoleOverviewPage() {
  const session = await getSession();
  // Drivers have their own dashboard — send them there immediately
  if (session?.role === 'driver') redirect('/console/driver');
  const isAdmin = session?.role === 'admin';

  const totalRevenue = ORDERS
    .filter((o) => o.payment_status === 'paid')
    .reduce((sum, o) => sum + o.total_amount, 0);
  const ordersThisMonth = ORDERS.length;
  const activeCustomers = CUSTOMERS.length;
  const inFlight = DELIVERIES.filter((d) => d.status !== 'delivered').length;

  const recentOrders = [...ORDERS]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 6);

  const productsWithUnits = getAllProducts()
    .map((p) => {
      const units = ORDERS.flatMap((o) => o.items)
        .filter((i) => i.product_id === p.id)
        .reduce((acc, i) => acc + i.quantity, 0);
      return { ...p, units, revenue: units * p.selling_price };
    })
    .filter((p) => p.units > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const lowStock = INVENTORY.filter((i) => i.is_low_stock).length;

  const kpis = isAdmin
    ? [
        { label: 'Revenue (mtd)', value: formatNaira(totalRevenue), delta: '+12.4%', up: true, Icon: CreditCard },
        { label: 'Orders', value: String(ordersThisMonth), delta: '+3.2%', up: true, Icon: Box },
        { label: 'Active customers', value: String(activeCustomers), delta: '+1', up: true, Icon: Building },
        { label: 'Low-stock SKUs', value: String(lowStock), delta: '-2', up: false, Icon: AlertTriangle },
      ]
    : [
        { label: 'My customers', value: String(CUSTOMERS.filter((c) => c.onboarded_by === session?.id).length), delta: '+1', up: true, Icon: Building },
        { label: 'Orders this month', value: String(ordersThisMonth), delta: '+3.2%', up: true, Icon: Box },
        { label: 'In transit', value: String(inFlight), delta: '0', up: true, Icon: Truck },
        { label: 'Onboarding queue', value: '2', delta: '+1', up: true, Icon: Building },
      ];

  return (
    <>
      <PageHead
        title={isAdmin ? 'Operational overview' : `Hi, ${session?.full_name.split(' ')[0] ?? ''}.`}
        subtitle={
          isAdmin
            ? 'Live snapshot of revenue, orders, and operational health.'
            : 'Your customers, deliveries, and onboarding queue at a glance.'
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                {k.label}
              </span>
              <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-50 text-brand-600">
                <k.Icon size={14} />
              </span>
            </div>
            <div className="num font-display text-3xl tracking-tight leading-none">{k.value}</div>
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium',
                k.up ? 'text-leaf-600' : 'text-danger',
              )}
            >
              {k.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {k.delta} vs last month
            </span>
            <Sparkline />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <header className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
            <span className="text-base font-medium tracking-tight text-ink">Recent orders</span>
            <Link href="/console/orders" className="text-xs font-medium text-brand-600 hover:underline hover:underline-offset-2">
              View all →
            </Link>
          </header>
          <TableWrap className="border-0">
            <Table compact>
              <Thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th align="right">Total</Th>
                </tr>
              </Thead>
              <Tbody>
                {recentOrders.map((o) => {
                  const cust = CUSTOMERS.find((c) => c.id === o.customer_id);
                  return (
                    <Tr key={o.id}>
                      <Td>
                        <Link href={`/console/orders/${o.id}`} className="font-mono text-xs text-ink-2 hover:text-brand-600">
                          {o.order_number}
                        </Link>
                      </Td>
                      <Td muted>{cust?.company_name ?? '—'}</Td>
                      <Td>
                        <Badge tone={ORDER_STATUS_TONE[o.status]} noDot>
                          {ORDER_STATUS_LABEL[o.status]}
                        </Badge>
                      </Td>
                      <Td right num>{formatNaira(o.total_amount)}</Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </TableWrap>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <header className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
            <span className="text-base font-medium tracking-tight text-ink">Top products</span>
            <Link href="/console/products" className="text-xs font-medium text-brand-600 hover:underline hover:underline-offset-2">
              View all →
            </Link>
          </header>
          <ul>
            {productsWithUnits.map((p) => (
              <li
                key={p.id}
                className="grid grid-cols-[36px_1fr_auto] items-center gap-3.5 border-b border-line-subtle px-5 py-3.5 last:border-b-0"
              >
                <div className="h-9 w-9 overflow-hidden rounded bg-bg-muted">
                  <Image src={p.image_url} alt={p.name} width={72} height={72} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium tracking-tight text-ink">{p.name}</div>
                  <div className="mt-0.5 truncate text-xs text-ink-3">
                    {formatCompact(p.units)} units · {p.manufacturer}
                  </div>
                </div>
                <div className="num font-display text-base">{formatNaira(p.revenue)}</div>
              </li>
            ))}
            {productsWithUnits.length === 0 && (
              <li className="px-5 py-12 text-center text-sm text-ink-3">No sales data yet.</li>
            )}
          </ul>
        </div>
      </div>
    </>
  );
}

function Sparkline() {
  const points = [4, 6, 5, 8, 7, 11, 10, 14, 12, 16, 18, 22];
  const max = Math.max(...points);
  const min = Math.min(...points);
  const w = 100, h = 32;
  const stepX = w / (points.length - 1);
  const norm = (n: number) => h - ((n - min) / (max - min)) * h * 0.85 - 2;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${norm(p).toFixed(1)}`).join(' ');
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" className="spark-fill-from" />
          <stop offset="100%" className="spark-fill-to" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkFill)" />
      <path d={path} stroke="var(--color-brand-500)" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
