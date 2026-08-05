import { useState, useMemo, useRef, useCallback } from 'react';
import Image         from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Plus, Minus, Upload, Search, AlertTriangle,
  RotateCw, ChevronLeft, ChevronRight,
  CheckCircle, X, Download, FileText, Edit, Sliders,
} from '@/components/icons';
import { Button }    from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { PageHead }  from '@/components/shared/PageHead';
import { useToast }  from '@/contexts/ToastContext';
import { formatNaira, cn } from '@/lib/utils';

interface InventoryBatch {
  id:             number;
  batch_number:   string;
  quantity:       number;
  cost_price:     number;
  expiry_date:    string | null;
  received_at:    string;
  is_low_stock:   boolean;
  is_near_expiry: boolean;
  product: {
    id:                  number;
    sku:                 string;
    brand_name:          string;
    generic_name:        string;
    minimum_stock_level: number;
    primary_image:       string | null;
  };
}

interface InventoryStats {
  total_skus:      number;
  low_stock_count: number;
  expiring_count:  number;
  total_stock:     number;
}

interface ProductOption {
  id:         number;
  sku:        string;
  brand_name: string;
}

type Tab = 'all' | 'low_stock' | 'expiring';

async function fetchInventory(params: { page: number; tab: Tab }): Promise<{ records: InventoryBatch[]; pagination: { total: number } }> {
  const sp = new URLSearchParams({ page: String(params.page), limit: '30' });
  if (params.tab === 'low_stock')  sp.set('low_stock',   'true');
  if (params.tab === 'expiring')   sp.set('near_expiry', 'true');
  const res  = await fetch(`/api/inventory?${sp}`, { credentials: 'include' });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? 'Failed to load inventory');
  return json.data;
}

async function fetchStats(): Promise<InventoryStats> {
  const res  = await fetch('/api/inventory/stats', { credentials: 'include' });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? 'Failed to load stats');
  return json.data;
}

async function fetchProducts(): Promise<ProductOption[]> {
  const res  = await fetch('/api/products?limit=500', { credentials: 'include' });
  const json = await res.json();
  if (!res.ok) return [];
  return (json.data?.records ?? []).map((p: any) => ({
    id:         p.id,
    sku:        p.sku,
    brand_name: p.brand_name,
  }));
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</div>
      <div className={cn('num mt-1 text-2xl font-bold tracking-tight', accent ? 'text-danger' : 'text-ink')}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line-subtle bg-bg-subtle">
            {['Product', 'Batch', 'Qty', 'Cost', 'Expiry', 'Status'].map(h => (
              <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-ink-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="border-t border-line-subtle animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-bg-muted" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-28 rounded bg-bg-muted" />
                    <div className="h-2 w-16 rounded bg-bg-muted" />
                  </div>
                </div>
              </td>
              {[72, 40, 60, 72, 60].map((w, j) => (
                <td key={j} className="px-5 py-3.5"><div className="h-3 rounded bg-bg-muted" style={{ width: w }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReceiveModal({ onClose }: { onClose: () => void }) {
  const toast       = useToast();
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products-simple'],
    queryFn:  fetchProducts,
    staleTime: 5 * 60_000,
  });

  const [search,     setSearch]     = useState('');
  const [selected,   setSelected]   = useState<ProductOption | null>(null);
  const [showList,   setShowList]   = useState(false);
  const [errors,     setErrors]     = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p =>
      p.brand_name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    ).slice(0, 20);
  }, [products, search]);

  const receiveMut = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res  = await fetch('/api/inventory/receive', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        const err: Error & { fieldErrors?: Record<string, string[]> } = new Error(json?.message ?? 'Failed');
        err.fieldErrors = json?.errors;
        throw err;
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      toast.show({ tone: 'success', title: 'Stock received' });
      onClose();
    },
    onError: (err: Error & { fieldErrors?: Record<string, string[]> }) => {
      if (err.fieldErrors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.fieldErrors)) {
          mapped[k] = v[0] ?? 'Invalid';
        }
        setErrors(mapped);
      } else {
        toast.show({ tone: 'error', title: 'Receive failed', description: err.message });
      }
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    if (!selected) { setErrors({ product_id: 'Select a product' }); return; }
    const fd = new FormData(e.currentTarget);
    receiveMut.mutate({
      product_id:   selected.id,
      batch_number: fd.get('batch_number'),
      quantity:     parseInt(fd.get('quantity') as string, 10),
      cost_price:   parseFloat(fd.get('cost_price') as string),
      expiry_date:  fd.get('expiry_date') || undefined,
      notes:        fd.get('notes') || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line-subtle px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-ink">Receive stock</h2>
            <p className="mt-0.5 text-xs text-ink-3">Record an incoming batch for an existing product.</p>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-4 hover:bg-bg-muted hover:text-ink transition-colors">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Product search */}
          <Field label="Product" required error={errors.product_id}>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                value={selected ? selected.brand_name : search}
                onChange={e => { setSearch(e.target.value); setSelected(null); setShowList(true); }}
                onFocus={() => setShowList(true)}
                onBlur={() => setTimeout(() => setShowList(false), 150)}
                placeholder="Search by name or SKU…"
                className="h-9 w-full rounded-lg border border-line pl-8 pr-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
              />
              {selected && (
                <button type="button" onClick={() => { setSelected(null); setSearch(''); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink">
                  <X size={12} />
                </button>
              )}
              {showList && !selected && filtered.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-line bg-white shadow-xl">
                  {filtered.map(p => (
                    <button key={p.id} type="button"
                      className="flex w-full flex-col px-3 py-2.5 text-left hover:bg-bg-subtle transition-colors"
                      onMouseDown={() => { setSelected(p); setShowList(false); setSearch(''); }}>
                      <span className="text-sm font-medium text-ink">{p.brand_name}</span>
                      <span className="font-mono text-xs text-ink-3">{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Batch number" required error={errors.batch_number}>
              <Input name="batch_number" placeholder="PC0601" />
            </Field>
            <Field label="Quantity" required error={errors.quantity}>
              <Input name="quantity" type="number" min="1" placeholder="100" />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cost price (₦)" required error={errors.cost_price}>
              <Input name="cost_price" type="number" step="0.01" min="0.01" placeholder="16200" />
            </Field>
            <Field label="Expiry date" hint="Leave blank if N/A">
              <Input name="expiry_date" type="date" />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <Input name="notes" placeholder="Supplier invoice #, PO reference…" />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" loading={receiveMut.isPending}
              leadingIcon={<CheckCircle size={13} />}>
              Record batch
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface BulkRow {
  rowNum:   number;
  sku:      string;
  batch_no: string;
  quantity: string;
  cost:     string;
  expiry:   string;
  errors:   string[];
}

function BulkReceiveModal({ onClose }: { onClose: () => void }) {
  const toast       = useToast();
  const queryClient = useQueryClient();
  const inputRef    = useRef<HTMLInputElement>(null);

  const [preview,    setPreview]    = useState<BulkRow[] | null>(null);
  const [rawFile,    setRawFile]    = useState<File | null>(null);
  const [dragging,   setDragging]   = useState(false);
  const [parsing,    setParsing]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result,     setResult]     = useState<{ successful: number; failed: number; failed_records: any[] } | null>(null);
  const [serverErr,  setServerErr]  = useState('');

  function hk(h: string): string { return String(h).toLowerCase().trim().replace(/[\s-]+/g, '_'); }
  function cellStr(row: unknown[], headers: Record<string, number>, col: string): string {
    const i = headers[col]; if (i === undefined) return '';
    const v = (row as (string | number | null | undefined)[])[i];
    return v != null ? String(v).trim() : '';
  }

  const parseFile = useCallback(async (f: File) => {
    setParsing(true); setPreview(null); setResult(null); setServerErr('');
    try {
      const buf  = await f.arrayBuffer();
      const XLSX = await import('xlsx');
      const wb   = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]!];
      if (!sheet) { toast.show({ tone: 'error', title: 'Empty spreadsheet' }); return; }
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][];
      if (rawRows.length < 2) { toast.show({ tone: 'error', title: 'No data rows' }); return; }

      const headers: Record<string, number> = {};
      (rawRows[0] as string[]).forEach((h, i) => { headers[hk(h)] = i; });

      const rows: BulkRow[] = [];
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i] as unknown[];
        const sku = cellStr(row, headers, 'sku');
        const bno = cellStr(row, headers, 'batch_no');
        const qty = cellStr(row, headers, 'quantity');
        const cst = cellStr(row, headers, 'cost_price');
        if (!sku && !bno && !qty && !cst) continue;
        const errs: string[] = [];
        if (!sku) errs.push('sku required');
        if (!bno) errs.push('batch_no required');
        if (!qty || isNaN(parseInt(qty, 10)) || parseInt(qty, 10) <= 0) errs.push('quantity invalid');
        if (!cst || isNaN(parseFloat(cst)) || parseFloat(cst) <= 0) errs.push('cost_price invalid');
        rows.push({ rowNum: i + 1, sku, batch_no: bno, quantity: qty, cost: cst, expiry: cellStr(row, headers, 'expiry_date'), errors: errs });
      }
      setPreview(rows);
      setRawFile(f);
    } catch (err) {
      toast.show({ tone: 'error', title: 'Parse failed', description: (err as Error).message });
    } finally { setParsing(false); }
  }, [toast]);

  async function handleSubmit() {
    if (!rawFile) return;
    setSubmitting(true); setServerErr('');
    try {
      const fd = new FormData(); fd.append('file', rawFile);
      const res  = await fetch('/api/inventory/bulk-receive', { method: 'POST', credentials: 'include', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'Failed');
      setResult(json.data);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      toast.show({ tone: 'success', title: 'Bulk receive complete', description: json.message });
    } catch (err) {
      setServerErr((err as Error).message);
    } finally { setSubmitting(false); }
  }

  async function downloadTemplate() {
    const XLSX = await import('xlsx');
    const header = ['sku', 'batch_no', 'quantity', 'cost_price', 'expiry_date', 'notes'];
    const sample = ['NEIMETH-PYRANTRIN', 'PC0601', '100', '16200', '2026-12-31', 'PO-001'];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, sample]), 'Batches');
    XLSX.writeFile(wb, 'inventory_bulk_receive_template.xlsx');
  }

  const validRows   = preview?.filter(r => r.errors.length === 0).length ?? 0;
  const invalidRows = preview?.filter(r => r.errors.length > 0).length  ?? 0;
  const colCls = 'whitespace-nowrap px-3 py-2 text-xs';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between border-b border-line-subtle px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-ink">Bulk receive stock</h2>
            <p className="mt-0.5 text-xs text-ink-3">Upload a spreadsheet to create multiple inventory batches at once.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void downloadTemplate()}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-bg-subtle transition-colors">
              <Download size={12} /> Template
            </button>
            <button type="button" onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-4 hover:bg-bg-muted hover:text-ink transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {result && (
            <div className="mb-4 rounded-xl border border-line bg-bg-subtle p-4">
              <div className="flex items-center gap-2 mb-3"><CheckCircle size={16} className="text-green-600" /><p className="font-semibold text-ink">Bulk receive complete</p></div>
              <div className="grid grid-cols-3 gap-3">
                {[{ l: 'Created', v: result.successful, c: 'text-green-700' }, { l: 'Failed', v: result.failed, c: 'text-red-700' }, { l: 'Total', v: result.successful + result.failed, c: 'text-ink' }].map(s => (
                  <div key={s.l} className="rounded-lg border border-line bg-white p-3 text-center">
                    <div className={cn('num text-2xl font-bold', s.c)}>{s.v}</div>
                    <div className="text-xs text-ink-3">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!preview && !parsing && !result && (
            <div
              className={cn('flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-14 cursor-pointer transition-colors text-center',
                dragging ? 'border-brand-400 bg-brand-50' : 'border-line hover:border-brand-300 hover:bg-bg-subtle')}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) void parseFile(f); }}
              onClick={() => inputRef.current?.click()}
            >
              <FileText size={36} className="mb-3 text-ink-3" />
              <p className="font-medium text-ink">Drop your file here, or click to browse</p>
              <p className="mt-1 text-xs text-ink-3">.xlsx, .xls, .csv — columns: sku, batch_no, quantity, cost_price, expiry_date</p>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f) void parseFile(f); e.target.value = ''; }} />
            </div>
          )}

          {parsing && (
            <div className="flex items-center justify-center gap-3 py-16 text-ink-3">
              <RotateCw size={18} className="animate-spin" /><span className="text-sm">Parsing…</span>
            </div>
          )}

          {preview && !result && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex gap-3">
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">{validRows} valid</span>
                  {invalidRows > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{invalidRows} errors</span>}
                </div>
                <button type="button" onClick={() => { setPreview(null); setRawFile(null); }}
                  className="text-xs text-ink-3 hover:text-ink underline">Change file</button>
              </div>
              {serverErr && (
                <div className="mb-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />{serverErr}
                </div>
              )}
              <div className="overflow-auto rounded-xl border border-line" style={{ maxHeight: 300 }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-bg-subtle z-10">
                    <tr className="border-b border-line-subtle">
                      {['#', 'SKU', 'Batch no', 'Qty', 'Cost price', 'Expiry', 'Errors'].map(h => (
                        <th key={h} className={cn(colCls, 'text-[10px] font-semibold uppercase tracking-widest text-ink-3 text-left')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {preview.map(row => (
                      <tr key={row.rowNum} className={cn('transition-colors', row.errors.length > 0 ? 'bg-red-50' : 'hover:bg-bg-subtle/50')}>
                        <td className={cn(colCls, 'font-mono text-ink-4')}>{row.rowNum}</td>
                        <td className={cn(colCls, 'font-mono text-ink')}>{row.sku || '—'}</td>
                        <td className={cn(colCls, 'text-ink-2')}>{row.batch_no || '—'}</td>
                        <td className={cn(colCls, 'num text-ink')}>{row.quantity || '—'}</td>
                        <td className={cn(colCls, 'num text-ink-2')}>{row.cost || '—'}</td>
                        <td className={cn(colCls, 'text-ink-3')}>{row.expiry || '—'}</td>
                        <td className={cn(colCls, 'max-w-[160px]')}>
                          {row.errors.length > 0
                            ? <span className="text-[10px] text-red-600">{row.errors.join(' · ')}</span>
                            : <CheckCircle size={12} className="text-green-500" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {preview && !result && (
          <div className="flex items-center justify-between border-t border-line-subtle px-6 py-4">
            <p className="text-xs text-ink-3">{validRows} of {preview.length} rows will be processed.</p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="button" size="sm" disabled={validRows === 0 || submitting} loading={submitting}
                onClick={() => void handleSubmit()}>
                Import {validRows} batch{validRows !== 1 ? 'es' : ''}
              </Button>
            </div>
          </div>
        )}
        {result && (
          <div className="flex justify-end border-t border-line-subtle px-6 py-4">
            <Button type="button" size="sm" onClick={onClose}>Done</Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface EditBatchModalProps {
  batch: InventoryBatch;
  onClose: () => void;
}

function EditBatchModal({ batch, onClose }: EditBatchModalProps) {
  const toast       = useToast();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const defaultExpiry = batch.expiry_date
    ? new Date(batch.expiry_date).toISOString().split('T')[0]
    : '';

  const editMut = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res  = await fetch(`/api/inventory/batches/${batch.id}`, {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        const err: Error & { fieldErrors?: Record<string, string[]> } = new Error(json?.message ?? 'Failed');
        err.fieldErrors = json?.errors;
        throw err;
      }
      return json;
    },
    onSuccess: () => {
      void queryClient.refetchQueries({ queryKey: ['inventory'] });
      toast.show({ tone: 'success', title: 'Batch updated' });
      onClose();
    },
    onError: (err: Error & { fieldErrors?: Record<string, string[]> }) => {
      if (err.fieldErrors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.fieldErrors)) mapped[k] = v[0] ?? 'Invalid';
        setErrors(mapped);
      } else {
        toast.show({ tone: 'error', title: 'Update failed', description: err.message });
      }
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    const batchNum = fd.get('batch_number') as string;
    const costStr  = fd.get('cost_price')   as string;
    const expiry   = fd.get('expiry_date')  as string;
    if (batchNum) payload.batch_number = batchNum;
    if (costStr)  payload.cost_price   = parseFloat(costStr);
    payload.expiry_date = expiry || null;
    editMut.mutate(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line-subtle px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-ink">Edit batch metadata</h2>
            <p className="mt-0.5 text-xs text-ink-3">
              <span className="font-mono font-medium text-ink-2">{batch.batch_number}</span>
              {' · '}{batch.product.brand_name}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-4 hover:bg-bg-muted hover:text-ink transition-colors">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label="Batch number" required error={errors.batch_number}>
            <Input name="batch_number" defaultValue={batch.batch_number} />
          </Field>
          <Field label="Cost price (₦)" required error={errors.cost_price}>
            <Input name="cost_price" type="number" step="0.01" min="0.01"
              defaultValue={batch.cost_price} />
          </Field>
          <Field label="Expiry date" hint="Leave blank to clear">
            <Input name="expiry_date" type="date" defaultValue={defaultExpiry} />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" loading={editMut.isPending}
              leadingIcon={<CheckCircle size={13} />}>
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ADJUST_REASONS = [
  'Damaged / spoiled units',
  'Counting discrepancy — correction',
  'Expired units removed',
  'Returned to supplier',
  'Write-off',
  'Found additional stock',
  'Internal transfer',
  'Other',
];

interface AdjustModalProps {
  batch: InventoryBatch;
  onClose: () => void;
}

function AdjustModal({ batch, onClose }: AdjustModalProps) {
  const toast       = useToast();
  const queryClient = useQueryClient();

  // deltaStr holds raw input (allows "-", "-0", partial typing); delta is the parsed integer
  const [deltaStr, setDeltaStr] = useState('0');
  const [reason,   setReason]   = useState('');
  const [custom,   setCustom]   = useState('');
  const [error,    setError]    = useState('');

  const delta      = parseInt(deltaStr, 10) || 0;
  const newQty     = batch.quantity + delta;
  const isNegative = newQty < 0;

  const adjustMut = useMutation({
    mutationFn: async () => {
      const finalReason = reason === 'Other' ? custom.trim() : reason;
      const res = await fetch('/api/inventory/adjust', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ batch_id: batch.id, delta, reason: finalReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'Adjustment failed');
      return json;
    },
    onSuccess: (json) => {
      // Refetch both inventory list and stats so totals update immediately
      void queryClient.refetchQueries({ queryKey: ['inventory'] });
      void queryClient.refetchQueries({ queryKey: ['inventory-stats'] });
      toast.show({ tone: 'success', title: 'Stock adjusted', description: json.message });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (delta === 0)     { setError('Delta cannot be zero.'); return; }
    if (!reason)         { setError('Select a reason.'); return; }
    if (reason === 'Other' && !custom.trim()) { setError('Enter a custom reason.'); return; }
    if (isNegative)      { setError(`Cannot remove more than current stock (${batch.quantity} units).`); return; }
    adjustMut.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line-subtle px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-ink">Adjust stock quantity</h2>
            <p className="mt-0.5 text-xs text-ink-3">
              <span className="font-mono font-medium text-ink-2">{batch.batch_number}</span>
              {' · '}current: <span className="font-semibold text-ink">{batch.quantity}</span> units
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-4 hover:bg-bg-muted hover:text-ink transition-colors">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Delta input */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">
              Adjustment (+ add · − remove)
            </label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setDeltaStr(String(delta - 1))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-2 hover:border-red-300 hover:text-red-600 transition-colors">
                <Minus size={13} />
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={deltaStr}
                onChange={e => {
                  // Allow: digits, a leading minus, partial "-" while typing
                  const v = e.target.value;
                  if (v === '' || v === '-' || /^-?\d+$/.test(v)) setDeltaStr(v);
                }}
                onBlur={() => {
                  // Normalise on blur — blank or bare "-" → "0"
                  if (deltaStr === '' || deltaStr === '-') setDeltaStr('0');
                }}
                className="h-9 w-full rounded-lg border border-line px-3 text-center text-sm font-semibold text-ink focus:border-brand-500 focus:outline-none"
              />
              <button type="button" onClick={() => setDeltaStr(String(delta + 1))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-2 hover:border-teal-300 hover:text-teal-600 transition-colors">
                <Plus size={13} />
              </button>
            </div>

            {/* Live preview */}
            <div className={cn(
              'mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm',
              isNegative
                ? 'border border-red-200 bg-red-50 text-red-700'
                : delta === 0
                  ? 'border border-line bg-bg-subtle text-ink-3'
                  : 'border border-teal-200 bg-teal-50 text-teal-700',
            )}>
              <span>New quantity</span>
              <span className={cn('num font-bold', isNegative ? 'text-red-700' : 'text-ink')}>
                {newQty}
              </span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">
              Reason <span className="text-danger">*</span>
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-brand-500 focus:outline-none">
              <option value="">Select a reason…</option>
              {ADJUST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {reason === 'Other' && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-2">
                Describe the reason <span className="text-danger">*</span>
              </label>
              <textarea
                value={custom}
                onChange={e => setCustom(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-brand-500 focus:outline-none resize-none"
                placeholder="Describe the reason for this adjustment…"
              />
            </div>
          )}

          {error && (
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />{error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" loading={adjustMut.isPending}
              disabled={delta === 0 || isNegative}
              leadingIcon={<CheckCircle size={13} />}>
              Apply adjustment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const TABS: { value: Tab; label: string }[] = [
  { value: 'all',       label: 'All'           },
  { value: 'low_stock', label: 'Low stock'     },
  { value: 'expiring',  label: 'Expiring soon' },
];

function formatExpiry(dateStr: string | null): { label: string; urgent: boolean } {
  if (!dateStr) return { label: '—', urgent: false };
  const d    = new Date(dateStr);
  const days = Math.floor((d.getTime() - Date.now()) / 86_400_000);
  const label = d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  return { label, urgent: days <= 30 };
}

export function InventoryView() {
  const [tab,         setTab]         = useState<Tab>('all');
  const [page,        setPage]        = useState(1);
  const [receive,     setReceive]     = useState(false);
  const [bulk,        setBulk]        = useState(false);
  const [query,       setQuery]       = useState('');
  const [editBatch,   setEditBatch]   = useState<InventoryBatch | null>(null);
  const [adjustBatch, setAdjustBatch] = useState<InventoryBatch | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn:  fetchStats,
    staleTime: 60_000,
  });

  const {
    data: inventoryData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['inventory', tab, page],
    queryFn:  () => fetchInventory({ page, tab }),
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
  });

  const batches: InventoryBatch[] = inventoryData?.records ?? [];
  const total   = inventoryData?.pagination?.total ?? 0;
  const hasMore = batches.length === 30;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter(b =>
      b.product.brand_name.toLowerCase().includes(q) ||
      b.product.sku.toLowerCase().includes(q) ||
      b.batch_number.toLowerCase().includes(q),
    );
  }, [batches, query]);

  return (
    <>
      <PageHead
        title="Inventory"
        subtitle="Stock levels and batch expiry across the catalog."
        actions={
          <>
            <Button size="sm" variant="secondary" leadingIcon={<Upload size={14} />} onClick={() => setBulk(true)}>
              Bulk receive
            </Button>
            <Button size="sm" leadingIcon={<Plus size={14} />} onClick={() => setReceive(true)}>
              Receive stock
            </Button>
          </>
        }
      />

      {/* Summary strip */}
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <StatCard label="Total SKUs"    value={statsLoading ? '…' : (stats?.total_skus      ?? 0)} />
        <StatCard label="Total units"   value={statsLoading ? '…' : (stats?.total_stock     ?? 0)} />
        <StatCard label="Low stock"     value={statsLoading ? '…' : (stats?.low_stock_count ?? 0)} accent={(stats?.low_stock_count ?? 0) > 0} />
        <StatCard label="Expiring soon" value={statsLoading ? '…' : (stats?.expiring_count  ?? 0)} accent={(stats?.expiring_count  ?? 0) > 0} />
      </div>

      {/* Filter tabs + search */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-line bg-white p-1">
          {TABS.map(t => (
            <button key={t.value} type="button" onClick={() => { setTab(t.value); setPage(1); }}
              className={cn('rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                tab === t.value ? 'bg-ink text-white' : 'text-ink-3 hover:bg-bg-subtle hover:text-ink')}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by product or batch…"
            className="h-9 w-full rounded-md border border-line bg-white pl-8 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none" />
        </div>
        {isFetching && !isLoading && <RotateCw size={13} className="animate-spin text-ink-3" />}
      </div>

      {/* Table */}
      {isLoading && <TableSkeleton />}

      {error && !isLoading && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-red-200 bg-red-50 px-6 py-12 text-center">
          <AlertTriangle size={24} className="text-red-400" />
          <p className="font-semibold text-red-700">Could not load inventory</p>
          <p className="text-sm text-red-500">{(error as Error).message}</p>
          <button type="button" onClick={() => void refetch()}
            className="mt-1 flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors">
            <RotateCw size={12} /> Retry
          </button>
        </div>
      )}

      {!isLoading && !error && visible.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-line bg-white px-6 py-16 text-center">
          <Box size={32} className="text-ink-4" />
          <p className="font-semibold text-ink">
            {tab === 'all' ? 'No inventory batches yet' : `No ${tab === 'low_stock' ? 'low-stock' : 'expiring-soon'} items`}
          </p>
          <p className="text-sm text-ink-3">
            {tab === 'all'
              ? 'Receive stock using the button above, or import via spreadsheet.'
              : 'All good here.'}
          </p>
        </div>
      )}

      {!isLoading && !error && visible.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-subtle bg-bg-subtle text-left">
                  {['Product', 'Batch', 'Qty', 'Cost price', 'Expiry', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-ink-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {visible.map(b => {
                  const exp = formatExpiry(b.expiry_date);
                  return (
                    <tr key={b.id} className="transition-colors hover:bg-bg-subtle/50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {b.product.primary_image ? (
                            <Image src={b.product.primary_image} alt={b.product.brand_name}
                              width={36} height={36}
                              className="h-9 w-9 shrink-0 rounded-lg border border-line object-contain" />
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-bg-muted text-ink-4 text-[10px]">—</span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{b.product.brand_name}</p>
                            <p className="font-mono text-xs text-ink-3">{b.product.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-ink-2">{b.batch_number}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn('num font-semibold', b.is_low_stock ? 'text-danger' : 'text-ink')}>
                          {b.quantity.toLocaleString()}
                          {b.is_low_stock && <span className="ml-1 text-[10px] font-bold text-danger">LOW</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 num text-ink-2">{formatNaira(b.cost_price)}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn('text-sm', exp.urgent ? 'font-medium text-amber-600' : 'text-ink-2')}>
                          {exp.label}
                          {exp.urgent && b.expiry_date && <span className="ml-1.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">SOON</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            title="Edit metadata"
                            onClick={() => setEditBatch(b)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-3 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            type="button"
                            title="Adjust quantity"
                            onClick={() => setAdjustBatch(b)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-3 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                          >
                            <Sliders size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(page > 1 || hasMore) && (
            <div className="flex items-center justify-between border-t border-line-subtle bg-bg-subtle px-5 py-3">
              <p className="text-xs text-ink-3">
                Page <span className="font-semibold text-ink-2">{page}</span>
                {total > 0 && <> · <span className="font-semibold text-ink-2">{total.toLocaleString()}</span> total</>}
              </p>
              <div className="flex gap-1">
                <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-3 hover:border-brand-300 hover:text-brand-600 disabled:opacity-30 transition-colors">
                  <ChevronLeft size={13} />
                </button>
                <button type="button" disabled={!hasMore} onClick={() => setPage(p => p + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-3 hover:border-brand-300 hover:text-brand-600 disabled:opacity-30 transition-colors">
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {receive     && <ReceiveModal onClose={() => setReceive(false)} />}
      {bulk        && <BulkReceiveModal onClose={() => setBulk(false)} />}
      {editBatch   && <EditBatchModal   batch={editBatch}   onClose={() => setEditBatch(null)} />}
      {adjustBatch && <AdjustModal      batch={adjustBatch} onClose={() => setAdjustBatch(null)} />}
    </>
  );
}
