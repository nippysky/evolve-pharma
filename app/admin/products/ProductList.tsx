'use client';

/**
 * Products list — live data from GET products?page=1&limit=N
 * Categories pulled from product/categories API.
 */

import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, AlertTriangle, RotateCw, ChevronLeft, ChevronRight, MoreV, Edit, Trash } from '@/components/icons';
import { Badge } from '@/components/ui/Primitives';
import { useAdminProducts } from '@/hooks/admin/useAdminProducts';
import { cn, formatNaira } from '@/lib/utils';
import type { AdminProductRecord } from '@/lib/api/types';

const ALL = 'All';
const PAGE_LIMIT = 50;

type BadgeTone = 'neutral' | 'success' | 'danger';
type StatusFilter = 'all' | 'active' | 'draft' | 'discontinued';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'active',       label: 'Active' },
  { value: 'draft',        label: 'Draft' },
  { value: 'discontinued', label: 'Discontinued' },
];

function statusBadge(s: string): { label: string; tone: BadgeTone } {
  const v = s?.toUpperCase();
  if (v === 'ACTIVE')       return { label: 'Active',       tone: 'success' };
  if (v === 'DISCONTINUED') return { label: 'Discontinued', tone: 'danger' };
  return { label: 'Draft', tone: 'neutral' };
}

/** First image URL from the images array, or null */
function productImage(p: AdminProductRecord): string | null {
  const img = p.images?.[0];
  if (!img) return null;
  return img.url ?? img.url ?? null;
}

/** Compute is_low_stock from the available data */
function isLowStock(p: AdminProductRecord): boolean {
  return p.total_quantity_available <= p.minimum_stock_level;
}

// ─── 3-dot action menu (portal) ──────────────────────────────────────────────
//
// Renders the dropdown via createPortal into document.body so it escapes
// the table's overflow:hidden containers and positions via fixed coords.

interface DropdownPos { top: number; right: number }

function ActionMenu({ sku }: { sku: string }) {
  const [open, setOpen]   = useState(false);
  const [pos,  setPos]    = useState<DropdownPos>({ top: 0, right: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  // Ensure portal target exists (client-only)
  useEffect(() => { setMounted(true); }, []);

  // Recalculate fixed position from the button whenever the menu opens
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({
      top:   r.bottom + 4,                     // 4 px gap below the button
      right: window.innerWidth - r.right,       // align right edges
    });
  }, [open]);

  // Close on outside click or scroll
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

  const dropdown = (
    <div
      style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
      className="w-40 overflow-hidden rounded-lg border border-line bg-white shadow-xl"
      onMouseDown={(e) => e.stopPropagation()} // don't close when clicking inside
    >
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          router.push(`/admin/products/${encodeURIComponent(sku)}`);
        }}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-bg-subtle transition-colors"
      >
        <Edit size={13} className="text-ink-3 shrink-0" />
        Edit product
      </button>
      <div className="border-t border-line-subtle" />
      <button
        type="button"
        disabled
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-red-400 opacity-40 cursor-not-allowed"
      >
        <Trash size={13} className="shrink-0" />
        Delete
      </button>
    </div>
  );

  return (
    <div className="flex justify-end">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="Product actions"
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-bg-muted hover:text-ink"
      >
        <MoreV size={15} />
      </button>
      {open && mounted && createPortal(dropdown, document.body)}
    </div>
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
              {['Product', 'SKU', 'Category', 'Price', 'Stock', 'Strength', 'Status', ''].map((h) => (
                <th key={h} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-t border-line-subtle animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-md bg-bg-muted" />
                    <div className="space-y-1.5">
                      <div className="h-3 w-32 rounded bg-bg-muted" />
                      <div className="h-2.5 w-20 rounded bg-bg-muted" />
                    </div>
                  </div>
                </td>
                {[60, 80, 56, 40, 72, 48].map((w, j) => (
                  <td key={j} className="px-5 py-3.5">
                    <div className="h-3 rounded bg-bg-muted" style={{ width: w }} />
                  </td>
                ))}
                <td className="px-5 py-3.5" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function PaginationBar({
  page, hasMore, total, onPage,
}: {
  page: number; hasMore: boolean; total: number; onPage: (p: number) => void;
}) {
  if (page === 1 && !hasMore) return null;
  return (
    <div className="flex items-center justify-between border-t border-line-subtle bg-bg-subtle px-5 py-3">
      <p className="text-xs text-ink-3">
        Page <span className="font-semibold text-ink-2">{page}</span>
        <span className="mx-1.5 text-ink-4">·</span>
        <span className="font-semibold text-ink-2">{total.toLocaleString()}</span> shown
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-3 hover:border-brand-300 hover:text-brand-600 disabled:opacity-30 transition-colors"
        ><ChevronLeft size={13} /></button>
        <button
          type="button" disabled={!hasMore} onClick={() => onPage(page + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-3 hover:border-brand-300 hover:text-brand-600 disabled:opacity-30 transition-colors"
        ><ChevronRight size={13} /></button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProductsList() {
  const [query, setQuery]       = useState('');
  const [category, setCategory] = useState<string>(ALL);
  const [status, setStatus]     = useState<StatusFilter>('all');
  const [page, setPage]         = useState(1);

  // API hooks
  const {
    data: products,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useAdminProducts({ page, limit: PAGE_LIMIT });

  const allProducts: AdminProductRecord[] = products ?? [];

  // Derive categories from the loaded product list — no separate API call needed
  const categories: string[] = useMemo(
    () =>
      [...new Set(allProducts.map((p) => p.category?.name).filter(Boolean))].sort() as string[],
    [allProducts],
  );

  // Client-side filtering on the current page
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allProducts.filter((p) => {
      const matchQ = !q
        || p.brand_name?.toLowerCase().includes(q)
        || p.sku?.toLowerCase().includes(q)
        || p.manufacturer?.name?.toLowerCase().includes(q)
        || p.generic_name?.toLowerCase().includes(q);
      const matchCat = category === ALL || p.category?.name === category;
      const matchSt  = status === 'all' || p.status?.toUpperCase() === status.toUpperCase();
      return matchQ && matchCat && matchSt;
    });
  }, [allProducts, query, category, status]);

  // If we got a full page back, there may be more
  const hasMore = allProducts.length === PAGE_LIMIT;

  // Reset to page 1 when filters change
  const setFilter = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  return (
    <>
      {/* Search + status tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-sm flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setFilter(setQuery)(e.target.value)}
            placeholder="Search by name, SKU, manufacturer…"
            aria-label="Search products"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="inline-flex rounded-md bg-bg-muted p-0.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setFilter(setStatus)(t.value)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                status === t.value ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {isFetching && !isLoading && (
          <RotateCw size={13} className="animate-spin text-ink-3" />
        )}
      </div>

      {/* Category pills */}
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilter(setCategory)(ALL)}
          className={cn(
            'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            category === ALL
              ? 'border-ink bg-ink text-white'
              : 'border-line bg-white text-ink-2 hover:border-line-strong',
          )}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(setCategory)(c)}
            className={cn(
              'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              category === c
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-white text-ink-2 hover:border-line-strong',
            )}
          >
            {c}
          </button>
        ))}
        {isLoading && [80, 100, 72, 110].map((w, i) => (
          <div key={i} className="h-7 animate-pulse rounded-full bg-bg-muted" style={{ width: w }} />
        ))}
      </div>

      {/* Loading skeleton */}
      {isLoading && <TableSkeleton />}

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-200 bg-red-50 px-6 py-12 text-center">
          <AlertTriangle size={24} className="text-red-400" />
          <p className="font-semibold text-red-700">Could not load products</p>
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

      {/* Empty state */}
      {!isLoading && !error && visible.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center">
          <span className="display-serif text-xl text-ink">No products found</span>
          <span className="text-sm text-ink-2">
            {allProducts.length === 0
              ? 'Import products using the button above to get started.'
              : 'Try adjusting your search or filter.'}
          </span>
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && visible.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-subtle bg-bg-subtle text-left">
                  {['Product', 'SKU', 'Category', 'Price', 'Stock', 'Strength', 'Status', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {visible.map((p) => {
                  const b      = statusBadge(p.status ?? '');
                  const low    = isLowStock(p);
                  const imgSrc = productImage(p);
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-bg-subtle/50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {imgSrc ? (
                            <Image
                              src={imgSrc}
                              alt={p.brand_name}
                              width={36}
                              height={36}
                              className="h-9 w-9 shrink-0 rounded-md border border-line object-contain"
                            />
                          ) : (
                            <span className="h-9 w-9 shrink-0 rounded-md border border-line bg-bg-muted" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{p.brand_name}</p>
                            <p className="truncate text-xs text-ink-3">{p.generic_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-ink-2">{p.sku}</td>
                      <td className="px-5 py-3.5 text-ink-2">{p.category?.name ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="num font-medium text-ink">{formatNaira(Number(p.selling_price))}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn('num text-sm font-medium', low ? 'text-danger' : 'text-ink')}>
                          {p.total_quantity_available.toLocaleString()}
                          {low && <span className="ml-1 text-[10px] text-danger">LOW</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-ink-2">{p.product_strength || '—'}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={b.tone}>{b.label}</Badge>
                      </td>
                      <td className="px-3 py-3.5">
                        <ActionMenu sku={p.sku} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={page}
            hasMore={hasMore}
            total={visible.length}
            onPage={setPage}
          />
        </div>
      )}
    </>
  );
}
