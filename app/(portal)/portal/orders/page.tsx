'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Box } from '@/components/icons';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { ButtonLink } from '@/components/ui/Button';
import { PageHead } from '@/components/shared/PageHead';
import { ORDERS } from '@/lib/data/operational';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
} from '@/lib/constants';
import { formatNaira, formatDate } from '@/lib/utils';
import type { OrderStatus } from '@/types';
import { cn } from '@/lib/utils';

type Tab = 'all' | 'in_progress' | 'delivered' | 'cancelled';
const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];
const inProgress: OrderStatus[] = ['pending', 'confirmed', 'processing', 'dispatched'];

export default function PortalOrdersPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const myOrders = ORDERS.filter((o) => o.customer_id === 101);

  const filtered = useMemo(() => {
    return myOrders
      .filter((o) => {
        if (tab === 'in_progress') return inProgress.includes(o.status);
        if (tab === 'delivered') return o.status === 'delivered';
        if (tab === 'cancelled') return o.status === 'cancelled';
        return true;
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

  return (
    <>
      <PageHead title="Orders" subtitle="Track every shipment from confirmation to delivery." />

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="inline-flex rounded-md bg-bg-muted p-0.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                tab === t.value
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-ink-2 hover:text-ink',
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
            placeholder="Search by order # or product"
            aria-label="Search orders"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Box size={24} />}
          title="No orders to show"
          description={tab === 'all' ? "When you place orders, they'll show up here." : 'Nothing matches this filter.'}
          action={tab === 'all' ? <ButtonLink href="/portal/catalog">Browse catalog</ButtonLink> : undefined}
        />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Order</Th>
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
                    <Link
                      href={`/portal/orders/${o.id}`}
                      className="font-mono text-xs text-ink-2 hover:text-brand-600"
                    >
                      {o.order_number}
                    </Link>
                  </Td>
                  <Td muted>{o.items.length} {o.items.length === 1 ? 'item' : 'items'}</Td>
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
