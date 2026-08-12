'use client';

/**
 * Quick bulk product add — six columns only.
 *
 * For standing the catalogue up fast: manufacturer, brand, generic, category,
 * strength and pack size. Pricing, stock and images come later.
 *
 * Everything created here is a DRAFT with no price. The publish guards in
 * /api/products/bulk-actions and the single-product PATCH refuse to activate a
 * product priced at zero, so an unpriced draft cannot reach the catalogue.
 *
 * Deliberately separate from ProductsImport (the full 15-column importer) so
 * that path is untouched.
 */

import { useState, useRef, useCallback } from 'react';
import { useQueryClient }                from '@tanstack/react-query';
import * as XLSX                         from 'xlsx';
import {
  Upload, X, AlertTriangle, CheckCircle, FileText, RotateCw, Download, Sparkle,
} from '@/components/icons';
import { Button }   from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { cn }       from '@/lib/utils';

const COLUMNS = [
  { key: 'manufacturer',     label: 'Manufacturer',     required: true  },
  { key: 'brand_name',       label: 'Brand name',       required: true  },
  { key: 'generic_name',     label: 'Generic name',     required: true  },
  { key: 'product_category', label: 'Product category', required: true  },
  { key: 'product_strength', label: 'Product strength', required: false },
  { key: 'pack_size',        label: 'Pack size',        required: false },
] as const;

interface PreviewRow {
  rowNum:           number;
  manufacturer:     string;
  brand_name:       string;
  generic_name:     string;
  product_category: string;
  product_strength: string;
  pack_size:        string;
  errors:           string[];
}

interface QuickImportResult {
  total_records:  number;
  created:        number;
  skipped:        number;
  failed:         number;
  failed_records: Array<{ row: number; sku?: string; errors: string[] }>;
}

function headerKey(h: string): string {
  return String(h).toLowerCase().trim().replace(/[\s-]+/g, '_');
}

/** Same aliases the API accepts, so preview and server agree. */
const ALIASES: Record<string, string> = {
  manufacturer: 'manufacturer',
  brand: 'brand_name', brand_name: 'brand_name', brandname: 'brand_name',
  generic: 'generic_name', generic_name: 'generic_name', genericname: 'generic_name',
  category: 'product_category', product_category: 'product_category', productcategory: 'product_category',
  strength: 'product_strength', product_strength: 'product_strength', productstrength: 'product_strength',
  pack: 'pack_size', pack_size: 'pack_size', packsize: 'pack_size',
};

function cell(row: unknown[], headers: Record<string, number>, col: string): string {
  const i = headers[col];
  if (i === undefined) return '';
  const v = (row as (string | number | null | undefined)[])[i];
  return v != null ? String(v).trim() : '';
}

function validateRow(row: unknown[], headers: Record<string, number>, rowNum: number): PreviewRow {
  const manufacturer     = cell(row, headers, 'manufacturer');
  const brand_name       = cell(row, headers, 'brand_name');
  const generic_name     = cell(row, headers, 'generic_name');
  const product_category = cell(row, headers, 'product_category');
  const product_strength = cell(row, headers, 'product_strength');
  const pack_size        = cell(row, headers, 'pack_size');

  const errors: string[] = [];
  if (!manufacturer)     errors.push('manufacturer required');
  if (!brand_name)       errors.push('brand name required');
  if (!generic_name)     errors.push('generic name required');
  if (!product_category) errors.push('category required');

  return {
    rowNum, manufacturer, brand_name, generic_name,
    product_category, product_strength, pack_size, errors,
  };
}

export function QuickProductsImport() {
  const toast = useToast();
  const qc    = useQueryClient();

  const [open,      setOpen]      = useState(false);
  const [file,      setFile]      = useState<File | null>(null);
  const [preview,   setPreview]   = useState<PreviewRow[] | null>(null);
  const [parsing,   setParsing]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result,    setResult]    = useState<QuickImportResult | null>(null);
  const [parseErr,  setParseErr]  = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null); setPreview(null); setResult(null);
    setParseErr(''); setUploading(false); setParsing(false);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  function close() { setOpen(false); reset(); }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      COLUMNS.map(c => c.key),
      ['Emzor', 'Paracetamol 500mg Tabs', 'Paracetamol', 'Analgesics', '500mg', '1 x 10 x 10'],
      ['Fidson', 'Amoxil Caps', 'Amoxicillin', 'Antibiotics', '250mg', '1 x 10'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'quick-product-template.xlsx');
  }

  async function handleFile(f: File) {
    setFile(f); setParseErr(''); setResult(null); setParsing(true);
    try {
      const buf   = await f.arrayBuffer();
      const wb    = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]!];
      if (!sheet) throw new Error('The file has no sheets.');

      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      if (rows.length < 2) throw new Error('The file needs a header row and at least one data row.');

      const headerRow = rows[0] as unknown[];
      const headers: Record<string, number> = {};
      headerRow.forEach((h, i) => {
        const canonical = ALIASES[headerKey(String(h))];
        if (canonical) headers[canonical] = i;
      });

      const missing = COLUMNS.filter(c => c.required && headers[c.key] === undefined);
      if (missing.length) {
        throw new Error(`Missing required column${missing.length > 1 ? 's' : ''}: ${missing.map(m => m.label).join(', ')}.`);
      }

      const body = rows.slice(1).filter(r => (r as unknown[]).some(v => String(v ?? '').trim() !== ''));
      setPreview(body.map((r, i) => validateRow(r as unknown[], headers, i + 2)));
    } catch (err) {
      setParseErr(err instanceof Error ? err.message : 'Could not read that file.');
      setPreview(null);
    } finally {
      setParsing(false);
    }
  }

  async function submit() {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch('/api/products/quick-import', {
        method: 'POST', body: fd, credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'Import failed.');

      setResult(json.data as QuickImportResult);
      void qc.invalidateQueries({ queryKey: ['admin-products'] });
      toast.show({
        tone:  'success',
        title: json.message ?? 'Import complete',
        description: 'Products were created as drafts. Add pricing before publishing.',
      });
    } catch (err) {
      toast.show({ tone: 'error', title: 'Import failed', description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  }

  const validCount   = preview?.filter(r => r.errors.length === 0).length ?? 0;
  const invalidCount = (preview?.length ?? 0) - validCount;

  return (
    <>
      <Button
        variant="secondary"
        leadingIcon={<Sparkle size={14} />}
        onClick={() => setOpen(true)}
      >
        Quick add
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-xl">

            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
              <div>
                <h2 className="text-base font-semibold text-ink">Quick add products</h2>
                <p className="mt-0.5 text-xs text-ink-3">
                  Six columns only. Pricing, stock and images can be filled in later.
                </p>
              </div>
              <button
                type="button" onClick={close} aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-bg-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {result ? (
                /* ── Result ── */
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
                    <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-500" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">
                        {result.created} draft product{result.created !== 1 ? 's' : ''} created
                      </p>
                      <p className="mt-0.5 text-xs text-emerald-700">
                        They are saved as drafts with no price. Set a selling price on each
                        before publishing — publishing an unpriced product is blocked.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { label: 'Rows read', value: result.total_records },
                      { label: 'Created',   value: result.created },
                      { label: 'Skipped',   value: result.failed },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl border border-line px-3 py-2.5">
                        <p className="text-lg font-bold text-ink">{s.value}</p>
                        <p className="text-[11px] text-ink-3">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {result.failed_records.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="mb-2 text-xs font-semibold text-amber-800">
                        Skipped rows
                      </p>
                      <ul className="max-h-40 space-y-1 overflow-y-auto">
                        {result.failed_records.map((f, i) => (
                          <li key={i} className="text-[11px] text-amber-700">
                            Row {f.row}{f.sku ? ` (${f.sku})` : ''}: {f.errors.join(', ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : !preview ? (
                /* ── Upload ── */
                <div className="space-y-4">
                  <div className="rounded-xl border border-line bg-bg-subtle p-4">
                    <p className="mb-2 text-xs font-semibold text-ink-2">Expected columns</p>
                    <div className="flex flex-wrap gap-1.5">
                      {COLUMNS.map(c => (
                        <span
                          key={c.key}
                          className={cn(
                            'rounded-md px-2 py-0.5 font-mono text-[11px]',
                            c.required
                              ? 'bg-ink text-white'
                              : 'border border-line bg-white text-ink-3',
                          )}
                        >
                          {c.key}{c.required ? '' : '?'}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-ink-4">
                      Bold columns are required. The SKU is generated automatically from
                      manufacturer + brand name.
                    </p>
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline"
                    >
                      <Download size={12} />
                      Download template
                    </button>
                  </div>

                  <label
                    className={cn(
                      'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
                      parseErr ? 'border-red-300 bg-red-50' : 'border-line hover:border-brand-300 hover:bg-bg-subtle',
                    )}
                  >
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
                    />
                    {parsing ? (
                      <><RotateCw size={22} className="animate-spin text-ink-3" />
                        <p className="text-sm text-ink-3">Reading file…</p></>
                    ) : (
                      <><Upload size={22} className="text-ink-3" />
                        <p className="text-sm font-medium text-ink">Choose a spreadsheet</p>
                        <p className="text-xs text-ink-4">.xlsx, .xls or .csv · max 1,000 rows</p></>
                    )}
                  </label>

                  {parseErr && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-500" />
                      <p className="text-xs text-red-800">{parseErr}</p>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Preview ── */
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs">
                    <FileText size={13} className="text-ink-3" />
                    <span className="font-medium text-ink">{file?.name}</span>
                    <span className="text-ink-4">·</span>
                    <span className="text-emerald-600">{validCount} ready</span>
                    {invalidCount > 0 && (
                      <>
                        <span className="text-ink-4">·</span>
                        <span className="text-red-600">{invalidCount} with problems</span>
                      </>
                    )}
                  </div>

                  <div className="max-h-80 overflow-auto rounded-xl border border-line">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-bg-subtle">
                        <tr>
                          <th className="px-3 py-2 font-semibold text-ink-3">#</th>
                          {COLUMNS.map(c => (
                            <th key={c.key} className="px-3 py-2 font-semibold text-ink-3">{c.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-subtle">
                        {preview.map(r => (
                          <tr key={r.rowNum} className={cn(r.errors.length > 0 && 'bg-red-50')}>
                            <td className="px-3 py-2 text-ink-4">{r.rowNum}</td>
                            <td className="px-3 py-2 text-ink">{r.manufacturer || '—'}</td>
                            <td className="px-3 py-2 text-ink">{r.brand_name || '—'}</td>
                            <td className="px-3 py-2 text-ink-2">{r.generic_name || '—'}</td>
                            <td className="px-3 py-2 text-ink-2">{r.product_category || '—'}</td>
                            <td className="px-3 py-2 text-ink-3">{r.product_strength || '—'}</td>
                            <td className="px-3 py-2 text-ink-3">{r.pack_size || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {invalidCount > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-xs text-amber-800">
                        Rows highlighted in red are missing required values and will be skipped.
                        The other {validCount} will still import.
                      </p>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-blue-500" />
                    <p className="text-xs text-blue-800">
                      These import as <strong>drafts with no price</strong>. They stay out of the
                      catalogue until you set a selling price and publish them.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
              <p className="text-xs text-ink-3">
                {result
                  ? 'Import finished.'
                  : preview
                    ? `${validCount} of ${preview.length} row${preview.length !== 1 ? 's' : ''} ready`
                    : 'Nothing selected yet.'}
              </p>
              <div className="flex items-center gap-2">
                {preview && !result && (
                  <Button variant="secondary" onClick={reset} disabled={uploading}>
                    Choose another file
                  </Button>
                )}
                {result ? (
                  <Button onClick={close}>Done</Button>
                ) : (
                  <Button
                    onClick={submit}
                    loading={uploading}
                    disabled={!preview || validCount === 0 || uploading}
                  >
                    Import {validCount > 0 ? validCount : ''} product{validCount !== 1 ? 's' : ''}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
