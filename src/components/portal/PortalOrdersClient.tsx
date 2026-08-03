'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Box, MapPin } from '@/components/icons';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { ButtonLink } from '@/components/ui/Button';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
} from '@/lib/constants';
import { formatNaira, formatDate, cn } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types';

type Tab = 'all' | 'pending' | 'processing' | 'dispatch' | 'delivered' | 'cancelled';

const TABS: { value: Tab; label: string }[] = [
  { value: 'all',        label: 'All' },
  { value: 'pending',    label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'dispatch',   label: 'Dispatch' },
  { value: 'delivered',  label: 'Delivered' },
  { value: 'cancelled',  label: 'Cancelled' },
];

const TAB_STATUSES: Partial<Record<Tab, OrderStatus[]>> = {
  pending:    ['pending', 'confirmed'],
  processing: ['processing'],
  dispatch:   ['dispatched'],
  delivered:  ['delivered'],
  cancelled:  ['cancelled'],
};

interface Props {
  orders: Order[];
}

export function PortalOrdersClient({ orders }: Props) {
  const [tab,   setTab]   = useState<Tab>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const statuses = TAB_STATUSES[tab];
    const q        = query.trim().toLowerCase();
    return orders
      .filter((o) => !statuses || statuses.includes(o.status))
      .filter((o) => {
        if (!q) return true;
        return (
          o.order_number.toLowerCase().includes(q) ||
          o.items.some((i) => i.product_name.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [orders, tab, query]);

  const countFor = (t: Tab) => {
    const statuses = TAB_STATUSES[t];
    if (!statuses) return orders.length;
    return orders.filter((o) => statuses.includes(o.status)).length;
  };

  return (
    <>
      {/* Stats strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total orders',  value: orders.length,                                             color: 'text-ink' },
          { label: 'In transit',    value: orders.filter((o) => o.status === 'dispatched').length,    color: 'text-blue-600' },
          { label: 'Processing',    value: orders.filter((o) => o.status === 'processing').length,    color: 'text-amber-600' },
          { label: 'Delivered',     value: orders.filter((o) => o.status === 'delivered').length,     color: 'text-teal-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-line bg-white px-4 py-3.5">
            <p className="text-xs font-medium text-ink-3">{label}</p>
            <p className={cn('num mt-1 text-2xl font-semibold tracking-tight', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + search */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="inline-flex flex-wrap rounded-lg bg-bg-muted p-1">
          {TABS.map((t) => {
            const count = countFor(t.value);
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === t.value ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
                )}
              >
                {t.label}
                {count > 0 && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                    tab === t.value ? 'bg-teal-100 text-teal-700' : 'bg-ink-subtle text-ink-3',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by order # or product"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-teal-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Box size={24} />}
          title={tab === 'all' ? 'No orders yet' : `No ${tab} orders`}
          description={
            tab === 'all'
              ? "When you place orders, they'll show up here."
              : `No ${tab === 'dispatch' ? 'dispatched' : tab} orders found.`
          }
          action={tab === 'all' ? <ButtonLink href="/portal/catalog">Browse catalogue</ButtonLink> : undefined}
        />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Order #</Th>
                <Th>Items</Th>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th align="right">Total</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((o) => (
                <Tr key={o.id}>
                  <Td>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs font-medium text-ink">{o.order_number}</span>
                      {o.notes && (
                        <span className="flex items-center gap-1 text-[11px] text-ink-3">
                          <MapPin size={10} />
                          {String(o.notes).split(',').slice(-2).join(',').trim()}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <Box size={13} className="text-ink-3" />
                      <span className="text-sm text-ink-2">
                        {o.items.length} {o.items.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-4">
                      {o.items.map((i) => i.product_name).join(', ')}
                    </p>
                  </Td>
                  <Td muted>{formatDate(o.created_at)}</Td>
                  <Td>
                    <Badge tone={ORDER_STATUS_TONE[o.status.toUpperCase() as keyof typeof ORDER_STATUS_TONE] ?? 'neutral'}>
                      {ORDER_STATUS_LABEL[o.status.toUpperCase() as keyof typeof ORDER_STATUS_LABEL] ?? o.status}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={PAYMENT_STATUS_TONE[o.payment_status.toUpperCase() as keyof typeof PAYMENT_STATUS_TONE] ?? 'neutral'} noDot>
                      {PAYMENT_STATUS_LABEL[o.payment_status.toUpperCase() as keyof typeof PAYMENT_STATUS_LABEL] ?? o.payment_status}
                    </Badge>
                  </Td>
                  <Td right num>{formatNaira(o.total_amount)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
