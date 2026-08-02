/**
 * Driver Portal — My Assignments
 *
 * Displays active delivery assignments for the authenticated driver.
 * Data is fetched from /api/deliveries?assigned_to=me in Module 5.
 */

import Link          from 'next/link';
import { getSession } from '@/lib/auth';
import { PageHead }   from '@/components/shared/PageHead';
import { EmptyState } from '@/components/ui/Primitives';
import { Truck }      from '@/components/icons';

export const metadata = { title: 'My Assignments' };

export default async function DriverAssignmentsPage() {
  const session = await getSession();

  // Layout handles auth + role gate — this is just a type guard
  if (!session || session.role !== 'DRIVER') return null;

  return (
    <>
      <PageHead
        title={`Hi, ${session.first_name}.`}
        subtitle="Your current delivery assignments."
      />

      {/* KPI strip */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total deliveries', value: '—' },
          { label: 'Active now',       value: '—' },
          { label: 'Rating',           value: '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-line bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
              {label}
            </div>
            <div className="num mt-1 font-display text-2xl tracking-tight text-ink-3">
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Active assignments */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-ink-3">
        Active assignments
      </h2>
      <EmptyState
        icon={<Truck size={24} />}
        title="No active assignments"
        description="Deliveries assigned to you will appear here."
      />

      <div className="mt-6 flex justify-end">
        <Link
          href="/driver/history"
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          View delivery history →
        </Link>
      </div>
    </>
  );
}
