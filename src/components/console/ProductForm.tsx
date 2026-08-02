'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Input, Select, Checkbox } from '@/components/ui/Field';
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
      if (mode === 'create') router.push('/admin/products');
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

      {/* Names */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Brand / trade name" htmlFor="name" required error={fieldErrors?.name?.[0]}>
          <Input id="name" name="name" defaultValue={product?.name} placeholder="Paracetamol 500mg" />
        </Field>
        <Field label="Generic / INN name" htmlFor="generic_name" required error={fieldErrors?.generic_name?.[0]}>
          <Input id="generic_name" name="generic_name" defaultValue={product?.generic_name} placeholder="Paracetamol" />
        </Field>
      </div>

      {/* Identity */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="SKU" htmlFor="sku" required error={fieldErrors?.sku?.[0]}>
          <Input id="sku" name="sku" defaultValue={product?.sku} placeholder="PARA-500-100" />
        </Field>
        <Field label="Manufacturer" htmlFor="manufacturer" required error={fieldErrors?.manufacturer?.[0]}>
          <Input id="manufacturer" name="manufacturer" defaultValue={product?.manufacturer} placeholder="GlaxoSmithKline" />
        </Field>
      </div>

      {/* Image */}
      <Field
        label="Image URL"
        htmlFor="image_url"
        required
        hint="Paste a hosted image URL. (Direct file upload arrives with storage integration.)"
        error={fieldErrors?.image_url?.[0]}
      >
        <Input id="image_url" name="image_url" type="url" defaultValue={product?.image_url} placeholder="https://…/product.jpg" />
      </Field>

      {/* Category + Form */}
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

      {/* Strength + Pack size */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Strength" htmlFor="strength" required error={fieldErrors?.strength?.[0]}>
          <Input id="strength" name="strength" defaultValue={product?.strength} placeholder="500mg" />
        </Field>
        <Field
          label="Pack size"
          htmlFor="pack_size"
          required
          hint='Format: cases × packs × units, e.g. "1 x 6 x 25"'
          error={fieldErrors?.pack_size?.[0]}
        >
          <Input id="pack_size" name="pack_size" defaultValue={product?.pack_size} placeholder="1 x 6 x 25" />
        </Field>
      </div>

      {/* Pricing */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cost price (₦)" htmlFor="cost_price" required hint="Internal — not shown to customers" error={fieldErrors?.cost_price?.[0]}>
          <Input id="cost_price" name="cost_price" type="number" step="1" min="0" defaultValue={product ? String(product.cost_price) : ''} placeholder="3800" />
        </Field>
        <Field label="Selling price (₦)" htmlFor="selling_price" required hint="Shown to customers" error={fieldErrors?.selling_price?.[0]}>
          <Input id="selling_price" name="selling_price" type="number" step="1" min="0" defaultValue={product ? String(product.selling_price) : ''} placeholder="4800" />
        </Field>
      </div>

      {/* Warehouse */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Shelf location" htmlFor="shelf_location" hint="e.g. AB001" error={fieldErrors?.shelf_location?.[0]}>
          <Input id="shelf_location" name="shelf_location" defaultValue={product?.shelf_location ?? ''} placeholder="AB001" />
        </Field>
        <Field label="Min. stock level" htmlFor="min_stock_level" hint="Low-stock threshold" error={fieldErrors?.min_stock_level?.[0]}>
          <Input id="min_stock_level" name="min_stock_level" type="number" step="1" min="0" defaultValue={product?.min_stock_level != null ? String(product.min_stock_level) : ''} placeholder="50" />
        </Field>
        <Field label="Reorder qty" htmlFor="reorder_qty" hint="Suggested reorder quantity" error={fieldErrors?.reorder_qty?.[0]}>
          <Input id="reorder_qty" name="reorder_qty" type="number" step="1" min="0" defaultValue={product?.reorder_qty != null ? String(product.reorder_qty) : ''} placeholder="500" />
        </Field>
      </div>

      {/* Status + Rx */}
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