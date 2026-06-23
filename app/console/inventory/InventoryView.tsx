'use client';

import { useState } from 'react';
import { Box, Plus, Upload } from '@/components/icons';
import { EmptyState } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { PageHead } from '@/components/shared/PageHead';
import { CreateEntityModal, type EntityField } from '@/components/console/CreateEntityModal';
import { SheetImporter } from '@/components/console/SheetImporter';
import { batchReceiveSchema, batchImportRowSchema, type BatchReceiveInput } from '@/lib/schemas';
import { receiveStockAction, importBatchesAction } from '@/lib/actions/console';
import { cn } from '@/lib/utils';

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

export function InventoryView() {
  const [tab, setTab]       = useState<(typeof TABS)[number]['value']>('all');
  const [receive, setReceive]     = useState(false);
  const [importing, setImporting] = useState(false);

  // SKU options will come from the products API when integrated
  const skuOptions: { value: string; label: string }[] = [];

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
        {['Total SKUs', 'Low stock', 'Expiring < 90 days'].map((label) => (
          <div key={label} className="rounded-xl border border-line bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</div>
            <div className="num mt-1 font-display text-2xl tracking-tight text-ink">0</div>
          </div>
        ))}
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
          </button>
        ))}
      </div>

      <EmptyState
        icon={<Box size={24} />}
        title="No inventory yet"
        description="Receive stock or import batches to populate the inventory."
      />

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
