import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import {
  TrendingUp,
  Box,
  Building,
  CreditCard,
  Truck,
  AlertTriangle,
} from '@/components/icons';

export default async function ConsoleOverviewPage() {
  const session = await getSession();
  if (session?.role === 'driver') redirect('/console/driver');
  const isAdmin = session?.role === 'admin';

  const kpis = isAdmin
    ? [
        { label: 'Revenue (mtd)',     Icon: CreditCard },
        { label: 'Orders',            Icon: Box },
        { label: 'Active customers',  Icon: Building },
        { label: 'Low-stock SKUs',    Icon: AlertTriangle },
      ]
    : [
        { label: 'My customers',      Icon: Building },
        { label: 'Orders this month', Icon: Box },
        { label: 'In transit',        Icon: Truck },
        { label: 'Onboarding queue',  Icon: Building },
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
          <div key={k.label} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                {k.label}
              </span>
              <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-50 text-brand-600">
                <k.Icon size={14} />
              </span>
            </div>
            <div className="num font-display text-3xl tracking-tight leading-none text-ink-3">—</div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-4">
              <TrendingUp size={12} />
              No data yet
            </span>
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
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Box size={28} className="text-ink-4" />
            <p className="text-sm font-medium text-ink-3">No orders yet</p>
            <p className="text-xs text-ink-4">Orders will appear here once customers place them.</p>
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
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Box size={28} className="text-ink-4" />
            <p className="text-sm font-medium text-ink-3">No sales data yet</p>
            <p className="text-xs text-ink-4">Top-selling products will appear here.</p>
          </div>
        </div>
      </div>
    </>
  );
}
