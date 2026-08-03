/**
 * Admin Overview — live KPIs + recent orders, streamed with Suspense.
 *
 * Shell (header + skeleton cards) renders in ~100 ms.
 * Data streams in from the 2-minute cached DB fetch.
 * On a cache hit the whole page is ready in < 50 ms.
 */

import { Suspense }   from 'react';
import { redirect }   from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead }   from '@/components/shared/PageHead';
import { getDashboardKpis, getRecentOrders } from '@/lib/data/dashboard.server';
import {
  TrendingUp, Box, Building, CreditCard,
  Truck, AlertTriangle, Users, CheckCircle,
} from '@/components/icons';
import { formatNaira, formatDate } from '@/lib/utils';
import { Badge }     from '@/components/ui/Primitives';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/lib/constants';
import { db }        from '@/lib/db';

export const metadata = { title: 'Overview' };

// ─── Skeletons ────────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-line bg-white p-5">
      <div className="h-9 w-9 rounded-lg bg-bg-muted" />
      <div className="mt-3 h-7 w-24 rounded bg-bg-muted" />
      <div className="mt-1 h-3 w-20 rounded bg-bg-muted" />
    </div>
  );
}
function FeedSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-5">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-4 w-32 rounded bg-bg-muted" />
          <div className="ml-auto h-4 w-16 rounded bg-bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, hint, Icon, warn = false }: {
  label: string; value: string | number; hint?: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>; warn?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-white p-5 transition-shadow hover:shadow-sm ${warn ? 'border-danger/30 bg-danger/[0.02]' : 'border-line'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${warn ? 'bg-danger/10' : 'bg-bg-subtle'}`}>
          <Icon size={18} className={warn ? 'text-danger' : 'text-ink-3'} />
        </div>
        {hint && <span className="text-xs font-medium text-leaf-600">{hint}</span>}
      </div>
      <div className="num mt-3 font-display text-2xl font-semibold tracking-tight text-ink">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</div>
    </div>
  );
}

// ─── Async server sections (each independently streamed) ─────────────────────

async function KpiGrid() {
  const kpis = await getDashboardKpis();
  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Revenue (MTD)"    value={formatNaira(kpis.revenueThisMonth)} Icon={CreditCard}
               hint={kpis.ordersThisMonth > 0 ? `${kpis.ordersThisMonth} orders` : undefined} />
      <KpiCard label="Active customers" value={kpis.totalCustomers}  Icon={Building} />
      <KpiCard label="Active products"  value={kpis.activeProducts}  Icon={Box} />
      <KpiCard label="Low-stock SKUs"   value={kpis.lowStockSkus}    Icon={AlertTriangle} warn={kpis.lowStockSkus > 0} />
    </div>
  );
}

async function RecentOrdersFeed() {
  const orders = await getRecentOrders(8);
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-14 text-center">
        <Box size={24} className="text-ink-4" />
        <p className="text-sm font-medium text-ink-3">No orders yet</p>
        <p className="text-xs text-ink-4">Orders appear here once customers start placing them.</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-line-subtle">
      {orders.map((o: any) => {
        const name  = o.customer?.company_name
          || (`${o.customer?.user?.first_name ?? ''} ${o.customer?.user?.last_name ?? ''}`.trim() || '—');
        const sk = (o.status as string).toUpperCase() as keyof typeof ORDER_STATUS_LABEL;
        return (
          <a key={o.id} href={`/admin/orders/${o.id}`}
            className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-bg-subtle">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-xs font-semibold text-ink">{o.order_number}</p>
              <p className="mt-0.5 truncate text-[11px] text-ink-3">{name}</p>
            </div>
            <Badge tone={ORDER_STATUS_TONE[sk] ?? 'neutral'}>{ORDER_STATUS_LABEL[sk] ?? o.status}</Badge>
            <p className="num shrink-0 text-sm font-semibold text-ink">{formatNaira(Number(o.total))}</p>
          </a>
        );
      })}
    </div>
  );
}

async function PendingReviewFeed() {
  try {
    const customers = await db.customer.findMany({
      where: { status: 'PENDING_REVIEW' }, take: 8, orderBy: { created_at: 'desc' },
      select: { id: true, company_name: true, created_at: true,
        user: { select: { first_name: true, last_name: true, email: true } } },
    });
    if (customers.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-14 text-center">
          <CheckCircle size={24} className="text-leaf-500" />
          <p className="text-sm font-medium text-ink-3">All reviews up to date</p>
        </div>
      );
    }
    return (
      <div className="divide-y divide-line-subtle">
        {customers.map((c) => (
          <a key={c.id} href={`/admin/customers/${c.id}`}
            className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-bg-subtle">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">
                {c.company_name ?? `${c.user.first_name} ${c.user.last_name}`}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-ink-3">{c.user.email}</p>
            </div>
            <span className="shrink-0 text-[10px] text-ink-4">{formatDate(c.created_at.toISOString())}</span>
          </a>
        ))}
      </div>
    );
  } catch {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <AlertTriangle size={20} className="text-ink-4" />
        <p className="text-xs text-ink-4">Could not load data</p>
      </div>
    );
  }
}

async function QuickStats() {
  const kpis = await getDashboardKpis();
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {([
        { label: 'Pending orders',    value: kpis.pendingOrders,    Icon: Box,        href: '/admin/orders'     },
        { label: 'Active deliveries', value: kpis.activeDeliveries, Icon: Truck,      href: '/admin/deliveries' },
        { label: 'Awaiting review',   value: kpis.pendingReview,    Icon: Users,      href: '/admin/customers'  },
        { label: 'Orders this month', value: kpis.ordersThisMonth,  Icon: TrendingUp, href: '/admin/reports'    },
      ] as const).map(({ label, value, Icon, href }) => (
        <a key={label} href={href}
          className="flex items-center gap-4 rounded-xl border border-line bg-white p-4 transition-all hover:border-brand-300 hover:shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-subtle">
            <Icon size={18} className="text-ink-3" />
          </div>
          <div>
            <div className="num font-display text-lg font-semibold text-ink">{value}</div>
            <div className="text-xs text-ink-3">{label}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminOverviewPage() {
  const session = await getSession();
  if (session?.role === 'DRIVER') redirect('/driver');

  return (
    <>
      <PageHead
        title={`Welcome back, ${session?.first_name ?? 'Admin'}.`}
        subtitle="Here's what's happening today."
      />

      <Suspense fallback={
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <KpiSkeleton key={i} />)}
        </div>
      }>
        <KpiGrid />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Recent orders</h2>
            <a href="/admin/orders" className="text-xs font-medium text-brand-600 hover:underline">View all →</a>
          </div>
          <Suspense fallback={<FeedSkeleton />}><RecentOrdersFeed /></Suspense>
        </section>

        <section className="rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Pending customer review</h2>
            <a href="/admin/customers" className="text-xs font-medium text-brand-600 hover:underline">View all →</a>
          </div>
          <Suspense fallback={<FeedSkeleton />}><PendingReviewFeed /></Suspense>
        </section>
      </div>

      <Suspense fallback={
        <div className="mt-6 grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-[72px] rounded-xl border border-line bg-white" />)}
        </div>
      }>
        <QuickStats />
      </Suspense>
    </>
  );
}
