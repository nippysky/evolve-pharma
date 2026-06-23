/**
 * Console · Drivers (admin-only)
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { EmptyState } from '@/components/ui/Primitives';
import { Truck } from '@/components/icons';
import { DriversActions } from '@/components/console/DriversActions';

export const metadata = { title: 'Drivers' };

export default async function ConsoleDriversPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'admin') redirect('/console/overview');

  return (
    <>
      <PageHead
        title="Drivers"
        subtitle="Manage delivery drivers across all regions."
        actions={<DriversActions />}
      />

      {/* Summary cards */}
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {['Total drivers', 'Active', 'Available now', 'Pending setup'].map((label) => (
          <div key={label} className="rounded-xl border border-line bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</div>
            <div className="num mt-1 font-display text-2xl tracking-tight text-ink">0</div>
          </div>
        ))}
      </div>

      <EmptyState
        icon={<Truck size={24} />}
        title="No drivers yet"
        description="Add your first driver to get started."
      />
    </>
  );
}
