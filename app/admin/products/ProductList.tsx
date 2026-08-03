'use client';

/**
 * Products list — live data from GET /api/products
 *
 * Features:
 *  - Stacked image tile (up to 4 thumbnails + "+N" overflow badge)
 *  - Category filter pills from API
 *  - Status tab bar (All / Active / Draft / Discontinued)
 *  - Text search (name, SKU, manufacturer, generic name)
 *  - Low-stock highlight
 *  - Server-side pagination
 */

import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal }    from 'react-dom';
import Image               from 'next/image';
import { useRouter }       from 'next/navigation';
import { useQueryClient }  from '@tanstack/react-query';
import {
  Search, AlertTriangle, RotateCw,
  ChevronLeft, ChevronRight, MoreV, Edit, Trash, X,
} from '@/components/icons';
import { Badge }           from '@/components/ui/Primitives';
import { Button }          from '@/components/ui/Button';
import { useAdminProducts, useProductCategories, PRODUCT_KEYS } from '@/hooks/admin/useAdminProducts';
import { useToast }        from '@/contexts/ToastContext';
import { cn, formatNaira } from '@/lib/utils';
import type { AdminProductRecord, ProductImageDTO, CategoryDTO } from '@/lib/api/types';

const ALL        = 'All';
const PAGE_LIMIT = 50;

type BadgeTone    = 'neutral' | 'success' | 'danger';
type StatusFilter = 'all' | 'active' | 'draft' | 'discontinued';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',          label: 'All'          },
  { value: 'active',       label: 'Active'       },
  { value: 'draft',        label: 'Draft'        },
  { value: 'discontinued', label: 'Discontinued' },
];

function statusBadge(s: string): { label: string; tone: BadgeTone } {
  const v = s?.toUpperCase();
  if (v === 'ACTIVE')       return { label: 'Active',       tone: 'success' };
  if (v === 'DISCONTINUED') return { label: 'Discontinued', tone: 'danger'  };
  return { label: 'Draft', tone: 'neutral' };
}

function isLowStock(p: AdminProductRecord): boolean {
  return (p.total_stock ?? 0) <= p.minimum_stock_level;
}

// ─── Stacked image tile ───────────────────────────────────────────────────────

function ImageStack({ images, alt }: { images: ProductImageDTO[]; alt: string }) {
  const MAX_SHOW = 4;
  const shown    = images.slice(0, MAX_SHOW);
  const extra    = images.length - MAX_SHOW;

  if (images.length === 0) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-bg-muted text-[10px] text-ink-4">
        —
      </span>
    );
  }

  if (images.length === 1) {
    return (
      <Image
        src={images[0]!.url}
        alt={alt}
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-lg border border-line object-contain bg-white"
      />
    );
  }

  const TILE_W = 22;
  const OFFSET = 7;
  const containerW = TILE_W + (shown.length - 1) * OFFSET + (extra > 0 ? OFFSET + 4 : 0);

  return (
    <div className="relative shrink-0" style={{ width: containerW, height: 26 }}>
      {shown.map((img, i) => (
        <Image
          key={img.id}
          src={img.url}
          alt={alt}
          width={TILE_W}
          height={26}
          style={{ left: i * OFFSET, zIndex: shown.length - i }}
          className="absolute top-0 h-[26px] rounded-md border border-line object-contain bg-white shadow-sm"
        />
      ))}
      {extra > 0 && (
        <span
          style={{ left: shown.length * OFFSET, zIndex: 0, width: TILE_W }}
          className="absolute top-0 flex h-[26px] items-center justify-center rounded-md border border-line bg-bg-muted text-[9px] font-bold text-ink-3"
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

// ─── 3-dot action menu (portal) ──────────────────────────────────────────────

interface DropdownPos { top: number; right: number }

function ActionMenu({ sku, onDelete }: { sku: string; onDelete: () => void }) {
  const [open,    setOpen]    = useState(false);
  const [pos,     setPos]     = useState<DropdownPos>({ top: 0, right: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll',    close, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll',    close, true);
    };
  }, [open]);

  // SKUs are stored uppercase in DB; lowercase in the URL for readability.
  // MySQL's default collation is case-insensitive so the lookup still matches.
  const editUrl = `/admin/products/${encodeURIComponent(sku.toLowerCase())}`;

  const dropdown = (
    <div
      style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
      className="w-40 overflow-hidden rounded-lg border border-line bg-white shadow-xl"
      onMouseDown={e => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => { setOpen(false); router.push(editUrl); }}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-bg-subtle transition-colors"
      >
        <Edit size={13} className="text-ink-3 shrink-0" /> Edit product
      </button>
      <div className="border-t border-line-subtle" />
      <button
        type="button"
        onClick={() => { setOpen(false); onDelete(); }}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash size={13} className="shrink-0" /> Delete
      </button>
    </div>
  );

  return (
    <div className="flex justify-end">
      <button
        ref={btnRef} type="button"
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        aria-label="Product actions"
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-bg-muted hover:text-ink transition-colors"
      >
        <MoreV size={15} />
      </button>
      {open && mounted && createPortal(dropdown, document.body)}
    </div>
  );
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

interface DeleteTarget {
  sku:        string;
  brandName:  string;
  totalStock: number;
}

function DeleteProductModal({
  target,
  onClose,
  onDeleted,
}: {
  target:    DeleteTarget;
  onClose:   () => void;
  onDeleted: () => void;
}) {
  const [busy,    setBusy]    = useState(false);
  const [confirm, setConfirm] = useState('');
  const toast = useToast();

  const CONFIRM_WORD = 'DELETE';
  const ready        = confirm.trim().toUpperCase() === CONFIRM_WORD;

  async function handleDelete() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const res  = await fetch(`/api/products/${encodeURIComponent(target.sku)}`, { method: 'DELETE' });
      const json = await res.json() as { status: string; message: string; data?: { images_removed: number; batches_archived: number } };
      if (!res.ok || json.status !== 'success') {
        toast.error(json.message ?? 'Delete failed. Please try again.');
        setBusy(false);
        return;
      }
      toast.success(json.message ?? `"${target.brandName}" deleted.`);
      onDeleted();
    } catch {
      toast.error('Network error — please try again.');
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line-subtle p-5">
          <div>
            <p className="font-semibold text-ink">Delete product</p>
            <p className="mt-0.5 text-sm text-ink-3">This action cannot be undone</p>
          </div>
          <button
            type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 hover:bg-bg-muted transition-colors"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          <p className="text-sm text-ink">
            You are about to permanently delete{' '}
            <span className="font-semibold text-ink">{target.brandName}</span>
            {' '}(<span className="font-mono text-xs text-ink-2">{target.sku}</span>).
          </p>

          {/* Impact summary */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2 text-sm">
            <p className="font-medium text-amber-800">What will happen:</p>
            <ul className="space-y-1 text-amber-700 text-xs">
              <li>• All product images will be removed from storage</li>
              {target.totalStock > 0 && (
                <li>• <span className="font-semibold">{target.totalStock.toLocaleString()} units</span> of inventory will be archived (stock history is preserved)</li>
              )}
              {target.totalStock === 0 && (
                <li>• No stock currently on hand — no inventory impact</li>
              )}
              <li>• Order history referencing this product is unaffected</li>
            </ul>
          </div>

          {/* Confirmation input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-ink-2">
              Type <span className="font-mono font-bold text-ink">{CONFIRM_WORD}</span> to confirm
            </label>
            <input
              type="text"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoFocus
              className="h-9 w-full rounded-md border border-line bg-white px-3 text-sm font-mono placeholder:text-ink-4 focus:border-red-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-line-subtle px-5 py-4">
          <button
            type="button" onClick={onClose} disabled={busy}
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <Button
            onClick={handleDelete}
            disabled={!ready || busy}
            loading={busy}
            className="!bg-red-600 hover:!bg-red-700 disabled:!bg-red-300"
          >
            Delete product
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Table skeleton ───────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-subtle bg-bg-subtle text-left">
              {['', 'Product', 'SKU', 'Category', 'Price', 'Stock', 'Status', ''].map((h, i) => (
                <th key={i} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-t border-line-subtle animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
                <td className="px-4 py-3"><div className="h-[26px] w-12 rounded-md bg-bg-muted" /></td>
                <td className="px-4 py-3.5"><div className="space-y-1.5"><div className="h-3 w-32 rounded bg-bg-muted" /><div className="h-2.5 w-20 rounded bg-bg-muted" /></div></td>
                {[60, 80, 56, 40, 48].map((w, j) => (
                  <td key={j} className="px-4 py-3.5"><div className="h-3 rounded bg-bg-muted" style={{ width: w }} /></td>
                ))}
                <td className="px-4 py-3.5" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function PaginationBar({ page, hasMore, total, onPage }: { page: number; hasMore: boolean; total: number; onPage: (p: number) => void }) {
  if (page === 1 && !hasMore) return null;
  return (
    <div className="flex items-center justify-between border-t border-line-subtle bg-bg-subtle px-5 py-3">
      <p className="text-xs text-ink-3">
        Page <span className="font-semibold text-ink-2">{page}</span>
        <span className="mx-1.5 text-ink-4">·</span>
        <span className="font-semibold text-ink-2">{total.toLocaleString()}</span> shown
      </p>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-3 hover:border-brand-300 hover:text-brand-600 disabled:opacity-30 transition-colors">
          <ChevronLeft size={13} />
        </button>
        <button type="button" disabled={!hasMore} onClick={() => onPage(page + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-3 hover:border-brand-300 hover:text-brand-600 disabled:opacity-30 transition-colors">
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProductsList() {
  const [query,    setQuery]    = useState('');
  const [category, setCategory] = useState<string>(ALL);
  const [status,   setStatus]   = useState<StatusFilter>('all');
  const [page,     setPage]     = useState(1);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);

  const queryClient = useQueryClient();

  const { data: products, isLoading, isFetching, error, refetch } = useAdminProducts({ page, limit: PAGE_LIMIT });
  const { data: categoryData, isLoading: catsLoading }             = useProductCategories();

  function handleDeleted() {
    setDeleting(null);
    void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
  }

  const allProducts:   AdminProductRecord[] = products ?? [];
  const allCategories: CategoryDTO[]        = (categoryData ?? []) as CategoryDTO[];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allProducts.filter(p => {
      const matchQ   = !q || p.brand_name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
        || p.manufacturer?.name?.toLowerCase().includes(q) || p.generic_name?.toLowerCase().includes(q);
      const matchCat = category === ALL || p.category?.name === category;
      const matchSt  = status === 'all' || p.status?.toUpperCase() === status.toUpperCase();
      return matchQ && matchCat && matchSt;
    });
  }, [allProducts, query, category, status]);

  const hasMore   = allProducts.length === PAGE_LIMIT;
  const setFilter = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  return (
    <>
      {/* Search + status tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-sm flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input type="search" value={query} onChange={e => setFilter(setQuery)(e.target.value)}
            placeholder="Search by name, SKU, manufacturer…" aria-label="Search products"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none" />
        </div>
        <div className="inline-flex rounded-md bg-bg-muted p-0.5">
          {STATUS_TABS.map(t => (
            <button key={t.value} type="button" onClick={() => setFilter(setStatus)(t.value)}
              className={cn('rounded px-3 py-1.5 text-xs font-medium transition-colors',
                status === t.value ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink')}>
              {t.label}
            </button>
          ))}
        </div>
        {isFetching && !isLoading && <RotateCw size={13} className="animate-spin text-ink-3" />}
      </div>

      {/* Category filter pills */}
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setFilter(setCategory)(ALL)}
          className={cn('whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            category === ALL ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-line-strong')}>
          All
        </button>
        {catsLoading && [80, 100, 72, 110, 90].map((w, i) => (
          <div key={i} className="h-7 animate-pulse rounded-full bg-bg-muted" style={{ width: w }} />
        ))}
        {allCategories.map(c => (
          <button key={c.id} type="button" onClick={() => setFilter(setCategory)(c.name)}
            className={cn('whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              category === c.name ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-line-strong')}>
            {c.name}
          </button>
        ))}
      </div>

      {isLoading && <TableSkeleton />}

      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-200 bg-red-50 px-6 py-12 text-center">
          <AlertTriangle size={24} className="text-red-400" />
          <p className="font-semibold text-red-700">Could not load products</p>
          <p className="text-sm text-red-500">{(error as Error).message}</p>
          <button type="button" onClick={() => void refetch()}
            className="mt-1 flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors">
            <RotateCw size={12} /> Retry
          </button>
        </div>
      )}

      {!isLoading && !error && visible.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center">
          <span className="text-xl font-semibold text-ink">No products found</span>
          <span className="text-sm text-ink-2">
            {allProducts.length === 0
              ? 'Import products using the button above, or add one individually.'
              : 'Try adjusting your search or filter.'}
          </span>
        </div>
      )}

      {!isLoading && !error && visible.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-subtle bg-bg-subtle text-left">
                  {['', 'Product', 'SKU', 'Category', 'Price', 'Stock', 'Status', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {visible.map(p => {
                  const b   = statusBadge(p.status ?? '');
                  const low = isLowStock(p);
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-bg-subtle/50">
                      <td className="px-4 py-3">
                        <ImageStack images={p.images ?? []} alt={p.brand_name} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{p.brand_name}</p>
                          <p className="truncate text-xs text-ink-3">{p.generic_name}</p>
                          {p.product_strength && <p className="text-[10px] text-ink-4">{p.product_strength}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-ink-2">{p.sku}</td>
                      <td className="px-4 py-3.5 text-ink-2">{p.category?.name ?? '—'}</td>
                      <td className="px-4 py-3.5">
                        <span className="num font-medium text-ink">{formatNaira(Number(p.selling_price))}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn('num text-sm font-medium', low ? 'text-danger' : 'text-ink')}>
                          {(p.total_stock ?? 0).toLocaleString()}
                          {low && <span className="ml-1 text-[10px] font-bold text-danger">LOW</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3.5"><Badge tone={b.tone}>{b.label}</Badge></td>
                      <td className="px-3 py-3.5">
                        <ActionMenu
                          sku={p.sku}
                          onDelete={() => setDeleting({ sku: p.sku, brandName: p.brand_name, totalStock: p.total_stock ?? 0 })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar page={page} hasMore={hasMore} total={visible.length} onPage={setPage} />
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleting && (
        <DeleteProductModal
          target={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
