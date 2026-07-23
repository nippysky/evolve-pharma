'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Box, Plus, Upload } from '@/components/icons';
import { Badge } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { PageHead } from '@/components/shared/PageHead';
import { CreateEntityModal, type EntityField } from '@/components/console/CreateEntityModal';
import { SheetImporter } from '@/components/console/SheetImporter';
import { batchReceiveSchema, batchImportRowSchema, type BatchReceiveInput } from '@/lib/schemas';
import { receiveStockAction, importBatchesAction } from '@/lib/actions/console';
import { DUMMY_INVENTORY } from '@/lib/data/dummy-console';
import { DUMMY_PRODUCTS } from '@/lib/data/dummy-products';
import { cn, formatDate } from '@/lib/utils';

const TABS = [
  { value: 'all' as const,       label: 'All' },
  { value: 'low_stock' as const, label: 'Low stock' },
  { value: 'expiring' as const,  label: 'Expiring soon' },
];

const IMPORT_COLUMNS = [
  { key: 'sku',         label: 'SKU',                         required: true },
  { key: 'batch_no',   label: 'Batch number',                 required: true },
  { key: 'quantity',   label: 'Quantity',                     required: true },
  { key: 'expiry_date', label: 'Expiry date (YYYY-MM-DD)',    required: true },
];

const LOW_STOCK_COUNT     = DUMMY_INVENTORY.filter((s) => s.is_low_stock).length;
const EXPIRING_SOON_COUNT = DUMMY_INVENTORY.filter((s) => s.is_expiring_soon).length;

export function InventoryView() {
  const [tab, setTab]           = useState<(typeof TABS)[number]['value']>('all');
  const [receive, setReceive]   = useState(false);
  const [importing, setImporting] = useState(false);

  const visible = useMemo(() => {
    if (tab === 'low_stock') return DUMMY_INVENTORY.filter((s) => s.is_low_stock);
    if (tab === 'expiring')  return DUMMY_INVENTORY.filter((s) => s.is_expiring_soon);
    return DUMMY_INVENTORY;
  }, [tab]);

  // SKU options for the "receive stock" modal
  const skuOptions = DUMMY_PRODUCTS.map((p) => ({ value: p.sku, label: `${p.sku} — ${p.name}` }));

  const receiveFields: EntityField[] = [
    { name: 'sku',         label: 'Product (SKU)',  type: 'select', required: true, options: skuOptions, full: true },
    { name: 'batch_no',   label: 'Batch number',    required: true,  placeholder: 'BN-2025-001A' },
    { name: 'quantity',   label: 'Quantity',         type: 'number', required: true, placeholder: '240' },
    { name: 'expiry_date', label: 'Expiry date',    type: 'date',   required: true, full: true },
  ];

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

      {/* Summary cards */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Total SKUs</div>
          <div className="num mt-1 font-display text-2xl tracking-tight text-ink">{DUMMY_INVENTORY.length}</div>
        </div>
        <div className={cn('rounded-xl border p-4', LOW_STOCK_COUNT > 0 ? 'border-danger bg-danger-soft/30' : 'border-line bg-white')}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Low stock</div>
          <div className={cn('num mt-1 font-display text-2xl tracking-tight', LOW_STOCK_COUNT > 0 ? 'text-danger' : 'text-ink')}>
            {LOW_STOCK_COUNT}
          </div>
        </div>
        <div className={cn('rounded-xl border p-4', EXPIRING_SOON_COUNT > 0 ? 'border-warning bg-warning-soft/30' : 'border-line bg-white')}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Expiring &lt; 90 days</div>
          <div className={cn('num mt-1 font-display text-2xl tracking-tight', EXPIRING_SOON_COUNT > 0 ? 'text-amber-700' : 'text-ink')}>
            {EXPIRING_SOON_COUNT}
          </div>
        </div>
      </div>

      {/* Tab bar */}
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
            {t.value === 'low_stock' && LOW_STOCK_COUNT > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {LOW_STOCK_COUNT}
              </span>
            )}
            {t.value === 'expiring' && EXPIRING_SOON_COUNT > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-white">
                {EXPIRING_SOON_COUNT}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-bg-muted text-ink-3">
            <Box size={24} />
          </span>
          <span className="display-serif text-xl text-ink">No items in this view</span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-subtle bg-bg-subtle text-left">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Product</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">SKU</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Batch</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Stock</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Expiry</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Shelf</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {visible.map((snapshot) => {
                  const p     = snapshot.product;
                  const batch = snapshot.batches[0];
                  return (
                    <tr key={p.id} className="hover:bg-bg-subtle/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <Image
                              src={p.image_url}
                              alt={p.name}
                              width={32}
                              height={32}
                              className="h-8 w-8 shrink-0 rounded-md border border-line object-contain"
                            />
                          ) : (
                            <span className="h-8 w-8 shrink-0 rounded-md border border-line bg-bg-muted" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{p.name}</p>
                            <p className="truncate text-xs text-ink-3">{p.generic_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-ink-2">{p.sku}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-ink-2">{batch?.batch_no ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          'num text-sm font-medium',
                          snapshot.is_low_stock ? 'text-danger' : 'text-ink',
                        )}>
                          {snapshot.total_quantity}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-ink-3">
                        {snapshot.next_expiry ? formatDate(snapshot.next_expiry) : '—'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-ink-2">
                        {p.shelf_location ?? '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          {snapshot.is_low_stock     && <Badge tone="danger">Low stock</Badge>}
                          {snapshot.is_expiring_soon && <Badge tone="warning">Expiring soon</Badge>}
                          {!snapshot.is_low_stock && !snapshot.is_expiring_soon && (
                            <Badge tone="success" noDot>OK</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line-subtle bg-bg-subtle px-5 py-3 text-xs text-ink-3">
            Showing {visible.length} of {DUMMY_INVENTORY.length} SKUs
          </div>
        </div>
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
