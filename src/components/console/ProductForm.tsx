'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Input, Textarea, Select, Checkbox } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { CheckCircle, AlertTriangle } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { createProductAction, updateProductAction } from '@/lib/actions/console';
import type { ActionResult } from '@/lib/actions';
import { PRODUCT_CATEGORIES, PRODUCT_FORMS } from '@/lib/constants';
import type { Product } from '@/types';

const initial: ActionResult = { ok: false, message: '' };

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active — visible & orderable' },
  { value: 'draft', label: 'Draft — hidden from catalog' },
  { value: 'discontinued', label: 'Discontinued — retired' },
];

interface ProductFormProps {
  product?: Product;
  mode: 'create' | 'edit';
}

export function ProductForm({ product, mode }: ProductFormProps) {
  const toast = useToast();
  const router = useRouter();

  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r =
      mode === 'create' ? await createProductAction(fd) : await updateProductAction(product!.id, fd);
    if (r.ok) {
      toast.show({ tone: 'success', title: mode === 'create' ? 'Product created' : 'Product updated' });
      if (mode === 'create') router.push('/console/products');
      else router.refresh();
    } else if (!r.fieldErrors) {
      toast.show({
        tone: 'error',
        title: mode === 'create' ? 'Create failed' : 'Update failed',
        description: r.message,
      });
    }
    return r;
  }, initial);

  const fieldErrors = !state.ok ? state.fieldErrors : undefined;
  const error = !state.ok && !fieldErrors ? state.message : '';

  return (
    <form action={action} className="rounded-xl border border-line bg-white p-7" noValidate>
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-danger-soft px-3.5 py-3 text-sm text-red-800">
          <AlertTriangle size={14} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <h2 className="mb-6 text-base font-medium tracking-tight text-ink">Product details</h2>

      <Field label="Name" htmlFor="name" required error={fieldErrors?.name?.[0]}>
        <Input id="name" name="name" defaultValue={product?.name} placeholder="Paracetamol 500mg" />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="SKU" htmlFor="sku" required error={fieldErrors?.sku?.[0]}>
          <Input id="sku" name="sku" defaultValue={product?.sku} placeholder="PARA-500-100" />
        </Field>
        <Field label="Manufacturer" htmlFor="manufacturer" required error={fieldErrors?.manufacturer?.[0]}>
          <Input id="manufacturer" name="manufacturer" defaultValue={product?.manufacturer} placeholder="GlaxoSmithKline" />
        </Field>
      </div>

      <Field label="Description" htmlFor="description" required error={fieldErrors?.description?.[0]}>
        <Textarea id="description" name="description" rows={3} defaultValue={product?.description} placeholder="Short product description for the catalog…" />
      </Field>

      <Field
        label="Image URL"
        htmlFor="image_url"
        required
        hint="Paste a hosted image URL. (Direct file upload arrives with storage integration.)"
        error={fieldErrors?.image_url?.[0]}
      >
        <Input id="image_url" name="image_url" type="url" defaultValue={product?.image_url} placeholder="https://…/product.jpg" />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category" htmlFor="category" required error={fieldErrors?.category?.[0]}>
          <Select id="category" name="category" defaultValue={product?.category ?? PRODUCT_CATEGORIES[0]}>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Form" htmlFor="form" required error={fieldErrors?.form?.[0]}>
          <Select id="form" name="form" defaultValue={product?.form ?? PRODUCT_FORMS[0]}>
            {PRODUCT_FORMS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Strength" htmlFor="strength" required error={fieldErrors?.strength?.[0]}>
          <Input id="strength" name="strength" defaultValue={product?.strength} placeholder="500mg" />
        </Field>
        <Field label="Pack size" htmlFor="pack_size" required error={fieldErrors?.pack_size?.[0]}>
          <Input id="pack_size" name="pack_size" defaultValue={product?.pack_size} placeholder="100 tablets" />
        </Field>
        <Field label="Price (₦)" htmlFor="price" required error={fieldErrors?.price?.[0]}>
          <Input id="price" name="price" type="number" step="1" min="0" defaultValue={product ? String(product.price) : ''} placeholder="1200" />
        </Field>
      </div>

      <div className="grid items-end gap-3 sm:grid-cols-2">
        <Field label="Status" htmlFor="status" required>
          <Select id="status" name="status" defaultValue={product?.status ?? 'draft'}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="mb-4">
          <Checkbox name="prescription_required" defaultChecked={product?.prescription_required}>
            Prescription required (Rx)
          </Checkbox>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={pending} leadingIcon={<CheckCircle size={14} />}>
          {mode === 'create' ? 'Create product' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}