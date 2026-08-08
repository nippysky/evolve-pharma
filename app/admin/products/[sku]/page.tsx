'use client';
import React, { use, useState, useRef, useCallback, useEffect } from 'react';
import { useRouter }      from 'next/navigation';
import Image              from 'next/image';
import Link               from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Field, Input, Select } from '@/components/ui/Field';
import { ComboboxField }  from '@/components/ui/ComboboxField';
import { Button }         from '@/components/ui/Button';
import { PageHead }       from '@/components/shared/PageHead';
import {
  AlertTriangle, CheckCircle, ArrowLeft,
  Upload, X, Box, RotateCw,
} from '@/components/icons';
import { useToast }             from '@/contexts/ToastContext';
import { useUser }              from '@/contexts/UserContext';
import { useProductCategories, useProductManufacturers } from '@/hooks/admin/useAdminProducts';
import { cn }                   from '@/lib/utils';
import type { ProductDTO, ProductImageDTO } from '@/lib/api/types';

interface FormErrors { [field: string]: string }

/** A pending (not-yet-uploaded) image selected by the user. */
interface NewImage {
  id:        string;
  file:      File;
  objectUrl: string;
}

const STATUS_OPTIONS = [
  { value: 'DRAFT',        label: 'Draft — hidden from catalog'  },
  { value: 'ACTIVE',       label: 'Active — visible & orderable' },
  { value: 'DISCONTINUED', label: 'Discontinued — retired'       },
];

const MAX_IMAGES = 6;

/**
 * Shows Cloudinary images that are already saved for this product.
 * Set-primary and delete are applied immediately via API — no form save required.
 */
function ExistingImagesPanel({
  sku,
  images,
  onChanged,
}: {
  sku:       string;
  images:    ProductImageDTO[];
  onChanged: (imgs: ProductImageDTO[]) => void;
}) {
  const toast                       = useToast();
  const [busy, setBusy]             = useState<number | null>(null);

  async function handleSetPrimary(imgId: number) {
    setBusy(imgId);
    try {
      const res = await fetch(
        `/api/products/${encodeURIComponent(sku)}/images/${imgId}`,
        { method: 'PATCH', credentials: 'include' },
      );
      if (!res.ok) throw new Error('Failed to set primary image');
      onChanged(images.map(img => ({ ...img, is_primary: img.id === imgId })));
      toast.show({ tone: 'success', title: 'Primary image updated' });
    } catch (err) {
      toast.show({ tone: 'error', title: 'Error', description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(imgId: number) {
    setBusy(imgId);
    try {
      const res = await fetch(
        `/api/products/${encodeURIComponent(sku)}/images/${imgId}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) throw new Error('Failed to delete image');
      let remaining = images.filter(img => img.id !== imgId);
      // API promotes next image to primary on delete — mirror that locally
      const deletedWasPrimary = images.find(img => img.id === imgId)?.is_primary;
      if (deletedWasPrimary && remaining.length > 0) {
        remaining = remaining.map((img, idx) =>
          idx === 0 ? { ...img, is_primary: true } : img,
        );
      }
      onChanged(remaining);
      toast.show({ tone: 'success', title: 'Image deleted' });
    } catch (err) {
      toast.show({ tone: 'error', title: 'Error', description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (images.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {images.map((img) => (
        <div key={img.id} className="relative group">
          <div className={cn(
            'relative overflow-hidden rounded-xl border-2 bg-bg-muted aspect-square',
            img.is_primary ? 'border-brand-400' : 'border-line',
          )}>
            <Image
              src={img.url}
              alt="Product image"
              fill
              sizes="96px"
              className="object-contain p-1"
            />
            {img.is_primary && (
              <span className="absolute bottom-1 left-1 rounded-md bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">
                PRIMARY
              </span>
            )}
            {busy === img.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                <RotateCw size={16} className="text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
            {!img.is_primary && (
              <button
                type="button"
                onClick={() => handleSetPrimary(img.id)}
                disabled={busy !== null}
                className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-medium text-ink hover:bg-white transition-colors disabled:opacity-50"
              >
                Set primary
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDelete(img.id)}
              disabled={busy !== null}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              <X size={10} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Drag-drop zone for selecting new images to upload on form save. */
function NewImagesUploader({
  images,
  maxSlots,
  onChange,
}: {
  images:   NewImage[];
  maxSlots: number;
  onChange: (imgs: NewImage[]) => void;
}) {
  const inputRef              = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr    = Array.from(files).filter(f => f.type.startsWith('image/'));
    const toAdd  = arr.slice(0, maxSlots - images.length);
    const newImgs: NewImage[] = toAdd.map((f, i) => ({
      id:        `${Date.now()}-${i}-${f.name}`,
      file:      f,
      objectUrl: URL.createObjectURL(f),
    }));
    onChange([...images, ...newImgs]);
  }, [images, maxSlots, onChange]);

  function remove(id: string) {
    const img = images.find(i => i.id === id);
    if (img) URL.revokeObjectURL(img.objectUrl);
    onChange(images.filter(i => i.id !== id));
  }

  if (images.length >= maxSlots) return null;

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-6 cursor-pointer transition-colors text-center',
          dragging
            ? 'border-brand-400 bg-brand-50'
            : 'border-line hover:border-brand-300 hover:bg-bg-subtle',
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
      >
        <Upload size={20} className="mb-1.5 text-ink-3" />
        <p className="text-sm font-medium text-ink">Click or drag to add images</p>
        <p className="mt-0.5 text-xs text-ink-3">
          JPEG, PNG, WEBP · max 8 MB each · up to {maxSlots - images.length} more
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={e => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {images.map(img => (
            <div key={img.id} className="relative group">
              <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 aspect-square">
                <Image
                  src={img.objectUrl}
                  alt="New image preview"
                  fill
                  sizes="96px"
                  className="object-contain p-1"
                />
                <span className="absolute bottom-1 left-1 rounded-md bg-brand-100 px-1.5 py-0.5 text-[9px] font-bold text-brand-700 leading-none">
                  NEW
                </span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => remove(img.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditSkeleton() {
  return (
    <div className="max-w-3xl space-y-4 animate-pulse">
      <div className="h-5 w-32 rounded-md bg-bg-muted" />
      <div className="h-8 w-64 rounded-lg bg-bg-muted" />
      <div className="h-56 rounded-xl bg-bg-muted" />
      <div className="h-36 rounded-xl bg-bg-muted" />
      <div className="h-28 rounded-xl bg-bg-muted" />
      <div className="h-28 rounded-xl bg-bg-muted" />
    </div>
  );
}

export default function ProductEditPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku }     = use(params);
  const router      = useRouter();
  const toast       = useToast();
  const queryClient = useQueryClient();
  const { user }    = useUser();

  // Guard: only ADMIN can edit products
  if (user && user.role !== 'ADMIN') {
    router.replace('/admin/products');
    return null;
  }

  // Remote product state
  const [product,        setProduct]        = useState<ProductDTO | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [fetchErr,       setFetchErr]       = useState('');

  // Existing Cloudinary images (managed immediately via API)
  const [existingImages, setExistingImages] = useState<ProductImageDTO[]>([]);

  // New images to upload on form save
  const [newImages,      setNewImages]      = useState<NewImage[]>([]);

  // Category + Manufacturer data for comboboxes
  const { data: categoryData, isLoading: catsLoading } = useProductCategories();
  const { data: mfrData,      isLoading: mfrsLoading  } = useProductManufacturers();
  const allCategories    = (categoryData ?? []) as { id: number; name: string }[];
  const allManufacturers = (mfrData      ?? []) as { id: number; name: string }[];

  const [categoryInput,     setCategoryInput]     = useState('');
  const [manufacturerInput, setManufacturerInput] = useState('');

  // Form
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState<FormErrors>({});
  const [serverErr, setServerErr] = useState('');

  // ── Fetch product ────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchErr('');

    fetch(`/api/products/${encodeURIComponent(sku)}`, { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        const p = json?.data?.product as ProductDTO | undefined;
        if (!p) { setFetchErr('Product not found'); return; }
        setProduct(p);
        setExistingImages(p.images ?? []);
        setCategoryInput(p.category?.name ?? '');
        setManufacturerInput(p.manufacturer?.name ?? '');
      })
      .catch(err => { if (!cancelled) setFetchErr((err as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [sku]);

  // ── Form submit ──────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!product) return;

    setErrors({});
    setServerErr('');

    const fd = new FormData(e.currentTarget);

    const sellingPriceRaw = (fd.get('selling_price') as string) || '';
    const costPriceRaw    = (fd.get('cost_price')    as string) || '';
    const qtyPerCarton    = (fd.get('quantity_per_carton') as string) || '';
    const minOrder        = (fd.get('minimum_order')       as string) || '';
    const minStock        = (fd.get('minimum_stock_level') as string) || '';
    const reorderQty      = (fd.get('reorder_quantity')    as string) || '';

    const body: Record<string, unknown> = {
      brand_name:          (fd.get('brand_name')       as string).trim() || undefined,
      generic_name:        (fd.get('generic_name')     as string).trim() || undefined,
      product_strength:    (fd.get('product_strength') as string).trim() || undefined,
      pack_size:           (fd.get('pack_size')        as string).trim() || undefined,
      status:              fd.get('status') as string,
    };

    if (sellingPriceRaw) body.selling_price    = parseFloat(sellingPriceRaw);
    if (costPriceRaw)    body.last_cost_price  = parseFloat(costPriceRaw);
    if (qtyPerCarton)    body.quantity_per_carton = parseInt(qtyPerCarton, 10);
    if (minOrder)        body.minimum_order       = parseInt(minOrder, 10);
    if (minStock)        body.minimum_stock_level = parseInt(minStock, 10);
    if (reorderQty)      body.reorder_quantity    = parseInt(reorderQty, 10);

    // Client validation
    const errs: FormErrors = {};
    if (!body.brand_name)   errs.brand_name   = 'Brand name is required';
    if (!body.generic_name) errs.generic_name  = 'Generic name is required';
    if (
      body.selling_price !== undefined &&
      (isNaN(body.selling_price as number) || (body.selling_price as number) <= 0)
    ) errs.selling_price = 'Selling price must be a positive number';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // Resolve category
    const categoryName = categoryInput.trim();
    if (!categoryName) {
      body.category_id = null;
    } else if (categoryName !== product.category?.name) {
      try {
        const catRes  = await fetch('/api/products/categories', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: categoryName }),
        });
        const catJson = await catRes.json();
        if (catRes.ok) {
          body.category_id = catJson.data?.category?.id;
        } else if (catRes.status === 409) {
          const found = allCategories.find(
            c => c.name.toLowerCase() === categoryName.toLowerCase(),
          );
          if (found) body.category_id = found.id;
        }
      } catch { /* fallback — category unchanged */ }
    }

    // Resolve manufacturer
    const manufacturerName = manufacturerInput.trim();
    if (manufacturerName && manufacturerName !== product.manufacturer?.name) {
      try {
        const mfrRes  = await fetch('/api/products/manufacturers', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: manufacturerName }),
        });
        const mfrJson = await mfrRes.json();
        if (mfrRes.ok) {
          body.manufacturer_id = mfrJson.data?.manufacturer?.id;
        } else if (mfrRes.status === 409) {
          const listRes  = await fetch('/api/products/manufacturers', { credentials: 'include' });
          const listJson = await listRes.json();
          const found = (listJson?.data?.manufacturers ?? []).find(
            (m: { name: string; id: number }) =>
              m.name.toLowerCase() === manufacturerName.toLowerCase(),
          );
          if (found) body.manufacturer_id = found.id;
        }
      } catch { /* fallback */ }
    } else if (!manufacturerName) {
      body.manufacturer_id = null;
    }

    setSaving(true);
    try {
      // 1. Upload new images (non-blocking; failures don't abort the save)
      if (newImages.length > 0) {
        const imgFd = new FormData();
        newImages.forEach((img, i) => imgFd.append(`file${i}`, img.file));
        await fetch(`/api/products/${encodeURIComponent(sku)}/images`, {
          method: 'POST', credentials: 'include', body: imgFd,
        }).catch(err => console.warn('[image upload warn]', err));
        // Revoke object URLs
        newImages.forEach(img => URL.revokeObjectURL(img.objectUrl));
        setNewImages([]);
      }

      // 2. PATCH product fields
      const res  = await fetch(`/api/products/${encodeURIComponent(sku)}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        const apiErrs = json?.errors as Record<string, string[]> | undefined;
        if (apiErrs) {
          const mapped: FormErrors = {};
          for (const [k, msgs] of Object.entries(apiErrs)) {
            mapped[k] = msgs[0] ?? 'Invalid';
          }
          setErrors(mapped);
        } else {
          setServerErr(json?.message ?? 'Failed to update product');
        }
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.show({ tone: 'success', title: 'Product updated', description: sku });
      router.push('/admin/products');
    } catch (err) {
      setServerErr((err as Error).message ?? 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Render: loading ──────────────────────────────────────────────────────

  if (loading) return <EditSkeleton />;

  // ── Render: error ────────────────────────────────────────────────────────

  if (fetchErr || !product) {
    return (
      <div className="flex max-w-lg flex-col items-center gap-4 rounded-xl border border-dashed border-red-200 bg-red-50 px-6 py-16 text-center">
        <AlertTriangle size={28} className="text-red-400" />
        <p className="font-semibold text-red-700">{fetchErr || 'Product not found'}</p>
        <Link
          href="/admin/products"
          className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
        >
          ← Back to products
        </Link>
      </div>
    );
  }

  const maxNewSlots = MAX_IMAGES - existingImages.length;

  // ── Render: form ─────────────────────────────────────────────────────────

  return (
    <>
      <Link
        href="/admin/products"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors"
      >
        <ArrowLeft size={14} /> Back to products
      </Link>

      <PageHead
        title={product.brand_name}
        subtitle={product.generic_name}
      />

      {/* SKU + status pill */}
      <div className="mb-6 -mt-3 flex items-center gap-2">
        <span className="font-mono text-xs text-ink-3">{product.sku}</span>
        <span className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
          product.status === 'ACTIVE'
            ? 'bg-green-100 text-green-700'
            : product.status === 'DRAFT'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-600',
        )}>
          {product.status}
        </span>
      </div>

      <div className="max-w-3xl">
        <form onSubmit={handleSubmit} noValidate>

          {/* Server error banner */}
          {serverErr && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {serverErr}
            </div>
          )}

          {/* ── Product details ── */}
          <section className="mb-4 rounded-xl border border-line bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Product details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Brand / trade name" required error={errors.brand_name}>
                <Input name="brand_name" defaultValue={product.brand_name} />
              </Field>
              <Field label="Generic / INN name" required error={errors.generic_name}>
                <Input name="generic_name" defaultValue={product.generic_name} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Product strength" error={errors.product_strength}>
                <Input
                  name="product_strength"
                  defaultValue={product.product_strength ?? ''}
                  placeholder="125mg"
                />
              </Field>
              <Field label="Pack size" hint='e.g. "1 × 6 × 25"' error={errors.pack_size}>
                <Input
                  name="pack_size"
                  defaultValue={product.pack_size ?? ''}
                  placeholder="1×6×25"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Minimum order" error={errors.minimum_order}>
                <Input
                  name="minimum_order"
                  type="number"
                  min="1"
                  defaultValue={product.minimum_order}
                />
              </Field>
              <Field label="Qty per carton" error={errors.quantity_per_carton}>
                <Input
                  name="quantity_per_carton"
                  type="number"
                  min="1"
                  defaultValue={product.quantity_per_carton ?? ''}
                  placeholder="25"
                />
              </Field>
            </div>
          </section>

          {/* ── Classification ── */}
          <section className="mb-4 rounded-xl border border-line bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Classification</h2>
            <Field label="SKU" hint="Cannot be changed after creation">
              <Input
                value={product.sku}
                readOnly
                className="cursor-not-allowed bg-bg-subtle font-mono text-xs text-ink-3"
              />
            </Field>
            <div className="grid gap-0 sm:grid-cols-2 sm:gap-3">
              <ComboboxField
                label="Manufacturer"
                options={allManufacturers}
                value={manufacturerInput}
                onChange={setManufacturerInput}
                placeholder="Search or add manufacturer…"
                loading={mfrsLoading}
                allowCreate
                createLabel="Add manufacturer"
                error={errors.manufacturer}
              />
              <ComboboxField
                label="Category"
                options={allCategories}
                value={categoryInput}
                onChange={setCategoryInput}
                placeholder="Search or add category…"
                loading={catsLoading}
                allowCreate
                createLabel="Add category"
                error={errors.category_id}
              />
            </div>
          </section>

          {/* ── Pricing ── */}
          <section className="mb-4 rounded-xl border border-line bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Pricing</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Cost price (₦)"
                hint="Internal — not shown to customers"
                error={errors.last_cost_price}
              >
                <Input
                  name="cost_price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={product.last_cost_price ? Number(product.last_cost_price) : ''}
                />
              </Field>
              <Field label="Selling price (₦)" required error={errors.selling_price}>
                <Input
                  name="selling_price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={Number(product.selling_price)}
                />
              </Field>
            </div>
          </section>

          {/* ── Inventory settings ── */}
          <section className="mb-4 rounded-xl border border-line bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Inventory settings</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Min. stock level" hint="Low-stock threshold" error={errors.minimum_stock_level}>
                <Input
                  name="minimum_stock_level"
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={product.minimum_stock_level}
                />
              </Field>
              <Field label="Reorder quantity" hint="Suggested reorder qty" error={errors.reorder_quantity}>
                <Input
                  name="reorder_quantity"
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={product.reorder_quantity}
                />
              </Field>
            </div>
            <Field label="Status">
              <Select name="status" defaultValue={product.status}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>
          </section>

          {/* ── Images ── */}
          <section className="mb-6 rounded-xl border border-line bg-white p-5">
            <h2 className="mb-1 text-sm font-semibold text-ink">Product images</h2>
            <p className="mb-4 text-xs text-ink-3">
              {existingImages.length > 0
                ? `${existingImages.length} saved image${existingImages.length !== 1 ? 's' : ''}. Hover to set primary or delete — changes apply immediately. Add up to ${Math.max(0, maxNewSlots)} more below.`
                : `No images uploaded. Add up to ${MAX_IMAGES}.`}
            </p>

            {existingImages.length > 0 && (
              <div className={maxNewSlots > 0 ? 'mb-4' : ''}>
                <ExistingImagesPanel
                  sku={sku}
                  images={existingImages}
                  onChanged={setExistingImages}
                />
              </div>
            )}

            {maxNewSlots > 0 ? (
              <NewImagesUploader
                images={newImages}
                maxSlots={maxNewSlots}
                onChange={setNewImages}
              />
            ) : (
              existingImages.length === 0 && (
                <div className="flex items-center gap-1.5 text-xs text-ink-4">
                  <Box size={12} /> Maximum images reached ({MAX_IMAGES}/{MAX_IMAGES}).
                </div>
              )
            )}
          </section>

          {/* ── Actions ── */}
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-ink-4">
              Last updated {new Date(product.updated_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={saving}
                leadingIcon={<CheckCircle size={14} />}
              >
                Save changes
              </Button>
            </div>
          </div>

        </form>
      </div>
    </>
  );
}
