'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ZodTypeAny } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { AlertTriangle } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import type { ActionResult } from '@/lib/actions';

export interface EntityField {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'select';
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  full?: boolean;
  defaultValue?: string;
}

interface CreateEntityModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  fields: EntityField[];
  schema: ZodTypeAny;
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel?: string;
  successTitle?: string;
  size?: 'md' | 'lg' | 'xl';
}

export function CreateEntityModal({
  open,
  onClose,
  title,
  description,
  fields,
  schema,
  action,
  submitLabel = 'Save',
  successTitle = 'Done',
  size = 'lg',
}: CreateEntityModalProps) {
  const router = useRouter();
  const toast = useToast();
  const blank = () =>
    Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ''])) as Record<string, string>;

  const [values, setValues] = useState<Record<string, string>>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const close = () => {
    setValues(blank());
    setErrors({});
    setServerError('');
    onClose();
  };

  const submit = async () => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors as Record<string, string[]>;
      const e: Record<string, string> = {};
      Object.entries(fe).forEach(([k, m]) => {
        if (m?.[0]) e[k] = m[0];
      });
      setErrors(e);
      return;
    }
    setErrors({});
    setServerError('');
    setSubmitting(true);
    const fd = new FormData();
    Object.entries(values).forEach(([k, v]) => fd.set(k, v));
    const r = await action(fd);
    setSubmitting(false);
    if (r.ok) {
      toast.show({ tone: 'success', title: successTitle });
      close();
      router.refresh();
    } else {
      setServerError(r.message);
      if (r.fieldErrors) {
        const e: Record<string, string> = {};
        Object.entries(r.fieldErrors).forEach(([k, m]) => {
          if (m?.[0]) e[k] = m[0];
        });
        setErrors((prev) => ({ ...prev, ...e }));
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      description={description}
      size={size}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="button" loading={submitting} onClick={submit}>
            {submitLabel}
          </Button>
        </div>
      }
    >
      {serverError && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-danger-soft px-3.5 py-3 text-sm text-red-800">
          <AlertTriangle size={14} className="mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      <div className="grid gap-x-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className={f.full ? 'sm:col-span-2' : ''}>
            <Field label={f.label} htmlFor={f.name} required={f.required} hint={f.hint} error={errors[f.name]}>
              {f.type === 'select' ? (
                <Select id={f.name} name={f.name} value={values[f.name]} onChange={set(f.name)}>
                  <option value="">Select…</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={f.name}
                  name={f.name}
                  type={f.type ?? 'text'}
                  value={values[f.name]}
                  onChange={set(f.name)}
                  placeholder={f.placeholder}
                />
              )}
            </Field>
          </div>
        ))}
      </div>
    </Modal>
  );
}