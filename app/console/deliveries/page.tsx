'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, Truck, Plus } from '@/components/icons';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { PageHead } from '@/components/shared/PageHead';
import { DELIVERIES, ORDERS, CUSTOMERS } from '@/lib/data/operational';
import { DRIVERS } from '@/lib/data/drivers';
import { DELIVERY_STATUS_LABEL, DELIVERY_STATUS_TONE } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { AssignDriverPopover } from './AssignDriverPopover';
import type { DeliveryStatus } from '@/types';
import { cn } from '@/lib/utils';

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand' | 'accent';

const TABS = [
  { value: 'all' as const,              label: 'All' },
  { value: 'awaiting_dispatch' as const, label: 'Awaiting dispatch' },
  { value: 'in_transit' as const,        label: 'In transit' },
  { value: 'out_for_delivery' as const,  label: 'Out for delivery' },
  { value: 'delivered' as const,         label: 'Delivered' },
];

export default function ConsoleDeliveriesPage() {
  const [tab, setTab]     = useState<(typeof TABS)[number]['value']>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return DELIVERIES.filter((d) => {
      if (tab !== 'all' && d.status !== tab) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const order = ORDERS.find((o) => o.id === d.order_id);
      const cust  = order ? CUSTOMERS.find((c) => c.id === order.customer_id) : null;
      return (
        d.tracking_code.toLowerCase().includes(q) ||
        (cust?.company_name ?? '').toLowerCase().includes(q) ||
        (d.driver_name ?? '').toLowerCase().includes(q)
      );
    }).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [tab, query]);

  const counts = {
    unassigned: DELIVERIES.filter((d) => !d.driver_id && d.status === 'awaiting_dispatch').length,
  };

  return (
    <>
      <PageHead
        title="Deliveries"
        subtitle="Active and recent shipments. Assign drivers to unassigned deliveries."
      />

      {/* Unassigned alert */}
      {counts.unassigned > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <Truck size={16} className="shrink-0 text-amber-600" />
          <span className="text-amber-800">
            <span className="font-semibold">{counts.unassigned}</span>{' '}
            {counts.unassigned === 1 ? 'delivery needs' : 'deliveries need'} a driver assigned.
          </span>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="inline-flex flex-wrap rounded-md bg-bg-muted p-0.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                tab === t.value ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by tracking, customer, driver"
            aria-label="Search"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Truck size={24} />} title="No deliveries match" />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Tracking</Th>
                <Th>Customer</Th>
                <Th>Driver</Th>
                <Th>Vehicle</Th>
                <Th>Status</Th>
                <Th>ETA</Th>
                <Th>Ack.</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((d) => {
                const order = ORDERS.find((o) => o.id === d.order_id);
                const cust  = order ? CUSTOMERS.find((c) => c.id === order.customer_id) : null;
                const tone  = (DELIVERY_STATUS_TONE[d.status] ?? 'neutral') as BadgeTone;
                const needsDriver = !d.driver_id && d.status === 'awaiting_dispatch';
                return (
                  <Tr key={d.id}>
                    <Td>
                      <Link
                        href={`/console/orders/${d.order_id}`}
                        className="font-mono text-xs text-ink-2 hover:text-brand-600"
                      >
                        {d.tracking_code}
                      </Link>
                    </Td>
                    <Td>
                      {cust ? (
                        <Link href={`/console/customers/${cust.id}`} className="font-medium text-ink hover:text-brand-600">
                          {cust.company_name}
                        </Link>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </Td>
                    <Td>
                      {needsDriver ? (
                        <AssignDriverPopover deliveryId={d.id} drivers={DRIVERS} />
                      ) : (
                        <span className="text-sm text-ink">{d.driver_name ?? '—'}</span>
                      )}
                    </Td>
                    <Td muted>
                      <span className="font-mono text-xs">{d.vehicle_plate ?? '—'}</span>
                    </Td>
                    <Td>
                      <Badge tone={tone} noDot>
                        {DELIVERY_STATUS_LABEL[d.status]}
                      </Badge>
                    </Td>
                    <Td muted>{d.estimated_arrival ? formatDate(d.estimated_arrival) : '—'}</Td>
                    <Td muted>
                      {d.acknowledged_at ? (
                        <span className="text-xs text-leaf-600">✓ {formatDate(d.acknowledged_at)}</span>
                      ) : (
                        <span className="text-xs text-ink-4">Pending</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
