'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { AlertTriangle, Box } from '@/components/icons';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { PageHead } from '@/components/shared/PageHead';
import { INVENTORY } from '@/lib/data/operational';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

const TABS = [
  { value: 'all' as const, label: 'All' },
  { value: 'low_stock' as const, label: 'Low stock' },
  { value: 'expiring' as const, label: 'Expiring soon' },
];

export default function ConsoleInventoryPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('all');

  const filtered = useMemo(() => {
    return INVENTORY.filter((i) => {
      if (tab === 'low_stock') return i.is_low_stock;
      if (tab === 'expiring') return i.is_expiring_soon;
      return true;
    }).sort((a, b) => a.total_quantity - b.total_quantity);
  }, [tab]);

  const lowCount = INVENTORY.filter((i) => i.is_low_stock).length;
  const expCount = INVENTORY.filter((i) => i.is_expiring_soon).length;

  return (
    <>
      <PageHead
        title="Inventory"
        subtitle="Stock levels and batch expiry across the catalog."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Total SKUs</div>
          <div className="num mt-1 font-display text-2xl tracking-tight text-ink">{INVENTORY.length}</div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Low stock</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num font-display text-2xl tracking-tight text-ink">{lowCount}</span>
            {lowCount > 0 && <Badge tone="warning" noDot>Action needed</Badge>}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Expiring &lt; 90 days</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num font-display text-2xl tracking-tight text-ink">{expCount}</span>
            {expCount > 0 && <Badge tone="warning" noDot>Review</Badge>}
          </div>
        </div>
      </div>

      <div className="mb-5 inline-flex rounded-md bg-bg-muted p-0.5">
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

      {filtered.length === 0 ? (
        <EmptyState icon={<Box size={24} />} title="Nothing to show" description="No inventory matches this filter." />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Product</Th>
                <Th align="right">In stock</Th>
                <Th align="right">Batches</Th>
                <Th>Next expiry</Th>
                <Th>Status</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((i) => (
                <Tr key={i.product.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-bg-muted">
                        <Image src={i.product.image_url} alt={i.product.name} width={72} height={72} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/console/products/${i.product.sku}`}
                          className="block truncate font-medium tracking-tight text-ink hover:text-brand-600"
                        >
                          {i.product.name}
                        </Link>
                        <div className="mt-0.5 truncate font-mono text-xs text-ink-3">{i.product.sku}</div>
                      </div>
                    </div>
                  </Td>
                  <Td right num>{i.total_quantity}</Td>
                  <Td right num>{i.batches.length}</Td>
                  <Td muted>{i.next_expiry ? formatDate(i.next_expiry) : '—'}</Td>
                  <Td>
                    {i.is_low_stock ? (
                      <Badge tone="warning"><AlertTriangle size={11} /> Low stock</Badge>
                    ) : i.is_expiring_soon ? (
                      <Badge tone="warning" noDot>Expiring soon</Badge>
                    ) : (
                      <Badge tone="success" noDot>Healthy</Badge>
                    )}
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
