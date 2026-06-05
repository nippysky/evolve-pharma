'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { AlertTriangle, Box, Plus, Upload } from '@/components/icons';
import { Badge, EmptyState } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { PageHead } from '@/components/shared/PageHead';
import { CreateEntityModal, type EntityField } from '@/components/console/CreateEntityModal';
import { SheetImporter } from '@/components/console/SheetImporter';
import { batchReceiveSchema, batchImportRowSchema, type BatchReceiveInput } from '@/lib/schemas';
import { receiveStockAction, importBatchesAction } from '@/lib/actions/console';
import { INVENTORY } from '@/lib/data/operational';
import { getAllProducts } from '@/lib/data/products';
import { formatDate, cn } from '@/lib/utils';

const TABS = [
  { value: 'all' as const, label: 'All' },
  { value: 'low_stock' as const, label: 'Low stock' },
  { value: 'expiring' as const, label: 'Expiring soon' },
];

const IMPORT_COLUMNS = [
  { key: 'sku', label: 'SKU', required: true },
  { key: 'batch_no', label: 'Batch number', required: true },
  { key: 'quantity', label: 'Quantity', required: true },
  { key: 'expiry_date', label: 'Expiry date (YYYY-MM-DD)', required: true },
];

export function InventoryView() {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('all');
  const [receive, setReceive] = useState(false);
  const [importing, setImporting] = useState(false);

  const skuOptions = useMemo(
    () => getAllProducts().map((p) => ({ value: p.sku, label: `${p.sku} — ${p.name}` })),
    [],
  );

  const receiveFields: EntityField[] = [
    { name: 'sku', label: 'Product (SKU)', type: 'select', required: true, options: skuOptions, full: true },
    { name: 'batch_no', label: 'Batch number', required: true, placeholder: 'BN-2025-001A' },
    { name: 'quantity', label: 'Quantity', type: 'number', required: true, placeholder: '240' },
    { name: 'expiry_date', label: 'Expiry date', type: 'date', required: true, full: true },
  ];

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
        actions={
          <>
            <Button variant="secondary" leadingIcon={<Upload size={14} />} onClick={() => setImporting(true)}>
              Import batches
            </Button>
            <Button leadingIcon={<Plus size={14} />} onClick={() => setReceive(true)}>
              Receive stock
            </Button>
          </>
        }
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
            {lowCount > 0 && (
              <Badge tone="warning" noDot>
                Action needed
              </Badge>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Expiring &lt; 90 days</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num font-display text-2xl tracking-tight text-ink">{expCount}</span>
            {expCount > 0 && (
              <Badge tone="warning" noDot>
                Review
              </Badge>
            )}
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
                  <Td right num>
                    {i.total_quantity}
                  </Td>
                  <Td right num>
                    {i.batches.length}
                  </Td>
                  <Td muted>{i.next_expiry ? formatDate(i.next_expiry) : '—'}</Td>
                  <Td>
                    {i.is_low_stock ? (
                      <Badge tone="warning">
                        <AlertTriangle size={11} /> Low stock
                      </Badge>
                    ) : i.is_expiring_soon ? (
                      <Badge tone="warning" noDot>
                        Expiring soon
                      </Badge>
                    ) : (
                      <Badge tone="success" noDot>
                        Healthy
                      </Badge>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}

      <CreateEntityModal
        open={receive}
        onClose={() => setReceive(false)}
        title="Receive stock"
        description="Log a new batch against an existing product SKU."
        fields={receiveFields}
        schema={batchReceiveSchema}
        action={receiveStockAction}
        submitLabel="Add batch"
        successTitle="Stock received"
      />

      <SheetImporter<BatchReceiveInput>
        open={importing}
        onClose={() => setImporting(false)}
        title="Import batches"
        columns={IMPORT_COLUMNS}
        schema={batchImportRowSchema}
        action={importBatchesAction}
        templateName="inventory_template.xlsx"
      />
    </>
  );
}