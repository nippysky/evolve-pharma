'use client';

import { useState, useMemo } from 'react';
import { Search, Truck } from '@/components/icons';
import { Badge } from '@/components/ui/Primitives';
import { PageHead } from '@/components/shared/PageHead';
import { cn, formatDate } from '@/lib/utils';
import { DUMMY_DELIVERIES, DUMMY_CONSOLE_ORDERS } from '@/lib/data/dummy-console';

const TABS = [
  { value: 'all' as const,               label: 'All' },
  { value: 'awaiting_dispatch' as const,  label: 'Awaiting dispatch' },
  { value: 'in_transit' as const,         label: 'In transit' },
  { value: 'out_for_delivery' as const,   label: 'Out for delivery' },
  { value: 'delivered' as const,          label: 'Delivered' },
];

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';

function deliveryBadge(status: string): { label: string; tone: BadgeTone } {
  const map: Record<string, { label: string; tone: BadgeTone }> = {
    awaiting_dispatch:  { label: 'Awaiting dispatch',  tone: 'warning' },
    assigned:           { label: 'Assigned',           tone: 'info' },
    in_transit:         { label: 'In transit',         tone: 'brand' },
    out_for_delivery:   { label: 'Out for delivery',   tone: 'brand' },
    delivered:          { label: 'Delivered',          tone: 'success' },
    failed:             { label: 'Failed',             tone: 'danger' },
    returned:           { label: 'Returned',           tone: 'neutral' },
  };
  return map[status] ?? { label: status, tone: 'neutral' };
}

// Build a lookup: order_id → order_number + customer
const ORDER_LOOKUP = Object.fromEntries(
  DUMMY_CONSOLE_ORDERS.map((o) => [
    o.id,
    { number: o.order_number, company: o.customer_company ?? o.customer_name },
  ]),
);

export default function ConsoleDeliveriesPage() {
  const [tab, setTab]     = useState<(typeof TABS)[number]['value']>('all');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return DUMMY_DELIVERIES.filter((d) => {
      const matchTab   = tab === 'all' || d.status === tab;
      const orderInfo  = ORDER_LOOKUP[d.order_id];
      const matchQuery = !q ||
        d.tracking_code.toLowerCase().includes(q) ||
        (d.driver_name ?? '').toLowerCase().includes(q) ||
        (orderInfo?.company ?? '').toLowerCase().includes(q) ||
        (orderInfo?.number ?? '').toLowerCase().includes(q);
      return matchTab && matchQuery;
    });
  }, [tab, query]);

  return (
    <>
      <PageHead
        title="Deliveries"
        subtitle="Active and recent shipments. Assign drivers to unassigned deliveries."
      />

      {/* Filters */}
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

      {/* Table */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-bg-muted text-ink-3">
            <Truck size={24} />
          </span>
          <span className="display-serif text-xl text-ink">No deliveries found</span>
          <span className="text-sm text-ink-2">Try adjusting your search or filter.</span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-subtle bg-bg-subtle text-left">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Tracking</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Order</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Status</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Driver</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Vehicle</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">ETA</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {visible.map((d) => {
                  const b = deliveryBadge(d.status);
                  const orderInfo = ORDER_LOOKUP[d.order_id];
                  return (
                    <tr key={d.id} className="hover:bg-bg-subtle/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="num font-mono text-sm font-medium text-ink">{d.tracking_code}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-ink">{orderInfo?.number ?? `Order #${d.order_id}`}</p>
                        <p className="text-xs text-ink-3">{orderInfo?.company}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={b.tone}>{b.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        {d.driver_name ? (
                          <>
                            <p className="font-medium text-ink">{d.driver_name}</p>
                            <p className="text-xs text-ink-3">{d.driver_phone}</p>
                          </>
                        ) : (
                          <span className="text-ink-4 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-ink-2">{d.vehicle_plate ?? '—'}</td>
                      <td className="px-5 py-3.5 text-ink-3">
                        {d.estimated_arrival ? formatDate(d.estimated_arrival) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-ink-3">{formatDate(d.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line-subtle bg-bg-subtle px-5 py-3 text-xs text-ink-3">
            Showing {visible.length} of {DUMMY_DELIVERIES.length} deliveries
          </div>
        </div>
      )}
    </>
  );
}
