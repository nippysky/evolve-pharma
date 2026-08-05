'use client';
import { useState, useRef, useCallback }   from 'react';
import { useQueryClient }                   from '@tanstack/react-query';
import { Upload, X, AlertTriangle, CheckCircle, FileText, RotateCw, Download } from '@/components/icons';
import { Button }   from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { cn }       from '@/lib/utils';

interface PreviewRow {
  rowNum:           number;
  manufacturer:     string;
  brand_name:       string;
  generic_name:     string;
  product_category: string;
  selling_price:    string;
  cost_price:       string;
  batch_no:         string;
  quantity_received:string;
  errors:           string[];
}

interface ImportResult {
  total_records:             number;
  inserted:                  number;
  updated:                   number;
  failed:                    number;
  inventory_batches_created: number;
  failed_records:            Array<{ row: number; sku: string; errors: string[] }>;
}

function headerKey(h: string): string {
  return String(h).toLowerCase().trim().replace(/[\s-]+/g, '_');
}

function cell(row: unknown[], headers: Record<string, number>, col: string): string {
  const i = headers[col];
  if (i === undefined) return '';
  const v = (row as (string | number | null | undefined)[])[i];
  return v != null ? String(v).trim() : '';
}

function validateRow(row: unknown[], headers: Record<string, number>, rowNum: number): PreviewRow {
  const brand_name       = cell(row, headers, 'brand_name');
  const generic_name     = cell(row, headers, 'generic_name');
  const manufacturer     = cell(row, headers, 'manufacturer');
  const product_category = cell(row, headers, 'product_category');
  const selling_price    = cell(row, headers, 'selling_price');
  const cost_price       = cell(row, headers, 'cost_price');
  const batch_no         = cell(row, headers, 'batch_no');
  const quantity_received= cell(row, headers, 'quantity_received');

  const errors: string[] = [];
  if (!brand_name)       errors.push('brand_name required');
  if (!generic_name)     errors.push('generic_name required');
  if (!manufacturer)     errors.push('manufacturer required');
  if (!product_category) errors.push('product_category required');

  const price = parseFloat(selling_price.replace(/,/g, ''));
  if (!selling_price || isNaN(price) || price <= 0) errors.push('selling_price must be a positive number');

  return { rowNum, manufacturer, brand_name, generic_name, product_category, selling_price, cost_price, batch_no, quantity_received, errors };
}

async function downloadTemplate() {
  const XLSX = await import('xlsx');
  const header = [
    'manufacturer', 'brand_name', 'generic_name', 'product_strength', 'pack_size',
    'product_category', 'batch_no', 'expiry_date', 'minimum_order', 'quantity_per_carton',
    'quantity_received', 'shelf_location', 'cost_price', 'selling_price',
    'minimum_stock_level', 'reorder_quantity',
  ];
  const sample = [
    'Neimeth', 'Pyrantrin Tablets', 'Pyrantel Pamoate', '125mg', '1x6x25',
    'Anti-Helmintics', 'PC0601', '2026-12-31', '1', '25',
    '100', 'AB001', '16200', '17415', '10', '20',
  ];
  const wb  = XLSX.utils.book_new();
  const ws  = XLSX.utils.aoa_to_sheet([header, sample]);
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, 'products_import_template.xlsx');
}

function BulkImportModal({ onClose }: { onClose: () => void }) {
  const toast       = useToast();
  const queryClient = useQueryClient();
  const inputRef    = useRef<HTMLInputElement>(null);

  const [file,      setFile]      = useState<File | null>(null);
  const [preview,   setPreview]   = useState<PreviewRow[] | null>(null);
  const [rawFile,   setRawFile]   = useState<File | null>(null);
  const [dragging,  setDragging]  = useState(false);
  const [parsing,   setParsing]   = useState(false);
  const [submitting,setSubmitting]= useState(false);
  const [result,    setResult]    = useState<ImportResult | null>(null);
  const [serverErr, setServerErr] = useState('');

  const validRows   = preview?.filter(r => r.errors.length === 0).length ?? 0;
  const invalidRows = preview?.filter(r => r.errors.length > 0).length  ?? 0;

  const parseFile = useCallback(async (f: File) => {
    setParsing(true);
    setPreview(null);
    setResult(null);
    setServerErr('');
    try {
      const buffer = await f.arrayBuffer();
      const XLSX   = await import('xlsx');
      const wb     = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheet  = wb.Sheets[wb.SheetNames[0]!];
      if (!sheet) { toast.show({ tone: 'error', title: 'Empty spreadsheet' }); return; }
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][];
      if (rawRows.length < 2) { toast.show({ tone: 'error', title: 'No data rows found' }); return; }
      if (rawRows.length - 1 > 1000) { toast.show({ tone: 'error', title: 'Too many rows', description: 'Max 1,000 rows per import.' }); return; }

      const headers: Record<string, number> = {};
      (rawRows[0] as string[]).forEach((h, i) => { headers[headerKey(h)] = i; });

      const rows: PreviewRow[] = [];
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i] as unknown[];
        // Skip blank rows
        const brand = cell(row, headers, 'brand_name');
        const mfr   = cell(row, headers, 'manufacturer');
        if (!brand && !mfr) continue;
        rows.push(validateRow(row, headers, i + 1));
      }
      setPreview(rows);
      setFile(f);
      setRawFile(f);
    } catch (err) {
      toast.show({ tone: 'error', title: 'Failed to parse file', description: (err as Error).message });
    } finally {
      setParsing(false);
    }
  }, [toast]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) void parseFile(f);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void parseFile(f);
  }

  async function handleSubmit() {
    if (!rawFile || !preview || validRows === 0) return;
    setSubmitting(true);
    setServerErr('');
    try {
      const fd = new FormData();
      fd.append('file', rawFile);
      const res  = await fetch('/api/products/bulk-import', { method: 'POST', credentials: 'include', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'Import failed');
      setResult(json.data as ImportResult);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', 'categories'] });
      toast.show({ tone: 'success', title: 'Import complete', description: json.message });
    } catch (err) {
      setServerErr((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const colClass = 'whitespace-nowrap px-3 py-2 text-xs';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line-subtle px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-ink">Bulk import products</h2>
            <p className="mt-0.5 text-xs text-ink-3">Upload an Excel or CSV file. Max 1,000 rows, 5 MB.</p>
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
          {/* Result */}
          {result && (
            <div className="mb-5 rounded-xl border border-line bg-bg-subtle p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={18} className="text-green-600" />
                <p className="font-semibold text-ink">Import complete</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Created',  value: result.inserted,                  color: 'text-green-700' },
                  { label: 'Updated',  value: result.updated,                   color: 'text-blue-700'  },
                  { label: 'Batches',  value: result.inventory_batches_created,  color: 'text-brand-700' },
                  { label: 'Failed',   value: result.failed,                    color: 'text-red-700'   },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg border border-line bg-white p-3 text-center">
                    <div className={cn('num text-2xl font-bold', color)}>{value}</div>
                    <div className="text-xs text-ink-3">{label}</div>
                  </div>
                ))}
              </div>
              {result.failed_records.length > 0 && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-red-700">Failed rows:</p>
                  <ul className="space-y-1">
                    {result.failed_records.slice(0, 10).map((r, i) => (
                      <li key={i} className="text-xs text-red-600">
                        Row {r.row} ({r.sku}): {r.errors.join(', ')}
                      </li>
                    ))}
                    {result.failed_records.length > 10 && (
                      <li className="text-xs text-red-400">… and {result.failed_records.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Drop zone */}
          {!preview && !parsing && (
            <div
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-14 text-center cursor-pointer transition-colors',
                dragging ? 'border-brand-400 bg-brand-50' : 'border-line hover:border-brand-300 hover:bg-bg-subtle',
              )}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <FileText size={36} className="mb-3 text-ink-3" />
              <p className="font-medium text-ink">Drop your file here, or click to browse</p>
              <p className="mt-1 text-xs text-ink-3">.xlsx, .xls, .csv — max 5 MB, max 1,000 rows</p>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={handleFileInput} />
            </div>
          )}

          {parsing && (
            <div className="flex items-center justify-center gap-3 py-16 text-ink-3">
              <RotateCw size={18} className="animate-spin" />
              <span className="text-sm">Parsing file…</span>
            </div>
          )}

          {/* Column legend */}
          {!result && (
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: 'manufacturer',      req: true  },
                { label: 'brand_name',        req: true  },
                { label: 'generic_name',      req: true  },
                { label: 'product_category',  req: true  },
                { label: 'selling_price',     req: true  },
                { label: 'cost_price',        req: false },
                { label: 'product_strength',  req: false },
                { label: 'pack_size',         req: false },
                { label: 'batch_no',          req: false },
                { label: 'expiry_date',       req: false },
                { label: 'quantity_received', req: false },
                { label: 'minimum_order',     req: false },
                { label: 'quantity_per_carton',req: false},
                { label: 'shelf_location',    req: false },
                { label: 'minimum_stock_level',req: false},
                { label: 'reorder_quantity',  req: false },
              ].map(({ label, req }) => (
                <span key={label} className={cn(
                  'rounded-md px-2 py-0.5 font-mono text-[10px]',
                  req ? 'bg-brand-100 text-brand-700' : 'bg-bg-muted text-ink-3',
                )}>
                  {label}{req ? ' *' : ''}
                </span>
              ))}
            </div>
          )}

          {/* Preview table */}
          {preview && preview.length > 0 && !result && (
            <>
              <div className="mb-3 mt-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-ink">{file?.name}</span>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    {validRows} valid
                  </span>
                  {invalidRows > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      {invalidRows} errors
                    </span>
                  )}
                </div>
                <button type="button"
                  onClick={() => { setPreview(null); setFile(null); setRawFile(null); }}
                  className="text-xs text-ink-3 hover:text-ink underline">
                  Change file
                </button>
              </div>

              {serverErr && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {serverErr}
                </div>
              )}

              <div className="overflow-auto rounded-xl border border-line" style={{ maxHeight: 340 }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-bg-subtle z-10">
                    <tr className="border-b border-line-subtle text-left">
                      <th className={cn(colClass, 'text-[10px] font-semibold uppercase tracking-widest text-ink-3')}>#</th>
                      {['Manufacturer','Brand name','Generic name','Category','Sell price','Cost price','Batch no','Qty rcvd','Errors'].map(h => (
                        <th key={h} className={cn(colClass, 'text-[10px] font-semibold uppercase tracking-widest text-ink-3')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {preview.map(row => (
                      <tr key={row.rowNum} className={cn(
                        'transition-colors',
                        row.errors.length > 0 ? 'bg-red-50 hover:bg-red-100/60' : 'hover:bg-bg-subtle/50',
                      )}>
                        <td className={cn(colClass, 'text-ink-4 font-mono')}>{row.rowNum}</td>
                        <td className={cn(colClass, !row.manufacturer ? 'text-red-500 font-medium' : 'text-ink')}>{row.manufacturer || '—'}</td>
                        <td className={cn(colClass, !row.brand_name ? 'text-red-500 font-medium' : 'text-ink font-medium')}>{row.brand_name || '—'}</td>
                        <td className={cn(colClass, 'text-ink-2')}>{row.generic_name || '—'}</td>
                        <td className={cn(colClass, !row.product_category ? 'text-red-500' : 'text-ink-2')}>{row.product_category || '—'}</td>
                        <td className={cn(colClass, 'num text-ink')}>{row.selling_price || '—'}</td>
                        <td className={cn(colClass, 'num text-ink-2')}>{row.cost_price || '—'}</td>
                        <td className={cn(colClass, 'text-ink-3')}>{row.batch_no || '—'}</td>
                        <td className={cn(colClass, 'num text-ink-3')}>{row.quantity_received || '—'}</td>
                        <td className={cn(colClass, 'max-w-[180px]')}>
                          {row.errors.length > 0 ? (
                            <span className="text-[10px] text-red-600">{row.errors.join(' · ')}</span>
                          ) : (
                            <CheckCircle size={13} className="text-green-500" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {preview && !result && (
          <div className="flex items-center justify-between border-t border-line-subtle px-6 py-4">
            <p className="text-xs text-ink-3">
              {validRows} of {preview.length} rows will be imported.
              {invalidRows > 0 && <span className="ml-1 text-red-500">Fix errors or they will be skipped.</span>}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                type="button" size="sm"
                disabled={validRows === 0 || submitting}
                loading={submitting}
                onClick={() => void handleSubmit()}
              >
                Import {validRows} product{validRows !== 1 ? 's' : ''}
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

export function ProductsImport() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={<Upload size={14} />}
        onClick={() => setOpen(true)}
      >
        Import products
      </Button>
      {open && <BulkImportModal onClose={() => setOpen(false)} />}
    </>
  );
}
