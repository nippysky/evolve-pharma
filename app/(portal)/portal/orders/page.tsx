'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Box, MapPin } from '@/components/icons';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { ButtonLink } from '@/components/ui/Button';
import { PageHead } from '@/components/shared/PageHead';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
} from '@/lib/constants';
import { formatNaira, formatDate } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types';
import { cn } from '@/lib/utils';

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

/* ── Dummy orders for demo ─────────────────────────────────────────────── */
const DEMO_ORDERS: Order[] = [
  {
    id: 1,
    uuid: 'ord-001',
    order_number: 'EVP-2026-0041',
    customer_id: 1,
    customer_company: 'Greenleaf Pharmacy Ltd.',
    status: 'dispatched',
    payment_status: 'paid',
    total_amount: 87_500,
    notes: '12 Lagos St., Wuse 2, Abuja FCT',
    created_at: '2026-07-21T09:14:22Z',
    updated_at: '2026-07-22T11:00:00Z',
    items: [
      { id: 1, uuid: 'oi-001a', order_id: 1, product_id: 1,  product_name: 'Advant Tab 8mg',      product_sku: 'ADV-TAB-8MG',    quantity: 10, price: 3_500,  subtotal: 35_000, created_at: '2026-07-21T09:14:22Z' },
      { id: 2, uuid: 'oi-001b', order_id: 1, product_id: 5,  product_name: 'Algafen Suspension',  product_sku: 'ALG-SUSP-100ML', quantity: 8,  price: 3_200,  subtotal: 25_600, created_at: '2026-07-21T09:14:22Z' },
      { id: 3, uuid: 'oi-001c', order_id: 1, product_id: 9,  product_name: 'De Deons 150ml',      product_sku: 'DD-150ML',       quantity: 12, price: 2_241,  subtotal: 26_900, created_at: '2026-07-21T09:14:22Z' },
    ],
  },
  {
    id: 2,
    uuid: 'ord-002',
    order_number: 'EVP-2026-0039',
    customer_id: 1,
    customer_company: 'Greenleaf Pharmacy Ltd.',
    status: 'processing',
    payment_status: 'paid',
    total_amount: 54_250,
    notes: '12 Lagos St., Wuse 2, Abuja FCT',
    created_at: '2026-07-19T14:38:00Z',
    updated_at: '2026-07-20T08:45:00Z',
    items: [
      { id: 4, uuid: 'oi-002a', order_id: 2, product_id: 3,  product_name: 'Afrabvite Syrup',    product_sku: 'AFRAB-VIT-SYR',  quantity: 6,  price: 2_800,  subtotal: 16_800, created_at: '2026-07-19T14:38:00Z' },
      { id: 5, uuid: 'oi-002b', order_id: 2, product_id: 7,  product_name: 'Cillinox Drops',     product_sku: 'CILL-DROPS',     quantity: 5,  price: 3_900,  subtotal: 19_500, created_at: '2026-07-19T14:38:00Z' },
      { id: 6, uuid: 'oi-002c', order_id: 2, product_id: 15, product_name: 'Potenza Tablets',    product_sku: 'POT-TAB',        quantity: 6,  price: 2_992,  subtotal: 17_950, created_at: '2026-07-19T14:38:00Z' },
    ],
  },
  {
    id: 3,
    uuid: 'ord-003',
    order_number: 'EVP-2026-0031',
    customer_id: 1,
    customer_company: 'Greenleaf Pharmacy Ltd.',
    status: 'delivered',
    payment_status: 'paid',
    total_amount: 121_000,
    notes: '12 Lagos St., Wuse 2, Abuja FCT',
    created_at: '2026-07-10T10:05:00Z',
    updated_at: '2026-07-14T16:20:00Z',
    items: [
      { id: 7,  uuid: 'oi-003a', order_id: 3, product_id: 6,  product_name: 'Babyrex Syrup',        product_sku: 'BABY-SYR',     quantity: 20, price: 1_980, subtotal: 39_600,  created_at: '2026-07-10T10:05:00Z' },
      { id: 8,  uuid: 'oi-003b', order_id: 3, product_id: 11, product_name: 'Evans Ciprofloxacin',  product_sku: 'EVA-CIPRO',    quantity: 15, price: 3_900, subtotal: 58_500,  created_at: '2026-07-10T10:05:00Z' },
      { id: 9,  uuid: 'oi-003c', order_id: 3, product_id: 18, product_name: 'Tuclox Suspension',    product_sku: 'TUC-SUSP',     quantity: 10, price: 2_290, subtotal: 22_900,  created_at: '2026-07-10T10:05:00Z' },
    ],
  },
  {
    id: 4,
    uuid: 'ord-004',
    order_number: 'EVP-2026-0028',
    customer_id: 1,
    customer_company: 'Greenleaf Pharmacy Ltd.',
    status: 'delivered',
    payment_status: 'paid',
    total_amount: 46_800,
    notes: '12 Lagos St., Wuse 2, Abuja FCT',
    created_at: '2026-06-28T08:20:00Z',
    updated_at: '2026-07-02T13:55:00Z',
    items: [
      { id: 10, uuid: 'oi-004a', order_id: 4, product_id: 4,  product_name: 'Astymin Liquid',       product_sku: 'AST-LIQ',      quantity: 8,  price: 4_500, subtotal: 36_000,  created_at: '2026-06-28T08:20:00Z' },
      { id: 11, uuid: 'oi-004b', order_id: 4, product_id: 13, product_name: 'Histolat Tablets 5mg', product_sku: 'HIST-TAB-5MG', quantity: 12, price: 895,   subtotal: 10_800,  created_at: '2026-06-28T08:20:00Z' },
    ],
  },
];

export default function PortalOrdersPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');

  const myOrders: Order[] = DEMO_ORDERS;

  const filtered = useMemo(() => {
    const statuses = TAB_STATUSES[tab];
    return myOrders
      .filter((o) => {
        if (!statuses) return true;
        return statuses.includes(o.status);
      })
      .filter((o) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
          o.order_number.toLowerCase().includes(q) ||
          o.items.some((i) => i.product_name.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [myOrders, tab, query]);

  const countFor = (t: Tab) => {
    const statuses = TAB_STATUSES[t];
    if (!statuses) return myOrders.length;
    return myOrders.filter((o) => statuses.includes(o.status)).length;
  };

  return (
    <>
      <PageHead title="My orders" subtitle="Track every shipment from confirmation to delivery." />

      {/* Stats strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total orders',  value: myOrders.length,                                          color: 'text-ink' },
          { label: 'In transit',    value: myOrders.filter((o) => o.status === 'dispatched').length, color: 'text-blue-600' },
          { label: 'Processing',    value: myOrders.filter((o) => o.status === 'processing').length, color: 'text-amber-600' },
          { label: 'Delivered',     value: myOrders.filter((o) => o.status === 'delivered').length,  color: 'text-teal-600' },
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
                  tab === t.value
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-ink-2 hover:text-ink',
                )}
              >
                {t.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                      tab === t.value ? 'bg-teal-100 text-teal-700' : 'bg-ink-subtle text-ink-3',
                    )}
                  >
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
            aria-label="Search orders"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-teal-400 focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Box size={24} />}
          title="No orders to show"
          description={
            tab === 'all'
              ? "When you place orders, they'll show up here."
              : `No ${tab === 'dispatch' ? 'dispatched' : tab} orders yet.`
          }
          action={
            tab === 'all'
              ? <ButtonLink href="/portal/catalog">Browse catalogue</ButtonLink>
              : undefined
          }
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
                      <span className="font-mono text-xs font-medium text-ink">
                        {o.order_number}
                      </span>
                      {o.notes && (
                        <span className="flex items-center gap-1 text-[11px] text-ink-3">
                          <MapPin size={10} />
                          {o.notes.split(',').slice(-2).join(',').trim()}
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
                    <Badge tone={ORDER_STATUS_TONE[o.status]}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={PAYMENT_STATUS_TONE[o.payment_status]} noDot>
                      {PAYMENT_STATUS_LABEL[o.payment_status]}
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
