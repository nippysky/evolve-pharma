'use client';
import { useState, useRef, useCallback } from 'react';
import { useRouter }   from 'next/navigation';
import Image           from 'next/image';
import Link            from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Field, Input, Select } from '@/components/ui/Field';
import { Button }      from '@/components/ui/Button';
import { PageHead }    from '@/components/shared/PageHead';
import {
  AlertTriangle, CheckCircle, ArrowLeft,
  Upload, X, Box, RotateCw,
} from '@/components/icons';
import { useToast }              from '@/contexts/ToastContext';
import { useProductCategories }  from '@/hooks/admin/useAdminProducts';
import { cn }                    from '@/lib/utils';

interface FormErrors { [field: string]: string }

interface ImagePreview {
  id:       string; // local preview id
  file:     File;
  objectUrl: string;
  isPrimary: boolean;
}

const STATUS_OPTIONS = [
  { value: 'DRAFT',        label: 'Draft — hidden from catalog'   },
  { value: 'ACTIVE',       label: 'Active — visible & orderable'  },
  { value: 'DISCONTINUED', label: 'Discontinued — retired'        },
];

const MAX_IMAGES = 6;

function ImageUploader({
  images,
  onChange,
}: {
  images:   ImagePreview[];
  onChange: (imgs: ImagePreview[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    const slots = MAX_IMAGES - images.length;
    const toAdd = arr.slice(0, slots);
    const newPreviews: ImagePreview[] = toAdd.map((f, i) => ({
      id:        `${Date.now()}-${i}-${f.name}`,
      file:      f,
      objectUrl: URL.createObjectURL(f),
      isPrimary: images.length === 0 && i === 0,
    }));
    onChange([...images, ...newPreviews]);
  }, [images, onChange]);

  function remove(id: string) {
    const updated = images.filter(img => img.id !== id);
    // Ensure primary is still set
    if (updated.length > 0 && !updated.some(i => i.isPrimary)) {
      updated[0]!.isPrimary = true;
    }
    onChange(updated);
  }

  function setPrimary(id: string) {
    onChange(images.map(img => ({ ...img, isPrimary: img.id === id })));
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {images.length < MAX_IMAGES && (
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-colors text-center',
            dragging ? 'border-brand-400 bg-brand-50' : 'border-line hover:border-brand-300 hover:bg-bg-subtle',
          )}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={22} className="mb-2 text-ink-3" />
          <p className="text-sm font-medium text-ink">Click or drag images here</p>
          <p className="mt-0.5 text-xs text-ink-3">
            JPEG, PNG, WEBP · max 8 MB each · up to {MAX_IMAGES - images.length} more
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      )}

      {/* Previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {images.map((img, i) => (
            <div key={img.id} className="relative group">
              <div className={cn(
                'relative overflow-hidden rounded-xl border-2 bg-bg-muted aspect-square',
                img.isPrimary ? 'border-brand-400' : 'border-line',
              )}>
                <Image
                  src={img.objectUrl}
                  alt={`Upload ${i + 1}`}
                  fill
                  className="object-contain p-1"
                />
                {img.isPrimary && (
                  <span className="absolute bottom-1 left-1 rounded-md bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">
                    PRIMARY
                  </span>
                )}
              </div>
              {/* Overlay actions */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                {!img.isPrimary && (
                  <button type="button" onClick={() => setPrimary(img.id)}
                    className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-medium text-ink hover:bg-white transition-colors">
                    Set primary
                  </button>
                )}
                <button type="button" onClick={() => remove(img.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors">
                  <X size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <div className="flex items-center gap-1.5 text-xs text-ink-4">
          <Box size={12} /> No images yet — products without images show a placeholder in the catalog.
        </div>
      )}
    </div>
  );
}

export default function NewProductPage() {
  const router      = useRouter();
  const toast       = useToast();
  const queryClient = useQueryClient();

  // Category + Manufacturer data
  const { data: categoryData, isLoading: catsLoading } = useProductCategories();
  const allCategories = (categoryData ?? []) as { id: number; name: string }[];

  // Form state
  const [images,     setImages]     = useState<ImagePreview[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [errors,     setErrors]     = useState<FormErrors>({});
  const [serverErr,  setServerErr]  = useState('');

  // For category/manufacturer: use text input (API auto-creates)
  const [categoryInput, setCategoryInput] = useState('');
  const [catSuggest,    setCatSuggest]    = useState(false);
  const filteredCats = allCategories.filter(c =>
    categoryInput && c.name.toLowerCase().includes(categoryInput.toLowerCase()),
  );

  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setServerErr('');

    const fd   = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      brand_name:          fd.get('brand_name'),
      generic_name:        fd.get('generic_name'),
      selling_price:       parseFloat(fd.get('selling_price') as string),
      last_cost_price:     fd.get('cost_price')              ? parseFloat(fd.get('cost_price') as string)              : undefined,
      product_strength:    fd.get('product_strength')        || undefined,
      pack_size:           fd.get('pack_size')               || undefined,
      quantity_per_carton: fd.get('quantity_per_carton')     ? parseInt(fd.get('quantity_per_carton') as string, 10)   : undefined,
      minimum_order:       fd.get('minimum_order')           ? parseInt(fd.get('minimum_order') as string, 10)         : 1,
      minimum_stock_level: fd.get('minimum_stock_level')     ? parseInt(fd.get('minimum_stock_level') as string, 10)   : 0,
      reorder_quantity:    fd.get('reorder_quantity')        ? parseInt(fd.get('reorder_quantity') as string, 10)      : 0,
      shelf_location:      fd.get('shelf_location')          || undefined,
      status:              fd.get('status') || 'DRAFT',
    };

    // Validate client-side
    const errs: FormErrors = {};
    if (!body.brand_name)   errs.brand_name   = 'Brand name is required';
    if (!body.generic_name) errs.generic_name  = 'Generic name is required';
    if (!body.selling_price || isNaN(body.selling_price as number) || (body.selling_price as number) <= 0)
      errs.selling_price = 'Selling price must be a positive number';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // Resolve category & manufacturer IDs (API auto-creates if not found)
    const categoryName     = categoryInput.trim();
    const manufacturerName = (fd.get('manufacturer') as string)?.trim();

    if (categoryName) {
      // Upsert category via API and get ID
      try {
        const catRes  = await fetch('/api/products/categories', {
          method:  'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: categoryName }),
        });
        const catJson = await catRes.json();
        // 409 means it already exists — look it up
        if (catRes.ok) {
          body.category_id = catJson.data?.category?.id;
        } else if (catRes.status === 409) {
          const existing = allCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
          if (existing) body.category_id = existing.id;
        }
      } catch { /* ignore — product will be created without category */ }
    }

    if (manufacturerName) {
      try {
        const mfrRes  = await fetch('/api/products/manufacturers', {
          method:  'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: manufacturerName }),
        });
        const mfrJson = await mfrRes.json();
        if (mfrRes.ok) {
          body.manufacturer_id = mfrJson.data?.manufacturer?.id;
        } else if (mfrRes.status === 409) {
          // fetch existing
          const listRes  = await fetch('/api/products/manufacturers', { credentials: 'include' });
          const listJson = await listRes.json();
          const found    = (listJson?.data?.manufacturers ?? []).find((m: { name: string; id: number }) =>
            m.name.toLowerCase() === manufacturerName.toLowerCase());
          if (found) body.manufacturer_id = found.id;
        }
      } catch { /* ignore */ }
    }

    setSaving(true);
    try {
      // 1. Create product
      const res  = await fetch('/api/products', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(body),
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
          setServerErr(json?.message ?? 'Failed to create product');
        }
        return;
      }

      const sku = json.data?.product?.sku as string;

      // 2. Upload images if any
      if (images.length > 0 && sku) {
        const imgFd = new FormData();
        images.forEach((img, i) => {
          imgFd.append(`file${i}`, img.file);
        });
        const primaryIdx = images.findIndex(img => img.isPrimary);
        if (primaryIdx >= 0) imgFd.append('set_primary', String(primaryIdx));

        await fetch(`/api/products/${encodeURIComponent(sku)}/images`, {
          method:      'POST',
          credentials: 'include',
          body:        imgFd,
        }).catch(err => console.warn('[image upload warn]', err));
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', 'categories'] });

      toast.show({ tone: 'success', title: 'Product created', description: sku });
      router.push('/admin/products');
    } catch (err) {
      setServerErr((err as Error).message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Link href="/admin/products"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors">
        <ArrowLeft size={14} /> Back to products
      </Link>

      <PageHead title="New product" subtitle="Add a product to the catalog. Upload images after creation or right here." />

      <div className="max-w-3xl">
        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          {serverErr && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {serverErr}
            </div>
          )}

          {/* ── Names ── */}
          <section className="mb-4 rounded-xl border border-line bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Product details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Brand / trade name" required error={errors.brand_name}>
                <Input name="brand_name" placeholder="Pyrantrin Tablets" />
              </Field>
              <Field label="Generic / INN name" required error={errors.generic_name}>
                <Input name="generic_name" placeholder="Pyrantel Pamoate" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Product strength" error={errors.product_strength}>
                <Input name="product_strength" placeholder="125mg" />
              </Field>
              <Field label="Pack size" hint='e.g. "1 x 6 x 25"' error={errors.pack_size}>
                <Input name="pack_size" placeholder="1x6x25" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Minimum order" error={errors.minimum_order}>
                <Input name="minimum_order" type="number" min="1" placeholder="1" />
              </Field>
              <Field label="Qty per carton" error={errors.quantity_per_carton}>
                <Input name="quantity_per_carton" type="number" min="1" placeholder="25" />
              </Field>
            </div>
          </section>

          {/* ── SKU / Category / Manufacturer ── */}
          <section className="mb-4 rounded-xl border border-line bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Classification</h2>
            <p className="mb-3 text-xs text-ink-3">SKU is auto-generated from manufacturer + brand name after you save.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Manufacturer" error={errors.manufacturer}>
                <Input name="manufacturer" placeholder="Neimeth" />
              </Field>
            </div>
            {/* Category with autocomplete */}
            <Field label="Category" error={errors.category_id}>
              <div className="relative">
                <Input
                  value={categoryInput}
                  onChange={e => { setCategoryInput(e.target.value); setCatSuggest(true); }}
                  onFocus={() => setCatSuggest(true)}
                  onBlur={() => setTimeout(() => setCatSuggest(false), 150)}
                  placeholder={catsLoading ? 'Loading categories…' : 'e.g. Anti-Helmintics'}
                  disabled={catsLoading}
                />
                {catSuggest && filteredCats.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-line bg-white shadow-xl">
                    {filteredCats.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center px-3 py-2 text-left text-sm text-ink hover:bg-bg-subtle transition-colors"
                        onMouseDown={() => { setCategoryInput(c.name); setCatSuggest(false); }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {catSuggest && categoryInput && filteredCats.length === 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-line bg-white px-3 py-2 shadow-xl">
                    <p className="text-xs text-ink-3">
                      Press Enter or continue typing — "<span className="font-medium text-ink">{categoryInput}</span>" will be created as a new category.
                    </p>
                  </div>
                )}
              </div>
            </Field>
          </section>

          {/* ── Pricing ── */}
          <section className="mb-4 rounded-xl border border-line bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Pricing</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cost price (₦)" hint="Internal — not shown to customers" error={errors.last_cost_price}>
                <Input name="cost_price" type="number" step="0.01" min="0" placeholder="16200" />
              </Field>
              <Field label="Selling price (₦)" required error={errors.selling_price}>
                <Input name="selling_price" type="number" step="0.01" min="0.01" placeholder="17415" />
              </Field>
            </div>
          </section>

          {/* ── Inventory settings ── */}
          <section className="mb-4 rounded-xl border border-line bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Inventory settings</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Shelf location" hint="e.g. AB001">
                <Input name="shelf_location" placeholder="AB001" />
              </Field>
              <Field label="Min. stock level" hint="Low-stock threshold">
                <Input name="minimum_stock_level" type="number" step="1" min="0" placeholder="10" />
              </Field>
              <Field label="Reorder qty" hint="Suggested reorder qty">
                <Input name="reorder_quantity" type="number" step="1" min="0" placeholder="100" />
              </Field>
            </div>
            <Field label="Status">
              <Select name="status" defaultValue="DRAFT">
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
              Upload up to {MAX_IMAGES} images. The first image (or whichever you mark primary) appears in the catalog. Click an image to set it as primary.
            </p>
            <ImageUploader images={images} onChange={setImages} />
          </section>

          {/* ── Actions ── */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" loading={saving} leadingIcon={<CheckCircle size={14} />}>
              Create product
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
