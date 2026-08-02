/**
 * Admin — Overview
 * KPIs and recent activity. Live data wired in Module 4.
 */

import { redirect }   from 'next/navigation';
import { getSession }  from '@/lib/auth';
import { PageHead }    from '@/components/shared/PageHead';
import {
  TrendingUp, Box, Building, CreditCard, Truck, AlertTriangle,
} from '@/components/icons';
import { formatNaira } from '@/lib/utils';

export const metadata = { title: 'Overview' };

function KpiCard({
  label, value, hint, Icon, warn = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-white p-5 ${warn ? 'border-danger/30' : 'border-line'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-subtle">
          <Icon size={18} className={warn ? 'text-danger' : 'text-ink-3'} />
        </div>
        {hint && <span className="text-xs font-medium text-leaf-600">{hint}</span>}
      </div>
      <div className="num mt-3 font-display text-2xl font-semibold tracking-tight text-ink">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        {label}
      </div>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const session = await getSession();
  if (session?.role === 'DRIVER') redirect('/driver');

  return (
    <>
      <PageHead
        title={`Welcome back, ${session?.first_name ?? 'Admin'}.`}
        subtitle="Here's what's happening today."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Revenue (MTD)"     value={formatNaira(0)} Icon={CreditCard}    hint="Live in Module 4" />
        <KpiCard label="Orders this month" value="—"              Icon={Box} />
        <KpiCard label="Active customers"  value="—"              Icon={Building} />
        <KpiCard label="Low-stock SKUs"    value="—"              Icon={AlertTriangle} warn />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Recent orders</h2>
            <a href="/admin/orders" className="text-xs font-medium text-brand-600 hover:underline">View all →</a>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <Box size={24} className="text-ink-4" />
            <p className="text-sm font-medium text-ink-3">No orders yet</p>
            <p className="text-xs text-ink-4">Orders will appear here once data is available.</p>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Low-stock alerts</h2>
            <a href="/admin/inventory" className="text-xs font-medium text-brand-600 hover:underline">View inventory →</a>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <AlertTriangle size={24} className="text-ink-4" />
            <p className="text-sm font-medium text-ink-3">All stock levels healthy</p>
            <p className="text-xs text-ink-4">Low-stock products will appear here.</p>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {([
          { label: 'Pending deliveries', icon: Truck,      href: '/admin/deliveries' },
          { label: 'Active products',    icon: Box,        href: '/admin/products'   },
          { label: 'Growth (MoM)',       icon: TrendingUp, href: '/admin/reports'    },
        ] as const).map(({ label, icon: Icon, href }) => (
          <a key={label} href={href}
            className="flex items-center gap-4 rounded-xl border border-line bg-white p-4 transition-all hover:border-brand-300 hover:shadow-sm"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-subtle">
              <Icon size={18} className="text-ink-3" />
            </div>
            <div>
              <div className="num font-display text-lg font-semibold text-ink">—</div>
              <div className="text-xs text-ink-3">{label}</div>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
