/**
 * Console · Reports
 * Production data will populate via API integration.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/types';
import {
  TrendingUp,
  Box,
  CreditCard,
  Building,
  Truck,
  Users,
} from '@/components/icons';
import { PageHead } from '@/components/shared/PageHead';
import { EmptyState } from '@/components/ui/Primitives';
import type { SessionUser } from '@/types';

async function getSessionWithPermCheck(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role === 'CUSTOMER') redirect('/portal/catalog');
  if (session.role === 'DRIVER') redirect('/driver');
  if (!hasPermission(session, 'view_reports')) redirect('/admin/overview');
  return session;
}

export const metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const session = await getSessionWithPermCheck();
  const isAdmin = session.role === 'ADMIN';

  const kpis = [
    { label: 'Total revenue',    Icon: CreditCard },
    { label: 'Orders',           Icon: Box },
    { label: 'Avg. order value', Icon: Building },
    { label: 'Active shipments', Icon: Truck },
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
            <div className="num font-display text-3xl tracking-tight leading-none text-ink-3">—</div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-4">
              <TrendingUp size={12} />
              No data yet
            </span>
          </div>
        ))}
      </div>

      {/* Main content area */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Top customers */}
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <header className="border-b border-line-subtle px-5 py-4 text-base font-medium tracking-tight text-ink">
            Top customers by spend
          </header>
          <EmptyState
            icon={<Building size={22} />}
            title="No customer data yet"
            description="Customer spend rankings will appear here."
          />
        </div>

        {/* Revenue by category */}
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <header className="border-b border-line-subtle px-5 py-4 text-base font-medium tracking-tight text-ink">
            Revenue by category
          </header>
          <EmptyState
            icon={<Box size={22} />}
            title="No category data yet"
            description="Category breakdowns will appear here."
          />
        </div>
      </div>

      {/* Top products */}
      <div className="mt-6 overflow-hidden rounded-xl border border-line bg-white">
        <header className="border-b border-line-subtle px-5 py-4 text-base font-medium tracking-tight text-ink">
          Top products by revenue
        </header>
        <EmptyState
          icon={<Box size={22} />}
          title="No product revenue yet"
          description="Top-selling products will appear once orders are placed."
        />
      </div>

      {/* Staff performance (admin only) */}
      {isAdmin && (
        <div className="mt-6 overflow-hidden rounded-xl border border-line bg-white">
          <header className="flex items-center gap-2 border-b border-line-subtle px-5 py-4">
            <Users size={15} className="text-ink-3" />
            <span className="text-base font-medium tracking-tight text-ink">Staff performance</span>
          </header>
          <EmptyState
            icon={<Users size={22} />}
            title="No staff performance data yet"
            description="Staff GMV and onboarding metrics will appear here."
          />
        </div>
      )}
    </>
  );
}
