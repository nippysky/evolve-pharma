'use client';
import { useMemo, useState } from 'react';
import Link                  from 'next/link';
import { useQueryClient }    from '@tanstack/react-query';
import { useProductCategories } from '@/hooks/admin/useAdminProducts';
import { PageHead }          from '@/components/shared/PageHead';
import { Button }            from '@/components/ui/Button';
import { Field, Input }      from '@/components/ui/Field';
import {Search, AlertTriangle, RotateCw, Tag, Plus, Trash, X} from '@/components/icons';
import { useToast }          from '@/contexts/ToastContext';

import type { CategoryDTO }  from '@/lib/api/types';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res  = await fetch(path, { credentials: 'include', ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message ?? 'Request failed');
  return json?.data as T;
}

async function createCategory(name: string): Promise<CategoryDTO> {
  const data = await apiFetch<{ category: CategoryDTO }>('/api/products/categories', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name }),
  });
  return data.category;
}

async function deleteCategory(id: number): Promise<void> {
  await apiFetch(`/api/products/categories/${id}`, { method: 'DELETE' });
}

function GridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl bg-bg-muted"
          style={{ animationDelay: `${i * 50}ms` }}
        />
      ))}
    </div>
  );
}

interface NewCategoryModalProps {
  onClose: () => void;
  onCreated: (cat: CategoryDTO) => void;
}

function NewCategoryModal({ onClose, onCreated }: NewCategoryModalProps) {
  const toast          = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Category name is required'); return; }
    if (trimmed.length > 150) { setError('Name is too long (max 150 characters)'); return; }

    setSaving(true);
    setError('');
    try {
      const cat = await createCategory(trimmed);
      toast.show({ tone: 'success', title: 'Category created', description: cat.name });
      onCreated(cat);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">New category</h2>
            <p className="mt-0.5 text-xs text-ink-3">Add a product category to the catalog.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-4 transition-colors hover:bg-bg-muted hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <Field label="Category name" error={error} required>
            <Input
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="e.g. Analgesic/Antipyretic"
              disabled={saving}
            />
          </Field>

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={saving}>
              Create category
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteModalProps {
  category: CategoryDTO & { product_count?: number };
  onClose: () => void;
  onDeleted: (id: number) => void;
}

function DeleteModal({ category, onClose, onDeleted }: DeleteModalProps) {
  const toast          = useToast();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteCategory(category.id);
      toast.show({
        tone:        'success',
        title:       'Category deleted',
        description: `"${category.name}" removed. Affected products are now uncategorised.`,
      });
      onDeleted(category.id);
      onClose();
    } catch (err) {
      toast.show({ tone: 'error', title: 'Delete failed', description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-2xl">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
          <Trash size={18} className="text-red-600" />
        </div>
        <h2 className="mb-1.5 text-base font-semibold text-ink">Delete category?</h2>
        <p className="text-sm text-ink-2">
          <span className="font-semibold">"{category.name}"</span> will be removed.
          {(category.product_count ?? 0) > 0 && (
            <span className="block mt-1 text-amber-700 font-medium">
              ⚠ {category.product_count} product(s) will become uncategorised.
            </span>
          )}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white border-transparent"
            loading={busy}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();

  const [query,     setQuery]     = useState('');
  const [showNew,   setShowNew]   = useState(false);
  const [toDelete,  setToDelete]  = useState<(CategoryDTO & { product_count?: number }) | null>(null);

  const { data, isLoading, error, refetch } = useProductCategories();

  const categories = useMemo(() => {
    const all = (data ?? []) as (CategoryDTO & { product_count?: number })[];
    const q   = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(c => c.name.toLowerCase().includes(q));
  }, [data, query]);

  function handleCreated(cat: CategoryDTO) {
    queryClient.setQueryData<CategoryDTO[]>(
      ['product', 'categories'],
      (old = []) => [...old, cat].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  function handleDeleted(id: number) {
    queryClient.setQueryData<CategoryDTO[]>(
      ['product', 'categories'],
      (old = []) => old.filter(c => c.id !== id),
    );
  }

  return (
    <>
      <PageHead
        title="Categories"
        subtitle="Manage product categories. Categories group products in the catalog."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/products"
              className="rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              ← Products
            </Link>
            <Button
              size="sm"
              leadingIcon={<Plus size={14} />}
              onClick={() => setShowNew(true)}
            >
              New category
            </Button>
          </div>
        }
      />

      {/* Search + count */}
      <div className="mb-6 flex items-center gap-3">
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter categories…"
            aria-label="Search categories"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
          />
        </div>
        {data && (
          <p className="text-sm text-ink-3">
            <span className="font-semibold text-ink-2">{(data ?? []).length}</span> total
          </p>
        )}
      </div>

      {/* Loading */}
      {isLoading && <GridSkeleton />}

      {/* Error */}
      {error && !isLoading && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-red-200 bg-red-50 px-6 py-12 text-center">
          <AlertTriangle size={24} className="text-red-400" />
          <p className="font-semibold text-red-700">Could not load categories</p>
          <p className="text-sm text-red-500">{(error as Error).message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-1 flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
          >
            <RotateCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && categories.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center">
          <Tag size={28} className="text-ink-4" />
          <p className="font-semibold text-ink">
            {query ? 'No categories match your search' : 'No categories yet'}
          </p>
          <p className="text-sm text-ink-3">
            {query
              ? 'Try a different keyword.'
              : 'Click "New category" to create one, or bulk-import products — categories are auto-created from the import.'}
          </p>
          {!query && (
            <Button size="sm" leadingIcon={<Plus size={13} />} onClick={() => setShowNew(true)}>
              New category
            </Button>
          )}
        </div>
      )}

      {/* Category grid */}
      {!isLoading && !error && categories.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="group relative flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 group-hover:bg-brand-200 transition-colors">
                <Tag size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{cat.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Link
                    href={`/admin/products?category=${encodeURIComponent(cat.name)}`}
                    className="text-xs text-ink-3 hover:text-brand-600 transition-colors"
                  >
                    {(cat as CategoryDTO & { product_count?: number }).product_count ?? 0} product{((cat as CategoryDTO & { product_count?: number }).product_count ?? 0) !== 1 ? 's' : ''} →
                  </Link>
                </div>
              </div>
              {/* Delete button — visible on hover */}
              <button
                type="button"
                onClick={() => setToDelete(cat as CategoryDTO & { product_count?: number })}
                className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-md text-ink-4 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-500"
                title="Delete category"
              >
                <Trash size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filter count */}
      {!isLoading && !error && query && categories.length > 0 && (
        <p className="mt-4 text-center text-xs text-ink-4">
          Showing {categories.length} of {(data ?? []).length} categories
        </p>
      )}

      {/* Modals */}
      {showNew && (
        <NewCategoryModal
          onClose={() => setShowNew(false)}
          onCreated={handleCreated}
        />
      )}
      {toDelete && (
        <DeleteModal
          category={toDelete}
          onClose={() => setToDelete(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
