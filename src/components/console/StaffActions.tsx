'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Plus, Upload, AlertTriangle } from '@/components/icons';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/contexts/ToastContext';
import { useRegisterStaff, useBulkUploadStaff } from '@/hooks/staff/useStaff';

// ---------- Add staff modal -------------------------------------------------

function AddStaffModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast       = useToast();
  const registerMut = useRegisterStaff();
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '',
    email: '', phone: '', department: '', job_title: '', gender: '',
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
        gender:      form.gender,
      },
      {
        onSuccess: () => {
          toast.show({
            tone: 'success',
            title: 'Staff added',
            description: 'An email has been sent for them to verify their account.',
          });
          onClose();
          setForm({ first_name:'', middle_name:'', last_name:'', email:'', phone:'', department:'', job_title:'', gender:'' });
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
            <Input id="sf-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@envolvepharm.com.ng" required />
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
          <Field label="Gender" htmlFor="sf-gender" required error={firstErr('gender')}>
            <select
              id="sf-gender"
              value={form.gender}
              onChange={(e) => set('gender', e.target.value)}
              required
              className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-brand-500 focus:outline-none"
            >
              <option value="" disabled>Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Prefer not to say</option>
            </select>
          </Field>

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

// ---------- Bulk upload modal -----------------------------------------------

function BulkUploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast     = useToast();
  const uploadMut = useBulkUploadStaff();
  const inputRef  = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  if (!open) return null;

  const submit = () => {
    if (!file) return;
    uploadMut.mutate(file, {
      onSuccess: (data) => {
        const existing = data.existing_emails?.length ?? 0;
        toast.show({
          tone: existing > 0 && data.total_record_inserted === 0 ? 'warning' : 'success',
          title: `${data.total_record_inserted} staff added`,
          description:
            existing > 0
              ? `${existing} email(s) already exist and were skipped.`
              : 'All records inserted. Staff will receive verification emails.',
        });
        if (data.total_record_inserted > 0) onClose();
      },
      onError: (err: Error) => {
        toast.show({ tone: 'error', title: 'Upload failed', description: err.message });
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold tracking-tight text-ink">Import staff</h2>
        <p className="mt-1 text-sm text-ink-3">
          Upload an Excel (.xlsx) file. Required columns: first_name, last_name, email, phone, gender.
          Optional: middle_name, department, job_title.
        </p>

        <div
          className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-bg-subtle py-8 transition-colors hover:border-brand-400"
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={20} className="text-ink-3" />
          <p className="text-sm text-ink-2">{file ? file.name : 'Click to choose a file'}</p>
          {file && <p className="text-xs text-ink-3">{(file.size / 1024).toFixed(1)} KB</p>}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={uploadMut.isPending}>
            Cancel
          </Button>
          <Button size="sm" loading={uploadMut.isPending} disabled={!file} onClick={submit}>
            Upload
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Exported component ---------------------------------------------

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
