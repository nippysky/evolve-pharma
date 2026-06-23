/**
 * Driver Portal — My Assignments
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { Truck } from '@/components/icons';

export const metadata = { title: 'My Assignments' };

export default async function DriverAssignmentsPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role !== 'driver') redirect('/console/overview');

  return (
    <>
      <PageHead
        title={`Hi, ${session.full_name.split(' ')[0]}.`}
        subtitle="Your current delivery assignments."
      />

      {/* KPI strip */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {['Total deliveries', 'Active now', 'Rating'].map((label) => (
          <div key={label} className="rounded-xl border border-line bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</div>
            <div className="num mt-1 font-display text-2xl tracking-tight text-ink-3">—</div>
          </div>
        ))}
      </div>

      {/* Active assignments */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-ink-3">
        Active assignments
      </h2>
      <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center">
        <Truck size={24} className="mx-auto mb-2 text-ink-4" />
        <p className="text-sm font-medium text-ink-3">No active assignments</p>
        <p className="mt-1 text-xs text-ink-4">Deliveries assigned to you will appear here.</p>
      </div>

      <div className="mt-6 flex justify-end">
        <Link href="/console/driver/history" className="text-xs font-medium text-brand-600 hover:underline">
          View delivery history →
        </Link>
      </div>
    </>
  );
}
