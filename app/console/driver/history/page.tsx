/**
 * Driver Portal — Delivery History
 * Full list of all past deliveries for the logged-in driver.
 */

'use client';

import { useMemo, useState } from 'react';
import { Search, Truck } from '@/components/icons';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { PageHead } from '@/components/shared/PageHead';
import { DELIVERIES, ORDERS, CUSTOMERS } from '@/lib/data/operational';
import { DELIVERY_STATUS_LABEL, DELIVERY_STATUS_TONE } from '@/lib/constants';
import { formatDate, formatNaira } from '@/lib/utils';
import { cn } from '@/lib/utils';

const DEMO_DRIVER_ID = 1; // Replace with session.driver_id in production

const TABS = [
  { value: 'all',       label: 'All' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed',    label: 'Failed' },
];

export default function DriverHistoryPage() {
  const [tab, setTab] = useState<string>('all');
  const [query, setQuery] = useState('');

  // In production: filter DELIVERIES by session.driver_id from server
  const myDeliveries = DELIVERIES.filter((d) => d.driver_id === DEMO_DRIVER_ID);

  const filtered = useMemo(() => {
    return myDeliveries
      .filter((d) => {
        if (tab !== 'all' && d.status !== tab) return false;
        const q = query.trim().toLowerCase();
        if (!q) return true;
        const order = ORDERS.find((o) => o.id === d.order_id);
        const cust = order ? CUSTOMERS.find((c) => c.id === order.customer_id) : null;
        return (
          d.tracking_code.toLowerCase().includes(q) ||
          (cust?.company_name ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
  }, [tab, query, myDeliveries]);

  const stats = {
    total: myDeliveries.length,
    delivered: myDeliveries.filter((d) => d.status === 'delivered').length,
    failed: myDeliveries.filter((d) => d.status === 'failed').length,
  };

  return (
    <>
      <PageHead title="Delivery history" subtitle="All your past deliveries." />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total deliveries', value: stats.total },
          { label: 'Completed', value: stats.delivered },
          { label: 'Failed / returned', value: stats.failed },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{s.label}</div>
            <div className="num mt-1 font-display text-2xl tracking-tight text-ink">{s.value}</div>
          </div>
        ))}
      </div>

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
            placeholder="Search by tracking or customer"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Truck size={24} />} title="No deliveries found" description="Adjust the filter or search." />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Tracking</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th>Value</Th>
                <Th>Completed</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((d) => {
                const order = ORDERS.find((o) => o.id === d.order_id);
                const cust = order ? CUSTOMERS.find((c) => c.id === order.customer_id) : null;
                const tone = DELIVERY_STATUS_TONE[d.status] as 'neutral' | 'info' | 'success' | 'warning' | 'danger';
                return (
                  <Tr key={d.id}>
                    <Td>
                      <span className="font-mono text-xs text-ink-2">{d.tracking_code}</span>
                    </Td>
                    <Td>{cust?.company_name ?? '—'}</Td>
                    <Td>
                      <Badge tone={tone} noDot>{DELIVERY_STATUS_LABEL[d.status]}</Badge>
                    </Td>
                    <Td num>{order ? formatNaira(order.total_amount) : '—'}</Td>
                    <Td muted>{formatDate(d.updated_at)}</Td>
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
