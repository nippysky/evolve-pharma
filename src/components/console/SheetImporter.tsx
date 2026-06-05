'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import type { ZodType } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Upload, Download, FileText, CheckCircle, AlertTriangle } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import type { ActionResult } from '@/lib/actions';

export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
}

interface ParsedRow<T> {
  index: number;
  cells: Record<string, string>;
  ok: boolean;
  value?: T;
  errors: string[];
}

interface SheetImporterProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  columns: ImportColumn[];
  schema: ZodType<T>;
  action: (rows: T[]) => Promise<ActionResult>;
  templateName: string;
}

export function SheetImporter<T>({
  open,
  onClose,
  title,
  columns,
  schema,
  action,
  templateName,
}: SheetImporterProps<T>) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow<T>[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [parseError, setParseError] = useState('');

  const reset = () => {
    setRows(null);
    setFileName('');
    setParseError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    reset();
    onClose();
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([columns.map((c) => c.key)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, templateName);
  };

  const parse = async (file: File) => {
    setParseError('');
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const firstSheetName = wb.SheetNames?.[0];
      if (!firstSheetName) {
        setParseError('Workbook contains no sheets.');
        setRows(null);
        return;
      }
      const ws = wb.Sheets?.[firstSheetName];
      if (!ws) {
        setParseError('Could not read the first sheet.');
        setRows(null);
        return;
      }
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      if (json.length === 0) {
        setParseError('That file has no data rows.');
        setRows([]);
        return;
      }
      const parsed: ParsedRow<T>[] = json.map((raw, i) => {
        const lookup: Record<string, string> = {};
        Object.entries(raw).forEach(([k, v]) => {
          lookup[k.trim().toLowerCase()] = v == null ? '' : String(v).trim();
        });
        const cells: Record<string, string> = {};
        columns.forEach((c) => {
          cells[c.key] = lookup[c.key.toLowerCase()] ?? '';
        });
        const res = schema.safeParse(cells);
        if (res.success) return { index: i, cells, ok: true, value: res.data, errors: [] };
        const errs = res.error.issues.map((is) => `${is.path.join('.') || 'row'}: ${is.message}`);
        return { index: i, cells, ok: false, errors: errs };
      });
      setRows(parsed);
    } catch {
      setParseError('Could not read that file. Use .xlsx, .xls or .csv.');
      setRows(null);
    }
  };

  const valid = rows?.filter((r) => r.ok) ?? [];
  const invalid = rows?.filter((r) => !r.ok) ?? [];

  const doImport = async () => {
    if (valid.length === 0) return;
    setSubmitting(true);
    const r = await action(valid.map((v) => v.value as T));
    setSubmitting(false);
    if (r.ok) {
      const created = (r.data as { created?: number } | undefined)?.created ?? valid.length;
      toast.show({
        tone: 'success',
        title: `Imported ${created} ${created === 1 ? 'record' : 'records'}`,
        description: invalid.length ? `${invalid.length} row(s) were skipped.` : undefined,
      });
      close();
      router.refresh();
    } else {
      toast.show({ tone: 'error', title: 'Import failed', description: r.message });
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      description="Upload an .xlsx or .csv. Each row is validated before anything is created."
      size="xl"
      footer={
        rows ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-ink-3">
              {valid.length} ready · {invalid.length} skipped
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={reset}>
                Choose another
              </Button>
              <Button type="button" loading={submitting} disabled={valid.length === 0} onClick={doImport}>
                Import {valid.length}
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-3">
          Expected columns:{' '}
          <span className="font-medium text-ink-2">{columns.map((c) => c.key).join(', ')}</span>
        </p>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline"
        >
          <Download size={13} /> Download template
        </button>
      </div>

      {!rows ? (
        <>
          <label
            htmlFor="sheet-import"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-line-strong bg-bg-subtle px-5 py-9 text-center transition-colors hover:border-brand-500 hover:bg-brand-50"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-brand-600">
              <Upload size={18} />
            </span>
            <span className="text-sm font-medium text-ink">Click to upload a spreadsheet</span>
            <span className="text-xs text-ink-3">.xlsx, .xls or .csv · or drag and drop</span>
          </label>
          <input
            ref={inputRef}
            id="sheet-import"
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void parse(f);
            }}
          />
          {parseError && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-danger">
              <AlertTriangle size={12} /> {parseError}
            </p>
          )}
        </>
      ) : (
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-ink-2">
            <FileText size={14} className="text-ink-3" />
            <span className="font-medium text-ink">{fileName}</span>
            <span className="text-ink-3">· {rows.length} rows</span>
          </div>

          <div className="max-h-[42dvh] overflow-auto rounded-lg border border-line">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-bg-subtle text-[11px] font-semibold uppercase tracking-widest text-ink-3">
                <tr>
                  <th className="px-3 py-2">#</th>
                  {columns.map((c) => (
                    <th key={c.key} className="px-3 py-2">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.index} className="border-t border-line-subtle align-top">
                    <td className="px-3 py-2 text-ink-3">{r.index + 1}</td>
                    {columns.map((c) => (
                      <td key={c.key} className="px-3 py-2 text-ink">
                        {r.cells[c.key] || <span className="text-ink-4">—</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {r.ok ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-leaf-600">
                          <CheckCircle size={12} /> Valid
                        </span>
                      ) : (
                        <span className="inline-flex flex-col gap-0.5 text-xs text-danger">
                          {r.errors.map((e, i) => (
                            <span key={i} className="inline-flex items-center gap-1">
                              <AlertTriangle size={11} /> {e}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}