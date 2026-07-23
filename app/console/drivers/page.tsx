/**
 * Console · Drivers (admin-only)
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { Badge } from '@/components/ui/Primitives';
import { DriversActions } from '@/components/console/DriversActions';
import { DUMMY_DRIVERS } from '@/lib/data/dummy-console';

export const metadata = { title: 'Drivers' };

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

function driverBadge(status: string): { label: string; tone: BadgeTone } {
  const map: Record<string, { label: string; tone: BadgeTone }> = {
    available:   { label: 'Available',    tone: 'success' },
    on_delivery: { label: 'On delivery',  tone: 'info' },
    off_duty:    { label: 'Off duty',     tone: 'neutral' },
    suspended:   { label: 'Suspended',    tone: 'danger' },
  };
  return map[status] ?? { label: status, tone: 'neutral' };
}

const available   = DUMMY_DRIVERS.filter((d) => d.driver_status === 'available').length;
const onDelivery  = DUMMY_DRIVERS.filter((d) => d.driver_status === 'on_delivery').length;
const offDuty     = DUMMY_DRIVERS.filter((d) => d.driver_status === 'off_duty').length;

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
        {[
          { label: 'Total drivers',  value: DUMMY_DRIVERS.length },
          { label: 'On delivery',    value: onDelivery },
          { label: 'Available now',  value: available },
          { label: 'Off duty',       value: offDuty },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{s.label}</div>
            <div className="num mt-1 font-display text-2xl tracking-tight text-ink">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Drivers table */}
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-subtle bg-bg-subtle text-left">
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Driver</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Contact</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Vehicle</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Region</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Deliveries</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Rating</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {DUMMY_DRIVERS.map((driver) => {
                const b = driverBadge(driver.driver_status);
                return (
                  <tr key={driver.id} className="hover:bg-bg-subtle/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink">{driver.user.fname} {driver.user.lname}</p>
                      <p className="text-xs text-ink-3">{driver.user.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-ink-2">{driver.user.phone}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-xs font-medium text-ink">{driver.vehicle_plate}</p>
                      <p className="text-xs text-ink-3">{driver.vehicle_type}</p>
                    </td>
                    <td className="px-5 py-3.5 text-ink-2">{driver.region}</td>
                    <td className="px-5 py-3.5">
                      <span className="num text-sm text-ink">{driver.total_deliveries}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {driver.rating != null ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600">
                          ★ {driver.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-ink-4">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={b.tone}>{b.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line-subtle bg-bg-subtle px-5 py-3 text-xs text-ink-3">
          {DUMMY_DRIVERS.length} drivers · {available} available now
        </div>
      </div>
    </>
  );
}
