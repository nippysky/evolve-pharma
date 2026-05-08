'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, Truck } from '@/components/icons';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { PageHead } from '@/components/shared/PageHead';
import { DELIVERIES, ORDERS, CUSTOMERS } from '@/lib/data/operational';
import { DELIVERY_STATUS_LABEL } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { DeliveryStatus } from '@/types';
import { cn } from '@/lib/utils';

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand' | 'accent';

const STATUS_TONE: Record<DeliveryStatus, BadgeTone> = {
  awaiting_dispatch: 'neutral',
  in_transit: 'info',
  out_for_delivery: 'brand',
  delivered: 'success',
  failed: 'danger',
  returned: 'warning',
};

const TABS = [
  { value: 'all' as const, label: 'All' },
  { value: 'in_transit' as const, label: 'In transit' },
  { value: 'out_for_delivery' as const, label: 'Out for delivery' },
  { value: 'delivered' as const, label: 'Delivered' },
];

export default function ConsoleDeliveriesPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return DELIVERIES.filter((d) => {
      if (tab !== 'all' && d.status !== tab) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const order = ORDERS.find((o) => o.id === d.order_id);
      const cust = order ? CUSTOMERS.find((c) => c.id === order.customer_id) : null;
      return (
        d.tracking_code.toLowerCase().includes(q) ||
        (cust?.company_name ?? '').toLowerCase().includes(q) ||
        (d.driver_name ?? '').toLowerCase().includes(q)
      );
    }).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [tab, query]);

  return (
    <>
      <PageHead title="Deliveries" subtitle="Active and recent shipments." />

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
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((d) => {
                const order = ORDERS.find((o) => o.id === d.order_id);
                const cust = order ? CUSTOMERS.find((c) => c.id === order.customer_id) : null;
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
                    <Td muted>{d.driver_name ?? '—'}</Td>
                    <Td muted>{d.vehicle_plate ?? '—'}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[d.status]} noDot>
                        {DELIVERY_STATUS_LABEL[d.status]}
                      </Badge>
                    </Td>
                    <Td muted>{d.estimated_arrival ? formatDate(d.estimated_arrival) : '—'}</Td>
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
