'use client';

import { useState, useMemo } from 'react';
import { Search, Box, Download } from '@/components/icons';
import { Badge } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { PageHead } from '@/components/shared/PageHead';
import { cn, formatNaira, formatDate } from '@/lib/utils';
import { DUMMY_CONSOLE_ORDERS } from '@/lib/data/dummy-console';

const STATUS_FILTERS = [
  { value: 'all',        label: 'All' },
  { value: 'pending',    label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered',  label: 'Delivered' },
  { value: 'cancelled',  label: 'Cancelled' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';

function orderBadge(status: string): { label: string; tone: BadgeTone } {
  const map: Record<string, { label: string; tone: BadgeTone }> = {
    pending:    { label: 'Pending',    tone: 'warning' },
    confirmed:  { label: 'Confirmed',  tone: 'info' },
    processing: { label: 'Processing', tone: 'info' },
    dispatched: { label: 'Dispatched', tone: 'brand' },
    delivered:  { label: 'Delivered',  tone: 'success' },
    cancelled:  { label: 'Cancelled',  tone: 'danger' },
  };
  return map[status] ?? { label: status, tone: 'neutral' };
}

function paymentBadge(status: string): { label: string; tone: BadgeTone } {
  const map: Record<string, { label: string; tone: BadgeTone }> = {
    paid:     { label: 'Paid',     tone: 'success' },
    unpaid:   { label: 'Unpaid',   tone: 'warning' },
    partial:  { label: 'Partial',  tone: 'info' },
    refunded: { label: 'Refunded', tone: 'neutral' },
    failed:   { label: 'Failed',   tone: 'danger' },
  };
  return map[status] ?? { label: status, tone: 'neutral' };
}

export default function ConsoleOrdersPage() {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery]   = useState('');

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return DUMMY_CONSOLE_ORDERS.filter((o) => {
      const matchStatus = filter === 'all' || o.status === filter;
      const matchQuery  = !q ||
        o.order_number.toLowerCase().includes(q) ||
        (o.customer_company ?? '').toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [filter, query]);

  return (
    <>
      <PageHead
        title="Orders"
        subtitle="Every order across all customers and statuses."
        actions={
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Download size={14} />}
            disabled
          >
            Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="inline-flex flex-wrap rounded-md bg-bg-muted p-0.5">
          {STATUS_FILTERS.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                filter === t.value ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
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
            placeholder="Search by order # or customer"
            aria-label="Search orders"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-bg-muted text-ink-3">
            <Box size={24} />
          </span>
          <span className="display-serif text-xl text-ink">No orders found</span>
          <span className="text-sm text-ink-2">Try adjusting your search or filter.</span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-subtle bg-bg-subtle text-left">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Order</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Customer</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Items</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Total</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Status</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Payment</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {visible.map((o) => {
                  const ob = orderBadge(o.status);
                  const pb = paymentBadge(o.payment_status);
                  return (
                    <tr key={o.id} className="group hover:bg-bg-subtle/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="num font-mono text-sm font-medium text-ink">{o.order_number}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-ink">{o.customer_name}</p>
                        <p className="text-xs text-ink-3">{o.customer_company}</p>
                      </td>
                      <td className="px-5 py-3.5 text-ink-2">{o.items.length} item{o.items.length !== 1 ? 's' : ''}</td>
                      <td className="px-5 py-3.5">
                        <span className="num font-medium text-ink">{formatNaira(o.total_amount)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={ob.tone}>{ob.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={pb.tone}>{pb.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-ink-3">{formatDate(o.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line-subtle bg-bg-subtle px-5 py-3 text-xs text-ink-3">
            Showing {visible.length} of {DUMMY_CONSOLE_ORDERS.length} orders
          </div>
        </div>
      )}
    </>
  );
}
