'use client';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/Button';
import { Plus, Upload, AlertTriangle, CheckCircle, XCircle, X } from '@/components/icons';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/contexts/ToastContext';
import { useRegisterStaff, useBulkUploadStaff } from '@/hooks/staff/useStaff';
import type { StaffBulkUploadResult as BulkUploadResult } from '@/lib/api/types';
import { cn } from '@/lib/utils';

function AddStaffModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast       = useToast();
  const registerMut = useRegisterStaff();
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '',
    email: '', phone: '', department: '', job_title: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  if (!open) return null;

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setFieldErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    registerMut.mutate(
      {
        first_name:  form.first_name.trim(),
        middle_name: form.middle_name.trim() || undefined,
        last_name:   form.last_name.trim(),
        email:       form.email.trim(),
        phone:       form.phone.trim(),
        department:  form.department.trim() || undefined,
        job_title:   form.job_title.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.show({
            tone: 'success',
            title: 'Staff added',
            description: 'An email has been sent for them to verify their account.',
          });
          onClose();
          setForm({ first_name:'', middle_name:'', last_name:'', email:'', phone:'', department:'', job_title:'' });
        },
        onError: (err: Error & { fieldErrors?: Record<string, string[]> }) => {
          if (err.fieldErrors) {
            setFieldErrors(err.fieldErrors);
          } else {
            toast.show({ tone: 'error', title: 'Failed to add staff', description: err.message });
          }
        },
      },
    );
  };

  const firstErr = (key: string) => fieldErrors[key]?.[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold tracking-tight text-ink">Add a staff member</h2>
        <p className="mt-1 text-sm text-ink-3">
          They'll receive an email to verify their account and set a password.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-0">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="sf-first" required error={firstErr('first_name')}>
              <Input id="sf-first" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="Ngozi" required />
            </Field>
            <Field label="Last name" htmlFor="sf-last" required error={firstErr('last_name')}>
              <Input id="sf-last" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="Umeh" required />
            </Field>
          </div>
          <Field label="Middle name" htmlFor="sf-mid" error={firstErr('middle_name')}>
            <Input id="sf-mid" value={form.middle_name} onChange={(e) => set('middle_name', e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Work email" htmlFor="sf-email" required error={firstErr('email')}>
            <Input id="sf-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@ece.envolvepharm.com.ng" required />
          </Field>
          <Field label="Phone" htmlFor="sf-phone" required error={firstErr('phone')}>
            <Input id="sf-phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+234 800 000 0000" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department" htmlFor="sf-dept" error={firstErr('department')}>
              <Input id="sf-dept" value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Sales" />
            </Field>
            <Field label="Job title" htmlFor="sf-title" error={firstErr('job_title')}>
              <Input id="sf-title" value={form.job_title} onChange={(e) => set('job_title', e.target.value)} placeholder="Sales Rep" />
            </Field>
          </div>
          {registerMut.isError && !Object.keys(fieldErrors).length && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-danger-soft px-3 py-2.5 text-sm text-red-800">
              <AlertTriangle size={13} />
              <span>{(registerMut.error as Error).message}</span>
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2 border-t border-line-subtle pt-4">
            <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={registerMut.isPending}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={registerMut.isPending}>
              Add staff member
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ACCEPTED_TYPES = '.xlsx,.xls,.csv';
const ACCEPTED_MIME  = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'text/plain',
]);
const EMAIL_RE_STAFF = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Required columns match the backend's staff_template.xlsx exactly.
// gender is NOT in the backend template — department & job_title are optional.
const STAFF_REQUIRED = ['first_name', 'last_name', 'email', 'phone'] as const;
const STAFF_ALL_COLS = ['first_name', 'middle_name', 'last_name', 'email', 'phone', 'department', 'job_title'] as const;

function isAccepted(file: File) {
  if (ACCEPTED_MIME.has(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['xlsx', 'xls', 'csv'].includes(ext);
}

/** Download a CSV with the exact backend-expected headers + one sample row. */
function downloadStaffTemplate() {
  const headers = STAFF_ALL_COLS.join(',');
  const sample  = 'John,A.,Doe,john.doe@company.com,+2348000000000,Sales,Sales Representative';
  const csv     = `${headers}\n${sample}\n`;
  const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = 'staff_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface StaffPreviewRow {
  index: number;
  cells: Record<string, string>;
  errors: string[];
  valid: boolean;
}

async function parseStaffFile(file: File): Promise<StaffPreviewRow[]> {
  const buf    = await file.arrayBuffer();
  const wb     = XLSX.read(buf, { type: 'array' });
  const wsName = wb.SheetNames[0];
  if (!wsName) throw new Error('File has no sheets.');
  const ws = wb.Sheets[wsName];
  if (!ws) throw new Error('Could not read the first sheet.');
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  if (json.length === 0) throw new Error('File contains no data rows.');

  // ── Column-header guard ────────────────────────────────────────────────────
  // Detect uploaded headers so we can give a friendly error if they don't
  // match the template before the user tries to import.
  const fileHeaders = Object.keys(json[0] ?? {}).map((k) => k.trim().toLowerCase());
  const missingRequired = STAFF_REQUIRED.filter((col) => !fileHeaders.includes(col));
  if (missingRequired.length > 0) {
    throw new Error(
      `File headers don't match the template.\n` +
      `Missing required columns: ${missingRequired.join(', ')}.\n` +
      `Download the sample template to see the expected format.`,
    );
  }

  return json.map((raw, i) => {
    const lookup: Record<string, string> = {};
    Object.entries(raw).forEach(([k, v]) => {
      lookup[k.trim().toLowerCase()] = v == null ? '' : String(v).trim();
    });
    // Extract all recognised columns
    const cells: Record<string, string> = {};
    STAFF_ALL_COLS.forEach((col) => { cells[col] = lookup[col] ?? ''; });

    const errors: string[] = [];
    STAFF_REQUIRED.forEach((col) => {
      if (!cells[col]) errors.push(`${col} is required`);
    });
    if (cells.email && !EMAIL_RE_STAFF.test(cells.email)) errors.push('email format invalid');

    return { index: i, cells, errors, valid: errors.length === 0 };
  });
}

const PREVIEW_LIMIT_STAFF = 100;

function BulkUploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast     = useToast();
  const uploadMut = useBulkUploadStaff();
  const inputRef  = useRef<HTMLInputElement>(null);

  const [file,        setFile]        = useState<File | null>(null);
  const [preview,     setPreview]     = useState<StaffPreviewRow[] | null>(null);
  const [parsing,     setParsing]     = useState(false);
  const [parseErr,    setParseErr]    = useState('');
  const [typeError,   setTypeError]   = useState('');
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null);
  const [uploadErrMsg, setUploadErrMsg] = useState('');

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setPreview(null);
    setParseErr('');
    setTypeError('');
    setUploadResult(null);
    setUploadErrMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (f: File | undefined) => {
    if (!f) return;
    if (!isAccepted(f)) {
      setTypeError('Unsupported file type. Please upload a .xlsx, .xls or .csv file.');
      return;
    }
    setTypeError('');
    setFile(f);
    setPreview(null);
    setParseErr('');
    setParsing(true);
    try {
      const rows = await parseStaffFile(f);
      setPreview(rows);
    } catch (e) {
      setParseErr((e as Error).message ?? 'Could not read file.');
    } finally {
      setParsing(false);
    }
  };

  const validCount   = preview?.filter((r) => r.valid).length ?? 0;
  const invalidCount = preview?.filter((r) => !r.valid).length ?? 0;
  const canUpload    = !!file && !parsing && !!preview && validCount > 0;

  const submit = () => {
    if (!file) return;
    setUploadResult(null);
    setUploadErrMsg('');
    uploadMut.mutate(file, {
      onSuccess: (data: BulkUploadResult) => {
        const existing = data.existing_emails?.length ?? 0;
        toast.show({
          tone: existing > 0 && data.total_record_inserted === 0 ? 'warning' : 'success',
          title: `${data.total_record_inserted} staff added`,
          description:
            existing > 0
              ? `${existing} email(s) already exist and were skipped.`
              : 'All records inserted. Staff will receive verification emails.',
        });
        if (data.total_record_inserted > 0) { reset(); onClose(); }
      },
      onError: (err: Error & { uploadResult?: BulkUploadResult }) => {
        if (err.uploadResult) {
          setUploadResult(err.uploadResult);
        } else {
          setUploadErrMsg(err.message ?? 'Upload failed. Please try again.');
        }
      },
    });
  };

  const displayed = preview?.slice(0, PREVIEW_LIMIT_STAFF) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className={cn(
        'flex w-full flex-col rounded-2xl border border-line bg-white shadow-2xl transition-all',
        preview ? 'max-w-3xl' : 'max-w-md',
      )}>
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line px-6 py-5">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">Import staff</h2>
            <p className="mt-0.5 text-sm text-ink-3">
              {preview
                ? `${preview.length} rows found in ${file?.name}`
                : 'Upload an Excel or CSV file. Data is previewed before import.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            disabled={uploadMut.isPending}
            className="rounded-lg p-1.5 text-ink-3 hover:bg-bg-muted hover:text-ink transition-colors"
          >
            <XCircle size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: '70vh' }}>

          {!preview && (
            <>
              <div className="mb-4 rounded-lg bg-bg-subtle px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-2">Required columns</p>
                    <p className="mt-1 font-mono text-[11px] text-ink-3 leading-relaxed">
                      first_name · last_name · email · phone
                    </p>
                    <p className="mt-2 text-xs font-medium text-ink-2">Optional</p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-3">
                      middle_name · department · job_title
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadStaffTemplate}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-brand-600 shadow-sm hover:bg-bg-subtle transition-colors"
                  >
                    <Upload size={11} className="rotate-180" />
                    Download template
                  </button>
                </div>
              </div>

              <div
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-bg-subtle py-10 transition-colors',
                  parsing ? 'cursor-default border-brand-300 opacity-60' : 'border-line hover:border-brand-400 hover:bg-brand-50/30',
                )}
                onClick={() => !parsing && inputRef.current?.click()}
              >
                {parsing ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    <p className="text-sm text-ink-3">Parsing file…</p>
                  </>
                ) : (
                  <>
                    <Upload size={20} className="text-ink-3" />
                    <p className="text-sm font-medium text-ink-2">
                      {file ? file.name : 'Click to choose a file'}
                    </p>
                    <p className="text-xs text-ink-3">.xlsx · .xls · .csv</p>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  className="hidden"
                  onChange={(e) => { void handleFile(e.target.files?.[0]); }}
                />
              </div>
              {typeError && <p className="mt-2 text-xs text-red-600">{typeError}</p>}
              {parseErr  && <p className="mt-2 text-xs text-red-600"><AlertTriangle size={11} className="inline mr-1" />{parseErr}</p>}
            </>
          )}

          {/* ── Upload result (shown after API responds) ─────────────────── */}
          {uploadResult && (
            <div className="mb-4">
              {/* Summary bar */}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                {(uploadResult.successful ?? 0) > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-3 py-1 text-xs font-semibold text-leaf-700 ring-1 ring-inset ring-leaf-200">
                    <CheckCircle size={12} /> {uploadResult.successful ?? 0} inserted
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                  <AlertTriangle size={12} /> {uploadResult.failed} failed
                </span>
                <span className="text-xs text-ink-3 ml-auto">{uploadResult.total_records} total rows</span>
              </div>

              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium text-red-800 mb-1">Upload completed with errors</p>
                <p className="text-xs text-red-700 leading-relaxed">
                  The rows below could not be inserted. This is a server-side issue — please contact your backend engineer.
                  You can retry after the issue is resolved.
                </p>
              </div>

              <div className="rounded-xl border border-line overflow-hidden">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-bg-subtle text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                    <tr>
                      <th className="px-3 py-2.5 w-12">Row</th>
                      <th className="px-3 py-2.5">Email</th>
                      <th className="px-3 py-2.5">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResult.failed_records.map((r: BulkUploadResult['failed_records'][number]) => (
                      <tr key={r.row} className="border-t border-line bg-red-50/40">
                        <td className="px-3 py-2.5 text-xs text-ink-3">{r.row}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-ink">{r.email}</td>
                        <td className="px-3 py-2.5 text-xs text-red-700">
                          {r.errors.join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {uploadErrMsg && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm leading-relaxed text-red-800">{uploadErrMsg}</p>
            </div>
          )}

          {preview && (
            <>
              {/* Summary */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-3 py-1 text-xs font-semibold text-leaf-700 ring-1 ring-inset ring-leaf-200">
                  <CheckCircle size={12} /> {validCount} valid
                </span>
                {invalidCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                    <AlertTriangle size={12} /> {invalidCount} {invalidCount === 1 ? 'row has' : 'rows have'} errors
                  </span>
                )}
                <button type="button" onClick={reset} className="ml-auto text-xs font-medium text-brand-600 hover:underline">
                  Choose a different file
                </button>
              </div>

              {invalidCount > 0 && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-xs leading-relaxed text-amber-800">
                    Rows with errors will be rejected by the server. Fix them in your file and re-upload,
                    or proceed to import only the {validCount} valid row{validCount !== 1 ? 's' : ''}.
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-line overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-bg-subtle text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                      <tr>
                        <th className="px-3 py-2.5 w-10">#</th>
                        <th className="px-3 py-2.5">Name</th>
                        <th className="px-3 py-2.5">Email</th>
                        <th className="px-3 py-2.5">Phone</th>
                        <th className="px-3 py-2.5">Department</th>
                        <th className="px-3 py-2.5">Job title</th>
                        <th className="px-3 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((row) => (
                        <tr key={row.index} className={cn('border-t border-line align-top', !row.valid && 'bg-red-50/60')}>
                          <td className="px-3 py-2.5 text-xs text-ink-3">{row.index + 1}</td>
                          <td className="px-3 py-2.5 text-xs">
                            <span className={cn(!row.cells.first_name || !row.cells.last_name ? 'text-red-600' : 'text-ink')}>
                              {[row.cells.first_name, row.cells.middle_name, row.cells.last_name].filter(Boolean).join(' ') || <span className="italic text-red-400">missing</span>}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            <span className={cn(!row.cells.email || !EMAIL_RE_STAFF.test(row.cells.email) ? 'text-red-600' : 'text-ink')}>
                              {row.cells.email || <span className="italic text-red-400">missing</span>}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            <span className={cn(!row.cells.phone ? 'text-red-500 italic' : 'text-ink')}>
                              {row.cells.phone || 'missing'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-ink-2">{row.cells.department || <span className="text-ink-4">—</span>}</td>
                          <td className="px-3 py-2.5 text-xs text-ink-2">{row.cells.job_title  || <span className="text-ink-4">—</span>}</td>
                          <td className="px-3 py-2.5 text-right">
                            {row.valid ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-leaf-600">
                                <CheckCircle size={12} /> Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 cursor-help" title={row.errors.join('\n')}>
                                <AlertTriangle size={12} />
                                {row.errors.length} error{row.errors.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {preview.length > PREVIEW_LIMIT_STAFF && (
                        <tr className="border-t border-line bg-bg-subtle">
                          <td colSpan={6} className="px-4 py-2.5 text-center text-xs text-ink-3">
                            …and {preview.length - PREVIEW_LIMIT_STAFF} more rows (all will be uploaded)
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line px-6 py-4">
          <p className="text-xs text-ink-3">
            {preview
              ? `${validCount} of ${preview.length} rows ready to import`
              : 'Select a file to preview before uploading'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { reset(); onClose(); }} disabled={uploadMut.isPending}>
              Cancel
            </Button>
            <Button size="sm" loading={uploadMut.isPending} disabled={!canUpload} onClick={submit}>
              {invalidCount > 0
                ? `Upload ${validCount} valid row${validCount !== 1 ? 's' : ''}`
                : `Upload ${validCount} staff member${validCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StaffActions() {
  const [addOpen,    setAddOpen]    = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" leadingIcon={<Upload size={14} />} onClick={() => setImportOpen(true)}>
        Import
      </Button>
      <Button leadingIcon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
        Add staff
      </Button>

      <AddStaffModal    open={addOpen}    onClose={() => setAddOpen(false)} />
      <BulkUploadModal  open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
