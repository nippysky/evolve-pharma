/**
 * Driver Portal — My Assignments
 *
 * Shows the driver's current and upcoming delivery assignments.
 * Driver can acknowledge a new assignment and update delivery status.
 * Server-rendered; client components only for interactive bits.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { DELIVERIES, ORDERS, CUSTOMERS } from '@/lib/data/operational';
import { DRIVERS } from '@/lib/data/drivers';
import { PageHead } from '@/components/shared/PageHead';
import { Badge } from '@/components/ui/Primitives';
import { DELIVERY_STATUS_LABEL, DELIVERY_STATUS_TONE } from '@/lib/constants';
import { formatDate, formatNaira } from '@/lib/utils';
import { DriverAssignmentCard } from './DriverAssignmentCard';

export const metadata = { title: 'My Assignments' };

export default async function DriverAssignmentsPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role !== 'driver') redirect('/console/overview');

  const driverId = session.driver_id ?? 1; // fallback for demo
  const driver = DRIVERS.find((d) => d.id === driverId);

  // Split deliveries into active vs history
  const myDeliveries = DELIVERIES.filter((d) => d.driver_id === driverId);
  const active = myDeliveries.filter(
    (d) => d.status !== 'delivered' && d.status !== 'failed' && d.status !== 'returned',
  );
  const recent = myDeliveries
    .filter((d) => d.status === 'delivered' || d.status === 'failed' || d.status === 'returned')
    .slice(0, 3);

  const stats = {
    total: driver?.total_deliveries ?? 0,
    active: active.length,
    rating: driver?.rating ?? null,
  };

  return (
    <>
      <PageHead
        title={`Hi, ${session.full_name.split(' ')[0]}.`}
        subtitle="Your current delivery assignments."
      />

      {/* KPI strip */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Total deliveries</div>
          <div className="num mt-1 font-display text-2xl tracking-tight text-ink">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Active now</div>
          <div className="num mt-1 font-display text-2xl tracking-tight text-ink">{stats.active}</div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Rating</div>
          <div className="num mt-1 font-display text-2xl tracking-tight text-ink">
            {stats.rating !== null ? `${stats.rating} ★` : '—'}
          </div>
        </div>
      </div>

      {/* Active assignments */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-ink-3">
        Active assignments
      </h2>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center text-sm text-ink-3">
          No active assignments right now. Check back soon.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((delivery) => {
            const order = ORDERS.find((o) => o.id === delivery.order_id);
            const customer = order ? CUSTOMERS.find((c) => c.id === order.customer_id) : null;
            return (
              <DriverAssignmentCard
                key={delivery.id}
                delivery={delivery}
                order={order ?? null}
                customer={customer ?? null}
              />
            );
          })}
        </div>
      )}

      {/* Recent completed */}
      {recent.length > 0 && (
        <>
          <div className="mb-3 mt-8 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-3">
              Recently completed
            </h2>
            <Link href="/console/driver/history" className="text-xs font-medium text-brand-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-white divide-y divide-line-subtle">
            {recent.map((delivery) => {
              const order = ORDERS.find((o) => o.id === delivery.order_id);
              const customer = order ? CUSTOMERS.find((c) => c.id === order.customer_id) : null;
              const tone = DELIVERY_STATUS_TONE[delivery.status] as 'neutral' | 'info' | 'success' | 'warning' | 'danger';
              return (
                <div key={delivery.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-ink-3">{delivery.tracking_code}</div>
                    <div className="mt-0.5 truncate text-sm font-medium text-ink">
                      {customer?.company_name ?? '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {order && (
                      <span className="num text-sm text-ink-2">{formatNaira(order.total_amount)}</span>
                    )}
                    <Badge tone={tone} noDot>
                      {DELIVERY_STATUS_LABEL[delivery.status]}
                    </Badge>
                    <span className="text-xs text-ink-4">{formatDate(delivery.updated_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
