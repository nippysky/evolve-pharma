'use client';

import { useState } from 'react';
import { Box, Plus, Upload } from '@/components/icons';
import { EmptyState } from '@/components/ui/Primitives';
import { Button }     from '@/components/ui/Button';
import { PageHead }   from '@/components/shared/PageHead';
import { CreateEntityModal, type EntityField } from '@/components/console/CreateEntityModal';
import { SheetImporter }     from '@/components/console/SheetImporter';
import { batchReceiveSchema, batchImportRowSchema } from '@/lib/schemas';
import { receiveStockAction, importBatchesAction } from '@/lib/actions/console';

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { value: 'all'       as const, label: 'All' },
  { value: 'low_stock' as const, label: 'Low stock' },
  { value: 'expiring'  as const, label: 'Expiring soon' },
];

const IMPORT_COLUMNS = [
  { key: 'sku',        label: 'SKU',                      required: true },
  { key: 'batch_no',   label: 'Batch number',             required: true },
  { key: 'quantity',   label: 'Quantity',                 required: true },
  { key: 'expiry_date',label: 'Expiry date (YYYY-MM-DD)', required: true },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function InventoryView() {
  const [tab, setTab]             = useState<(typeof TABS)[number]['value']>('all');
  const [receive, setReceive]     = useState(false);
  const [importing, setImporting] = useState(false);

  // SKU options will be populated via API in Module 4
  const skuOptions: { value: string; label: string }[] = [];

  const receiveFields: EntityField[] = [
    { name: 'sku',        label: 'Product (SKU)', type: 'select', required: true, options: skuOptions, full: true },
    { name: 'batch_no',   label: 'Batch number',  required: true, placeholder: 'BN-2025-001A' },
    { name: 'quantity',   label: 'Quantity',       type: 'number', required: true, placeholder: '240' },
    { name: 'expiry_date',label: 'Expiry date',    type: 'date',  required: true, full: true },
  ];

  return (
    <>
      <PageHead
        title="Inventory"
        subtitle="Stock levels and batch expiry across the catalog."
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<Upload size={14} />}
              onClick={() => setImporting(true)}
            >
              Import batches
            </Button>
            <Button
              size="sm"
              leadingIcon={<Plus size={14} />}
              onClick={() => setReceive(true)}
            >
              Receive stock
            </Button>
          </>
        }
      />

      {/* Summary strip */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total SKUs',   value: '—' },
          { label: 'Low stock',    value: '—' },
          { label: 'Expiring soon',value: '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-line bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</div>
            <div className="num mt-1 font-display text-2xl tracking-tight text-ink">{value}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-xl border border-line bg-white p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.value
                ? 'bg-ink text-white'
                : 'text-ink-3 hover:bg-bg-subtle hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Empty state — replaced with table in Module 4 */}
      <div className="rounded-xl border border-line bg-white">
        <EmptyState
          icon={<Box size={24} />}
          title="No inventory data yet"
          description="Receive stock batches or import via spreadsheet to get started."
        />
      </div>

      {/* Receive stock modal */}
      {receive && (
        <CreateEntityModal
          open={receive}
          title="Receive stock"
          description="Record an incoming batch for an existing SKU."
          fields={receiveFields}
          schema={batchReceiveSchema as Parameters<typeof CreateEntityModal>[0]['schema']}
          action={receiveStockAction}
          onClose={() => setReceive(false)}
          submitLabel="Record batch"
        />
      )}

      {/* Batch import modal */}
      {importing && (
        <SheetImporter
          open={importing}
          title="Import inventory batches"
          columns={IMPORT_COLUMNS}
          schema={batchImportRowSchema}
          action={importBatchesAction}
          onClose={() => setImporting(false)}
          templateName="inventory_template"
        />
      )}
    </>
  );
}
