import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { Badge } from '@/components/ui/Primitives';
import {
  TrendingUp, Box, Building, CreditCard, Truck, AlertTriangle,
} from '@/components/icons';
import {
  CONSOLE_STATS,
  DUMMY_CONSOLE_ORDERS,
  DUMMY_INVENTORY,
} from '@/lib/data/dummy-console';
import { formatNaira, formatDate } from '@/lib/utils';

// ─── Status badge colours ────────────────────────────────────────────────

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';

function orderBadge(status: string): { label: string; tone: BadgeTone } {
  const map: Record<string, { label: string; tone: BadgeTone }> = {
    pending:    { label: 'Pending',    tone: 'warning' },
    processing: { label: 'Processing', tone: 'info' },
    dispatched: { label: 'Dispatched', tone: 'brand' },
    delivered:  { label: 'Delivered',  tone: 'success' },
    cancelled:  { label: 'Cancelled',  tone: 'danger' },
  };
  return map[status] ?? { label: status, tone: 'neutral' };
}

// ─── Top-selling products (by total order qty across all orders) ──────────

function buildTopProducts() {
  const qtys: Record<number, { name: string; sku: string; image: string; qty: number; revenue: number }> = {};
  for (const order of DUMMY_CONSOLE_ORDERS) {
    for (const item of order.items) {
      const e = (qtys[item.product_id] ??= { name: item.product_name, sku: item.product_sku, image: item.product_image ?? '', qty: 0, revenue: 0 });
      e.qty     += item.quantity;
      e.revenue += item.subtotal;
    }
  }
  return Object.values(qtys).sort((a, b) => b.qty - a.qty).slice(0, 5);
}

const TOP_PRODUCTS = buildTopProducts();
const RECENT_ORDERS = [...DUMMY_CONSOLE_ORDERS].sort(
  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
).slice(0, 5);

export default async function ConsoleOverviewPage() {
  const session = await getSession();
  if (session?.role === 'driver') redirect('/console/driver');
  const isAdmin = session?.role === 'admin';

  const kpis = isAdmin
    ? [
        { label: 'Revenue (mtd)',    value: formatNaira(CONSOLE_STATS.revenue_mtd),    Icon: CreditCard,    hint: '+12% vs last month' },
        { label: 'Orders',           value: CONSOLE_STATS.orders_mtd,                  Icon: Box,           hint: 'This month' },
        { label: 'Active customers', value: CONSOLE_STATS.active_customers,            Icon: Building,      hint: '6 pending review' },
        { label: 'Low-stock SKUs',   value: CONSOLE_STATS.low_stock_skus,              Icon: AlertTriangle, hint: 'Needs restocking', warn: true },
      ]
    : [
        { label: 'My customers',      value: 6,   Icon: Building, hint: 'Assigned to you' },
        { label: 'Orders this month', value: 8,   Icon: Box,      hint: '' },
        { label: 'In transit',        value: 1,   Icon: Truck,    hint: '' },
        { label: 'Onboarding queue',  value: 2,   Icon: Building, hint: 'Awaiting PCN' },
      ];

  return (
    <>
      <PageHead
        title={isAdmin ? 'Operational overview' : `Hi, ${session?.full_name?.split(' ')[0] ?? ''}.`}
        subtitle={
          isAdmin
            ? 'Live snapshot of revenue, orders, and operational health.'
            : 'Your customers, deliveries, and onboarding queue at a glance.'
        }
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`flex flex-col gap-2 rounded-xl border bg-white p-5 ${
              ('warn' in k && k.warn && CONSOLE_STATS.low_stock_skus > 0)
                ? 'border-warning bg-warning-soft/30'
                : 'border-line'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                {k.label}
              </span>
              <span className={`grid h-7 w-7 place-items-center rounded-md ${'warn' in k && k.warn ? 'bg-warning-soft text-amber-700' : 'bg-brand-50 text-brand-600'}`}>
                <k.Icon size={14} />
              </span>
            </div>
            <div className="num font-display text-3xl tracking-tight leading-none text-ink">
              {k.value}
            </div>
            {k.hint && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-4">
                <TrendingUp size={12} />
                {k.hint}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Recent orders + Top products */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Recent orders */}
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <header className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
            <span className="text-base font-medium tracking-tight text-ink">Recent orders</span>
            <Link href="/console/orders" className="text-xs font-medium text-brand-600 hover:underline hover:underline-offset-2">
              View all →
            </Link>
          </header>
          <div className="divide-y divide-line-subtle">
            {RECENT_ORDERS.map((order) => {
              const b = orderBadge(order.status);
              return (
                <div key={order.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{order.order_number}</p>
                    <p className="truncate text-xs text-ink-3">
                      {order.customer_company} · {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <Badge tone={b.tone}>{b.label}</Badge>
                    <span className="num text-sm font-medium text-ink">
                      {formatNaira(order.total_amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top products */}
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <header className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
            <span className="text-base font-medium tracking-tight text-ink">Top products</span>
            <Link href="/console/products" className="text-xs font-medium text-brand-600 hover:underline hover:underline-offset-2">
              View all →
            </Link>
          </header>
          <div className="divide-y divide-line-subtle">
            {TOP_PRODUCTS.map((p, i) => (
              <div key={p.sku} className="flex items-center gap-3 px-5 py-3">
                <span className="num w-4 shrink-0 text-xs font-semibold text-ink-3">{i + 1}</span>
                {p.image ? (
                  <Image
                    src={p.image}
                    alt={p.name}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-md border border-line object-contain"
                  />
                ) : (
                  <span className="h-8 w-8 rounded-md border border-line bg-bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-ink-3">{p.qty} units sold</p>
                </div>
                <span className="num shrink-0 text-sm font-medium text-ink">
                  {formatNaira(p.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory alerts strip */}
      {isAdmin && (
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
          <header className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
            <span className="text-base font-medium tracking-tight text-ink">Inventory alerts</span>
            <Link href="/console/inventory" className="text-xs font-medium text-brand-600 hover:underline hover:underline-offset-2">
              View all →
            </Link>
          </header>
          <div className="divide-y divide-line-subtle">
            {DUMMY_INVENTORY.filter((s) => s.is_low_stock || s.is_expiring_soon).slice(0, 5).map((s) => (
              <div key={s.product.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <p className="min-w-0 truncate text-sm text-ink">{s.product.name}</p>
                <div className="flex shrink-0 items-center gap-2">
                  {s.is_low_stock && <Badge tone="danger">Low stock — {s.total_quantity}</Badge>}
                  {s.is_expiring_soon && !s.is_low_stock && <Badge tone="warning">Expiring soon</Badge>}
                </div>
              </div>
            ))}
            {DUMMY_INVENTORY.filter((s) => s.is_low_stock || s.is_expiring_soon).length === 0 && (
              <p className="px-5 py-4 text-sm text-ink-3">All inventory levels are healthy.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
