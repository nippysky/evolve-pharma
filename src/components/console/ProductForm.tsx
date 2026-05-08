'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Input, Textarea, Select, Checkbox } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { CheckCircle, AlertTriangle } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { createProductAction } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';
import { PRODUCT_CATEGORIES, PRODUCT_FORMS } from '@/lib/constants';
import type { Product } from '@/types';

const initial: ActionResult = { ok: false, message: '' };

interface ProductFormProps {
  product?: Product;
  mode: 'create' | 'edit';
}

export function ProductForm({ product, mode }: ProductFormProps) {
  const toast = useToast();
  const router = useRouter();

  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await createProductAction(prev, fd);
    if (r.ok) {
      toast.show({
        tone: 'success',
        title: mode === 'create' ? 'Product created' : 'Product updated',
      });
      if (mode === 'create') router.push('/console/products');
    } else {
      toast.show({ tone: 'error', title: mode === 'create' ? 'Create failed' : 'Update failed', description: r.message });
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
        <Input id="name" name="name" defaultValue={product?.name} placeholder="Paracetamol 500mg" required />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="SKU" htmlFor="sku" required error={fieldErrors?.sku?.[0]}>
          <Input id="sku" name="sku" defaultValue={product?.sku} placeholder="e.g. PARA-500-100" required />
        </Field>
        <Field label="Manufacturer" htmlFor="manufacturer" required error={fieldErrors?.manufacturer?.[0]}>
          <Input id="manufacturer" name="manufacturer" defaultValue={product?.manufacturer} placeholder="GlaxoSmithKline" required />
        </Field>
      </div>

      <Field label="Description" htmlFor="description" required error={fieldErrors?.description?.[0]}>
        <Textarea id="description" name="description" rows={3} defaultValue={product?.description} placeholder="Short product description for the catalog…" required />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category" htmlFor="category" required>
          <Select id="category" name="category" defaultValue={product?.category ?? PRODUCT_CATEGORIES[0]} required>
            {PRODUCT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Form" htmlFor="form" required>
          <Select id="form" name="form" defaultValue={product?.form ?? PRODUCT_FORMS[0]} required>
            {PRODUCT_FORMS.map((f) => <option key={f}>{f}</option>)}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Strength" htmlFor="strength">
          <Input id="strength" name="strength" defaultValue={product?.strength} placeholder="500mg" />
        </Field>
        <Field label="Pack size" htmlFor="pack_size">
          <Input id="pack_size" name="pack_size" defaultValue={product?.pack_size} placeholder="100 tablets" />
        </Field>
        <Field label="Price (₦)" htmlFor="price" required error={fieldErrors?.price?.[0]}>
          <Input id="price" name="price" type="number" step="1" defaultValue={product ? String(product.price) : ''} placeholder="1200" required />
        </Field>
      </div>

      <div className="my-2">
        <Checkbox name="prescription_required" defaultChecked={product?.prescription_required}>
          Prescription required (Rx)
        </Checkbox>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" loading={pending} leadingIcon={<CheckCircle size={14} />}>
          {mode === 'create' ? 'Create product' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
