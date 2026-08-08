'use client';
import { useMemo, useState }    from 'react';
import Link                      from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHead }              from '@/components/shared/PageHead';
import { Button }                from '@/components/ui/Button';
import { Field, Input }          from '@/components/ui/Field';
import { Search, AlertTriangle, RotateCw, Building, Plus, Trash, Edit, X } from '@/components/icons';
import { useToast }              from '@/contexts/ToastContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ManufacturerDTO {
  id:            number;
  name:          string;
  product_count: number;
  created_at:    string;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res  = await fetch(path, { credentials: 'include', ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message ?? 'Request failed');
  return json?.data as T;
}

async function fetchManufacturers(): Promise<ManufacturerDTO[]> {
  const data = await apiFetch<{ manufacturers: ManufacturerDTO[] }>('/api/products/manufacturers');
  return data.manufacturers ?? [];
}

async function createManufacturer(name: string): Promise<ManufacturerDTO> {
  const data = await apiFetch<{ manufacturer: ManufacturerDTO }>('/api/products/manufacturers', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name }),
  });
  return data.manufacturer;
}

async function renameManufacturer(id: number, name: string): Promise<ManufacturerDTO> {
  const data = await apiFetch<{ manufacturer: ManufacturerDTO }>(`/api/products/manufacturers/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name }),
  });
  return data.manufacturer;
}

async function deleteManufacturer(id: number): Promise<void> {
  await apiFetch(`/api/products/manufacturers/${id}`, { method: 'DELETE' });
}

// ─── Query hook ──────────────────────────────────────────────────────────────

function useManufacturers() {
  return useQuery<ManufacturerDTO[], Error>({
    queryKey:    ['manufacturers'],
    queryFn:     fetchManufacturers,
    staleTime:   30_000,
  });
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-bg-muted" style={{ animationDelay: `${i * 50}ms` }} />
      ))}
    </div>
  );
}

// ─── New manufacturer modal ───────────────────────────────────────────────────

interface NewModalProps {
  onClose:   () => void;
  onCreated: (m: ManufacturerDTO) => void;
}

function NewManufacturerModal({ onClose, onCreated }: NewModalProps) {
  const toast            = useToast();
  const [name, setName]   = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Manufacturer name is required'); return; }
    if (trimmed.length > 255) { setError('Name is too long (max 255 characters)'); return; }

    setSaving(true);
    setError('');
    try {
      const m = await createManufacturer(trimmed);
      toast.show({ tone: 'success', title: 'Manufacturer created', description: m.name });
      onCreated(m);
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
            <h2 className="text-base font-semibold text-ink">New manufacturer</h2>
            <p className="mt-0.5 text-xs text-ink-3">Add a pharmaceutical manufacturer to the catalog.</p>
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
          <Field label="Manufacturer name" error={error} required>
            <Input
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="e.g. Pfizer Nigeria Ltd"
              disabled={saving}
            />
          </Field>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={saving}>
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Rename modal ─────────────────────────────────────────────────────────────

interface RenameModalProps {
  manufacturer: ManufacturerDTO;
  onClose:      () => void;
  onRenamed:    (m: ManufacturerDTO) => void;
}

function RenameModal({ manufacturer, onClose, onRenamed }: RenameModalProps) {
  const toast              = useToast();
  const [name, setName]    = useState(manufacturer.name);
  const [error, setError]  = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Name is required'); return; }
    if (trimmed === manufacturer.name) { onClose(); return; }

    setSaving(true);
    setError('');
    try {
      const updated = await renameManufacturer(manufacturer.id, trimmed);
      toast.show({ tone: 'success', title: 'Manufacturer renamed', description: `"${manufacturer.name}" → "${updated.name}"` });
      onRenamed(updated);
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
            <h2 className="text-base font-semibold text-ink">Rename manufacturer</h2>
            <p className="mt-0.5 text-xs text-amber-700 font-medium">
              ⚠ The manufacturer name is part of each product's SKU. Renaming changes how <em>new</em> products are slugged — existing SKUs are unaffected.
            </p>
          </div>
          <button type="button" onClick={onClose} className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-4 transition-colors hover:bg-bg-muted hover:text-ink">
            <X size={14} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <Field label="Manufacturer name" error={error} required>
            <Input
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              disabled={saving}
            />
          </Field>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={saving}>
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete modal ─────────────────────────────────────────────────────────────

interface DeleteModalProps {
  manufacturer: ManufacturerDTO;
  onClose:      () => void;
  onDeleted:    (id: number) => void;
}

function DeleteModal({ manufacturer, onClose, onDeleted }: DeleteModalProps) {
  const toast           = useToast();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteManufacturer(manufacturer.id);
      toast.show({
        tone:        'success',
        title:       'Manufacturer deleted',
        description: `"${manufacturer.name}" removed. ${manufacturer.product_count} product(s) are now unassigned.`,
      });
      onDeleted(manufacturer.id);
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
        <h2 className="mb-1.5 text-base font-semibold text-ink">Delete manufacturer?</h2>
        <p className="text-sm text-ink-2">
          <span className="font-semibold">"{manufacturer.name}"</span> will be removed.
          {manufacturer.product_count > 0 && (
            <span className="mt-1 block font-medium text-amber-700">
              ⚠ {manufacturer.product_count} product(s) will lose their manufacturer assignment.
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
            className="border-transparent bg-red-600 text-white hover:bg-red-700"
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManufacturersPage() {
  const queryClient = useQueryClient();

  const [query,    setQuery]    = useState('');
  const [showNew,  setShowNew]  = useState(false);
  const [toRename, setToRename] = useState<ManufacturerDTO | null>(null);
  const [toDelete, setToDelete] = useState<ManufacturerDTO | null>(null);

  const { data, isLoading, error, refetch } = useManufacturers();

  const manufacturers = useMemo(() => {
    const all = data ?? [];
    const q   = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(m => m.name.toLowerCase().includes(q));
  }, [data, query]);

  function handleCreated(m: ManufacturerDTO) {
    queryClient.setQueryData<ManufacturerDTO[]>(
      ['manufacturers'],
      (old = []) => [...old, { ...m, product_count: 0 }].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  function handleRenamed(updated: ManufacturerDTO) {
    queryClient.setQueryData<ManufacturerDTO[]>(
      ['manufacturers'],
      (old = []) => old
        .map(m => m.id === updated.id ? { ...m, ...updated } : m)
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  function handleDeleted(id: number) {
    queryClient.setQueryData<ManufacturerDTO[]>(
      ['manufacturers'],
      (old = []) => old.filter(m => m.id !== id),
    );
  }

  return (
    <>
      <PageHead
        title="Manufacturers"
        subtitle="Manage pharmaceutical manufacturers. The manufacturer name forms part of each product's SKU."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/products"
              className="rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              ← Products
            </Link>
            <Button size="sm" leadingIcon={<Plus size={14} />} onClick={() => setShowNew(true)}>
              New manufacturer
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
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter manufacturers…"
            aria-label="Search manufacturers"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
          />
        </div>
        {data && (
          <p className="text-sm text-ink-3">
            <span className="font-semibold text-ink-2">{data.length}</span> total
          </p>
        )}
      </div>

      {/* Loading */}
      {isLoading && <GridSkeleton />}

      {/* Error */}
      {error && !isLoading && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-red-200 bg-red-50 px-6 py-12 text-center">
          <AlertTriangle size={24} className="text-red-400" />
          <p className="font-semibold text-red-700">Could not load manufacturers</p>
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
      {!isLoading && !error && manufacturers.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center">
          <Building size={28} className="text-ink-4" />
          <p className="font-semibold text-ink">
            {query ? 'No manufacturers match your search' : 'No manufacturers yet'}
          </p>
          <p className="text-sm text-ink-3">
            {query
              ? 'Try a different keyword.'
              : 'Click "New manufacturer" to add one, or bulk-import products — manufacturers are auto-created from the import.'}
          </p>
          {!query && (
            <Button size="sm" leadingIcon={<Plus size={13} />} onClick={() => setShowNew(true)}>
              New manufacturer
            </Button>
          )}
        </div>
      )}

      {/* Grid */}
      {!isLoading && !error && manufacturers.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {manufacturers.map(m => (
            <div
              key={m.id}
              className="group relative flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 transition-colors group-hover:bg-brand-200">
                <Building size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{m.name}</p>
                <Link
                  href={`/admin/products?manufacturer=${encodeURIComponent(m.name)}`}
                  className="text-xs text-ink-3 hover:text-brand-600 transition-colors"
                >
                  {m.product_count} product{m.product_count !== 1 ? 's' : ''} →
                </Link>
              </div>

              {/* Action buttons — visible on hover */}
              <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setToRename(m)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-ink-4 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                  title="Rename"
                >
                  <Edit size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setToDelete(m)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-ink-4 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter count */}
      {!isLoading && !error && query && manufacturers.length > 0 && (
        <p className="mt-4 text-center text-xs text-ink-4">
          Showing {manufacturers.length} of {(data ?? []).length} manufacturers
        </p>
      )}

      {/* Modals */}
      {showNew && (
        <NewManufacturerModal
          onClose={() => setShowNew(false)}
          onCreated={handleCreated}
        />
      )}
      {toRename && (
        <RenameModal
          manufacturer={toRename}
          onClose={() => setToRename(null)}
          onRenamed={handleRenamed}
        />
      )}
      {toDelete && (
        <DeleteModal
          manufacturer={toDelete}
          onClose={() => setToDelete(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
