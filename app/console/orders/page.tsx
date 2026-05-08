'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, Box, Download } from '@/components/icons';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { PageHead } from '@/components/shared/PageHead';
import { ORDERS, CUSTOMERS } from '@/lib/data/operational';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
} from '@/lib/constants';
import { formatNaira, formatDate } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export default function ConsoleOrdersPage() {
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]['value']>('all');
  const [query, setQuery] = useState('');
  const toast = useToast();

  const filtered = useMemo(() => {
    return ORDERS.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const cust = CUSTOMERS.find((c) => c.id === o.customer_id);
      return (
        o.order_number.toLowerCase().includes(q) ||
        (cust?.company_name ?? '').toLowerCase().includes(q)
      );
    }).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
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
            onClick={() =>
              toast.show({
                tone: 'info',
                title: 'Export queued',
                description: 'CSV will arrive in your inbox shortly.',
              })
            }
          >
            Export CSV
          </Button>
        }
      />

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

      {filtered.length === 0 ? (
        <EmptyState icon={<Box size={24} />} title="No orders match" description="Adjust filters or search." />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Date</Th>
                <Th>Items</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th align="right">Total</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((o) => {
                const cust = CUSTOMERS.find((c) => c.id === o.customer_id);
                return (
                  <Tr key={o.id}>
                    <Td>
                      <Link
                        href={`/console/orders/${o.id}`}
                        className="font-mono text-xs text-ink-2 hover:text-brand-600"
                      >
                        {o.order_number}
                      </Link>
                    </Td>
                    <Td>
                      <Link
                        href={`/console/customers/${o.customer_id}`}
                        className="font-medium text-ink hover:text-brand-600"
                      >
                        {cust?.company_name ?? '—'}
                      </Link>
                    </Td>
                    <Td muted>{formatDate(o.created_at)}</Td>
                    <Td muted>{o.items.length}</Td>
                    <Td>
                      <Badge tone={ORDER_STATUS_TONE[o.status]} noDot>
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
                );
              })}
            </Tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
