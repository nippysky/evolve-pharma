/**
 * Console · Drivers (admin-only)
 *
 * Admin can view all drivers, their status, vehicle info, region,
 * delivery count and rating. Onboard new drivers via the modal or bulk import.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { Badge, Avatar, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Truck, Mail, Calendar } from '@/components/icons';
import { DriversActions } from '@/components/console/DriversActions';
import { DRIVERS, DRIVER_STATUS_LABEL } from '@/lib/data/drivers';
import { DELIVERIES } from '@/lib/data/operational';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Drivers' };

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  available:    'success',
  on_delivery:  'info',
  off_duty:     'neutral',
  suspended:    'danger',
};

export default async function ConsoleDriversPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'admin') redirect('/console/overview');

  const totals = {
    total:     DRIVERS.length,
    active:    DRIVERS.filter((d) => d.driver_status === 'available' || d.driver_status === 'on_delivery').length,
    available: DRIVERS.filter((d) => d.driver_status === 'available').length,
    pending:   DRIVERS.filter((d) => d.user.status === 'pending').length,
  };

  const rows = DRIVERS.map((driver) => {
    const deliveryCount = DELIVERIES.filter((d) => d.driver_id === driver.id).length;
    return { driver, deliveryCount };
  });

  return (
    <>
      <PageHead
        title="Drivers"
        subtitle="Manage delivery drivers across all regions."
        actions={<DriversActions />}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <StatCard label="Total drivers"  value={totals.total}     />
        <StatCard label="Active"         value={totals.active}    />
        <StatCard label="Available now"  value={totals.available} />
        <StatCard label="Pending setup"  value={totals.pending}   />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Truck size={24} />}
          title="No drivers yet"
          description="Add your first driver to get started."
        />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Driver</Th>
                <Th>Contact</Th>
                <Th>Vehicle</Th>
                <Th>Region</Th>
                <Th>Status</Th>
                <Th align="right">Deliveries</Th>
                <Th align="right">Rating</Th>
                <Th>Joined</Th>
              </tr>
            </Thead>
            <Tbody>
              {rows.map(({ driver, deliveryCount }) => (
                <Tr key={driver.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${driver.user.fname} ${driver.user.lname}`} />
                      <div>
                        <div className="font-medium text-ink">
                          {driver.user.fname} {driver.user.lname}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-3">Driver #{driver.id}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5 text-sm text-ink">
                      <Mail size={12} className="text-ink-3" />
                      {driver.user.email}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-3">{driver.user.phone}</div>
                  </Td>
                  <Td>
                    <div className="font-mono text-xs text-ink">{driver.vehicle_plate}</div>
                    <div className="mt-0.5 text-xs text-ink-3">{driver.vehicle_type}</div>
                  </Td>
                  <Td muted>{driver.region}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[driver.driver_status] ?? 'neutral'} noDot>
                      {DRIVER_STATUS_LABEL[driver.driver_status]}
                    </Badge>
                  </Td>
                  <Td right num>{driver.total_deliveries}</Td>
                  <Td right num>
                    {driver.rating !== null ? `${driver.rating} ★` : '—'}
                  </Td>
                  <Td muted>
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={11} /> {formatDate(driver.created_at)}
                    </span>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</div>
      <div className="num mt-1 font-display text-2xl tracking-tight text-ink">{value}</div>
    </div>
  );
}
