'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Box, Eye } from '@/components/icons';
import { EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { ButtonLink } from '@/components/ui/Button';
import { formatNaira, formatDate, cn } from '@/lib/utils';
import type { Order, OrderStatus, PaymentStatus } from '@/types';

const ORDER_STATUS_STYLE: Record<OrderStatus, { bg: string; dot: string; text: string; label: string }> = {
  pending:    { bg: 'bg-amber-50 border border-amber-200',   dot: 'bg-amber-400',  text: 'text-amber-800',  label: 'Pending'    },
  confirmed:  { bg: 'bg-blue-50 border border-blue-200',     dot: 'bg-blue-500',   text: 'text-blue-800',   label: 'Confirmed'  },
  processing: { bg: 'bg-indigo-50 border border-indigo-200', dot: 'bg-indigo-500', text: 'text-indigo-800', label: 'Processing' },
  dispatched: { bg: 'bg-teal-50 border border-teal-200',     dot: 'bg-teal-500',   text: 'text-teal-800',   label: 'Dispatched' },
  delivered:  { bg: 'bg-green-50 border border-green-200',   dot: 'bg-green-500',  text: 'text-green-800',  label: 'Delivered'  },
  cancelled:  { bg: 'bg-red-50 border border-red-200',       dot: 'bg-red-400',    text: 'text-red-800',    label: 'Cancelled'  },
};

const PAYMENT_STATUS_STYLE: Record<PaymentStatus, { bg: string; text: string; label: string }> = {
  unpaid:   { bg: 'bg-orange-50 border border-orange-200',   text: 'text-orange-800', label: 'Unpaid'   },
  partial:  { bg: 'bg-yellow-50 border border-yellow-200',   text: 'text-yellow-800', label: 'Partial'  },
  paid:     { bg: 'bg-emerald-50 border border-emerald-200', text: 'text-emerald-800',label: 'Paid'     },
  refunded: { bg: 'bg-purple-50 border border-purple-200',   text: 'text-purple-800', label: 'Refunded' },
  failed:   { bg: 'bg-red-50 border border-red-200',         text: 'text-red-800',    label: 'Failed'   },
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS_STYLE[status] ?? ORDER_STATUS_STYLE.pending;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', s.bg, s.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUS_STYLE[status] ?? PAYMENT_STATUS_STYLE.unpaid;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', s.bg, s.text)}>
      {s.label}
    </span>
  );
}

type Tab = 'all' | 'pending' | 'processing' | 'dispatch' | 'delivered' | 'cancelled';

const TABS: { value: Tab; label: string }[] = [
  { value: 'all',        label: 'All' },
  { value: 'pending',    label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'dispatch',   label: 'In Transit' },
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
      {/* Stats strip — mirrors the order flow: Total → Pending → In Transit → Delivered */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total orders',  value: orders.length,                                                                              color: 'text-ink'       },
          { label: 'Pending',       value: orders.filter((o) => o.status === 'pending' || o.status === 'confirmed').length,            color: 'text-amber-600' },
          { label: 'In transit',    value: orders.filter((o) => o.status === 'dispatched').length,                                     color: 'text-teal-600'  },
          { label: 'Delivered',     value: orders.filter((o) => o.status === 'delivered').length,                                      color: 'text-green-600' },
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
              : `No ${tab === 'dispatch' ? 'in-transit' : tab} orders found.`
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
                <Th align="right">View</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((o) => (
                <Tr key={o.id}>
                  <Td>
                    <span className="font-mono text-xs font-medium text-ink">{o.order_number}</span>
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
                    <OrderStatusBadge status={o.status} />
                  </Td>
                  <Td>
                    <PaymentStatusBadge status={o.payment_status} />
                  </Td>
                  <Td right num>{formatNaira(o.total_amount)}</Td>
                  <Td right>
                    <Link
                      href={`/portal/orders/${o.id}`}
                      className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:border-teal-300 hover:text-teal-700 transition-colors"
                    >
                      <Eye size={12} />
                      View
                    </Link>
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
