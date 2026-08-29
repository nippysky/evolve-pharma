'use client';
import {
  useState, useMemo, useRef, useEffect,
  useLayoutEffect,
} from 'react';
import { createPortal }    from 'react-dom';
import Image               from 'next/image';
import Link                from 'next/link';
import { useRouter }       from 'next/navigation';
import { useQueryClient }  from '@tanstack/react-query';
import {
  Search, AlertTriangle, RotateCw,
  ChevronLeft, ChevronRight, MoreV, Edit, Trash, X, CheckCircle,
} from '@/components/icons';
import { Badge }           from '@/components/ui/Primitives';
import { Button }          from '@/components/ui/Button';
import { useAdminProducts, useProductCategories, PRODUCT_KEYS } from '@/hooks/admin/useAdminProducts';
import { useToast }        from '@/contexts/ToastContext';
import { useDebounced }    from '@/hooks/useDebounced';
import { cn, formatNaira } from '@/lib/utils';
import type { AdminProductRecord, ProductImageDTO, CategoryDTO } from '@/lib/api/types';

const ALL = 'All';

/** Page sizes offered in the footer. The client asked for 10 and 100 as ends. */
const PAGE_SIZES = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

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

interface DropdownPos { top: number; right: number }

function ActionMenu({ sku, status, onDelete, onPublish }: {
  sku:       string;
  status:    string;
  onDelete:  () => void;
  onPublish: () => void;
}) {
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

  const editUrl = `/admin/products/${encodeURIComponent(sku.toLowerCase())}`;
  const isDraft = status?.toUpperCase() === 'DRAFT';

  const dropdown = (
    <div
      style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
      className="w-44 overflow-hidden rounded-lg border border-line bg-white shadow-xl"
      onMouseDown={e => e.stopPropagation()}
    >
      {isDraft && (
        <>
          <button
            type="button"
            onClick={() => { setOpen(false); onPublish(); }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-leaf-700 hover:bg-leaf-50 transition-colors"
          >
            <CheckCircle size={13} className="shrink-0" /> Publish product
          </button>
          <div className="border-t border-line-subtle" />
        </>
      )}
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
            <p className="font-medium text-amber-800">What will be deleted:</p>
            <ul className="space-y-1 text-amber-700 text-xs">
              <li>• All product images (removed from storage)</li>
              <li>• All inventory batches and stock movement records</li>
              {target.totalStock > 0 && (
                <li>• <span className="font-semibold">{target.totalStock.toLocaleString()} units</span> currently in stock</li>
              )}
              <li>• Order history referencing this product is not affected</li>
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

function BulkDeleteModal({
  count,
  busy,
  onClose,
  onConfirm,
}: {
  count:     number;
  busy:      boolean;
  onClose:   () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onMouseDown={e => { if (!busy && e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-line-subtle p-5">
          <div>
            <p className="font-semibold text-ink">
              Delete {count} product{count !== 1 ? 's' : ''}
            </p>
            <p className="mt-0.5 text-sm text-ink-3">This action cannot be undone</p>
          </div>
          <button
            type="button" onClick={onClose} disabled={busy}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 hover:bg-bg-muted transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm text-ink">
            You are about to permanently delete{' '}
            <span className="font-semibold">{count} product{count !== 1 ? 's' : ''}</span>{' '}
            and all their associated data.
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-700 leading-relaxed space-y-1">
            <p className="font-medium text-amber-800">What will be deleted:</p>
            <p>• All images, inventory batches, and stock movement records</p>
            <p>• Order history referencing these products is not affected</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-line-subtle px-5 py-4">
          <button
            type="button" onClick={onClose} disabled={busy}
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <Button
            onClick={onConfirm}
            disabled={busy}
            loading={busy}
            className="!bg-red-600 hover:!bg-red-700 disabled:!bg-red-300"
          >
            Delete {count} product{count !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
// Rendered via portal so the admin layout's overflow/stacking context
// cannot clip or trap the fixed-position bar.

function BulkActionBar({
  count,
  draftCount,
  busyPublish,
  busyDelete,
  onPublish,
  onDelete,
  onClear,
}: {
  count:       number;
  draftCount:  number;
  busyPublish: boolean;
  busyDelete:  boolean;
  onPublish:   () => void;
  onDelete:    () => void;
  onClear:     () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const bar = (
    <div
      style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 9998 }}
      className="pointer-events-auto"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-5 py-3 shadow-2xl shadow-black/15 ring-1 ring-black/8">
        {/* Selection count + clear */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink tabular-nums">
            {count} selected
          </span>
          <button
            type="button" onClick={onClear}
            aria-label="Clear selection"
            className="flex h-5 w-5 items-center justify-center rounded-full text-ink-3 hover:bg-bg-muted hover:text-ink transition-colors"
          >
            <X size={11} />
          </button>
        </div>

        <div className="h-5 w-px bg-line" />

        {/* Publish — only shown when DRAFT products are in the selection */}
        {draftCount > 0 && (
          <button
            type="button"
            onClick={onPublish}
            disabled={busyPublish || busyDelete}
            className="flex items-center gap-1.5 rounded-lg bg-leaf-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-leaf-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle size={13} />
            {busyPublish
              ? 'Publishing…'
              : `Publish ${draftCount === count ? count : `${draftCount} draft${draftCount !== 1 ? 's' : ''}`}`
            }
          </button>
        )}

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          disabled={busyPublish || busyDelete}
          className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          <Trash size={13} />
          {busyDelete ? 'Deleting…' : `Delete ${count}`}
        </button>
      </div>
    </div>
  );

  return createPortal(bar, document.body);
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-subtle bg-bg-subtle text-left">
              {['', '', 'Product', 'SKU', 'Category', 'Price', 'Stock', 'Status', ''].map((h, i) => (
                <th key={i} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-t border-line-subtle animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
                <td className="px-4 py-3"><div className="h-4 w-4 rounded bg-bg-muted" /></td>
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

function PaginationBar({
  page, hasMore, total, totalPages, pageSize, onPage, onPageSize,
}: {
  page: number;
  hasMore: boolean;
  /** Total matching the current filters, from the API — not the page length. */
  total: number;
  totalPages: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  // Always rendered when there are results: the page-size control has to stay
  // reachable even when everything fits on one page.
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last  = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle bg-bg-subtle px-5 py-3">
      <p className="text-xs text-ink-3">
        <span className="font-semibold text-ink-2">{first.toLocaleString()}–{last.toLocaleString()}</span>
        {' of '}
        <span className="font-semibold text-ink-2">{total.toLocaleString()}</span>
        <span className="mx-1.5 text-ink-4">·</span>
        Page {page} of {totalPages}
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-ink-3">
          Show
          <select
            value={pageSize}
            onChange={e => onPageSize(Number(e.target.value))}
            aria-label="Products per page"
            className="h-7 rounded-md border border-line bg-white px-1.5 text-xs text-ink focus:border-brand-500 focus:outline-none"
          >
            {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

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
    </div>
  );
}

export function ProductsList({ isAdmin = false }: { isAdmin?: boolean }) {
  // ── Filter / pagination state ────────────────────────────────────────────
  const [query,    setQuery]    = useState('');
  const [category, setCategory] = useState<string>(ALL);
  const [status,   setStatus]   = useState<StatusFilter>('all');
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  // Typing shouldn't fire a request per keystroke. 300ms is long enough to
  // coalesce a burst of typing and short enough that the list feels live.
  const search = useDebounced(query.trim(), 300);

  // ── Single-delete modal ──────────────────────────────────────────────────
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);

  // ── Bulk selection ───────────────────────────────────────────────────────
  const [selected,       setSelected]       = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [busyPublish,    setBusyPublish]    = useState(false);
  const [busyDelete,     setBusyDelete]     = useState(false);

  const headerCheckRef = useRef<HTMLInputElement>(null);
  const queryClient    = useQueryClient();
  const toast          = useToast();

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: categoryData, isLoading: catsLoading } = useProductCategories();

  // Memoised because `?? []` mints a new array every render, which would make
  // every downstream useMemo that depends on it recompute each time.
  const allCategories = useMemo<CategoryDTO[]>(
    () => (categoryData ?? []) as CategoryDTO[],
    [categoryData],
  );

  // The API filters by category id; the pills carry names.
  const categoryId = useMemo(
    () => (category === ALL ? undefined : allCategories.find(c => c.name === category)?.id),
    [category, allCategories],
  );

  // Every filter goes to the server.
  //
  // These used to be applied with `.filter()` over the current page, which
  // meant searching only ever looked at the ~50 products already on screen —
  // the client's "search not filtering, but filter across all products".
  const { data, isLoading, isFetching, error, refetch } = useAdminProducts({
    page,
    limit:    pageSize,
    search:   search || undefined,
    category: categoryId ? String(categoryId) : undefined,
    status:   status === 'all' ? undefined : (status.toUpperCase() as 'ACTIVE' | 'DRAFT' | 'DISCONTINUED'),
  });

  const visible = useMemo<AdminProductRecord[]>(
    () => (data?.records ?? []) as AdminProductRecord[],
    [data],
  );
  const total      = data?.pagination.total       ?? 0;
  const totalPages = data?.pagination.total_pages ?? 1;
  const hasMore    = page < totalPages;

  const hasActiveFilters = !!search || category !== ALL || status !== 'all';

  const setFilter = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  // A filter change can leave you past the end of the new result set — e.g. on
  // page 4 of "all", then filtering to a status with one page of matches.
  if (page > totalPages && totalPages > 0) setPage(1);

  // ── Derived selection values ─────────────────────────────────────────────
  const visibleSkus       = useMemo(() => visible.map(p => p.sku), [visible]);
  const selectedOnPage    = useMemo(() => visibleSkus.filter(s => selected.has(s)), [visibleSkus, selected]);
  const allPageSelected   = visibleSkus.length > 0 && selectedOnPage.length === visibleSkus.length;
  const somePageSelected  = selectedOnPage.length > 0 && selectedOnPage.length < visibleSkus.length;

  // How many DRAFT products are currently selected (across all pages)
  const draftSelectedSkus = useMemo(
    () => visible.filter(p => selected.has(p.sku) && p.status?.toUpperCase() === 'DRAFT').map(p => p.sku),
    [visible, selected],
  );

  // The full set of selected SKUs (for bulk ops)
  const selectedSkus = useMemo(() => [...selected], [selected]);

  // ── Clear selection when page changes ───────────────────────────────────
  useEffect(() => { setSelected(new Set()); }, [page]);

  // ── Drive header checkbox indeterminate state ────────────────────────────
  useEffect(() => {
    if (!headerCheckRef.current) return;
    headerCheckRef.current.indeterminate = somePageSelected;
  }, [somePageSelected]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function toggleSelect(sku: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku); else next.add(sku);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(prev =>
      allPageSelected
        ? new Set([...prev].filter(s => !visibleSkus.includes(s)))  // deselect page
        : new Set([...prev, ...visibleSkus]),                        // select page
    );
  }

  // ── Single-product actions ────────────────────────────────────────────────

  function handleDeleted() {
    setDeleting(null);
    void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
  }

  async function handleSinglePublish(sku: string, brandName: string) {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(sku)}`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ status: 'ACTIVE' }),
        credentials: 'include',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { message?: string };
        toast.error(json.message ?? 'Could not publish product.');
        return;
      }
      toast.success(`"${brandName}" is now live.`);
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
    } catch {
      toast.error('Network error — please try again.');
    }
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────

  async function handleBulkPublish() {
    if (!draftSelectedSkus.length || busyPublish) return;
    setBusyPublish(true);
    try {
      const res  = await fetch('/api/products/bulk-actions', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ action: 'publish', skus: draftSelectedSkus }),
        credentials: 'include',
      });
      const json = await res.json() as { message?: string; data?: { published: number } };
      if (!res.ok) {
        toast.error(json.message ?? 'Bulk publish failed.');
        return;
      }
      toast.success(json.message ?? `${json.data?.published ?? draftSelectedSkus.length} product(s) published.`);
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusyPublish(false);
    }
  }

  async function handleBulkDelete() {
    const skus = selectedSkus; // capture before state changes
    if (!skus.length || busyDelete) return;
    setBusyDelete(true);
    try {
      const res  = await fetch('/api/products/bulk-actions', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ action: 'delete', skus }),
        credentials: 'include',
      });
      const json = await res.json() as { message?: string; data?: { deleted: number } };
      if (!res.ok) {
        toast.error(json.message ?? 'Bulk delete failed.');
        return;
      }
      toast.success(json.message ?? `${json.data?.deleted ?? skus.length} product(s) deleted.`);
      setSelected(new Set());
      setShowBulkDelete(false);
      void queryClient.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusyDelete(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
            {/* Filtering is server-side now, so an empty page no longer tells
                us whether the catalogue is empty — only whether anything
                matched. The active filters are what distinguishes the two. */}
            {hasActiveFilters
              ? 'Try adjusting your search or filter.'
              : 'Import products using the button above, or add one individually.'}
          </span>
        </div>
      )}

      {!isLoading && !error && visible.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-subtle bg-bg-subtle text-left">
                  {/* Select-all checkbox — admin only */}
                  {isAdmin && (
                    <th className="w-10 px-4 py-3">
                      <input
                        ref={headerCheckRef}
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all visible products"
                        className="h-4 w-4 cursor-pointer rounded border-line accent-brand-600"
                      />
                    </th>
                  )}
                  {['', 'Product', 'SKU', 'Category', 'Price', 'Stock', 'Status', ...(isAdmin ? [''] : [])].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {visible.map(p => {
                  const b      = statusBadge(p.status ?? '');
                  const low    = isLowStock(p);
                  const isSel  = selected.has(p.sku);
                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        'transition-colors hover:bg-bg-subtle/50',
                        isSel && 'bg-brand-50/40',
                      )}
                    >
                      {/* Row checkbox — admin only */}
                      {isAdmin && (
                        <td className="w-10 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => toggleSelect(p.sku)}
                            aria-label={`Select ${p.brand_name}`}
                            onClick={e => e.stopPropagation()}
                            className="h-4 w-4 cursor-pointer rounded border-line accent-brand-600"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <ImageStack images={p.images ?? []} alt={p.brand_name} />
                      </td>
                      <td className="px-4 py-3.5">
                        {/* The name is the way into the detail page. Admins get
                            the editor, reps get the read-only view — same URL.
                            Before this the only route in was the Edit item on
                            the admin-only action menu, so a rep could see a
                            product in the list and nowhere else. */}
                        <Link
                          href={`/admin/products/${encodeURIComponent(p.sku.toLowerCase())}`}
                          className="group/name block min-w-0"
                        >
                          <p className="truncate font-medium text-ink group-hover/name:text-brand-600 group-hover/name:underline">
                            {p.brand_name}
                          </p>
                          <p className="truncate text-xs text-ink-3">{p.generic_name}</p>
                          {p.product_strength && <p className="text-[10px] text-ink-4">{p.product_strength}</p>}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-ink-2">{p.sku}</td>
                      <td className="px-4 py-3.5 text-ink-2">{p.category?.name ?? '—'}</td>
                      <td className="px-4 py-3.5">
                        {/* Quick-added products carry no price yet. Flag them
                            clearly — publishing one is blocked server-side. */}
                        {Number(p.selling_price) > 0 ? (
                          <span className="num font-medium text-ink">{formatNaira(Number(p.selling_price))}</span>
                        ) : (
                          <span
                            title="No selling price set — this product cannot be published yet"
                            className="inline-flex items-center gap-1 rounded-md border border-dashed border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                          >
                            <AlertTriangle size={10} />
                            Needs price
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn('num text-sm font-medium', low ? 'text-danger' : 'text-ink')}>
                          {(p.total_stock ?? 0).toLocaleString()}
                          {low && <span className="ml-1 text-[10px] font-bold text-danger">LOW</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3.5"><Badge tone={b.tone}>{b.label}</Badge></td>
                      {/* Actions — admin only */}
                      {isAdmin && (
                        <td className="px-3 py-3.5">
                          <ActionMenu
                            sku={p.sku}
                            status={p.status ?? ''}
                            onDelete={() => setDeleting({ sku: p.sku, brandName: p.brand_name, totalStock: p.total_stock ?? 0 })}
                            onPublish={() => void handleSinglePublish(p.sku, p.brand_name)}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={page}
            hasMore={hasMore}
            total={total}
            totalPages={totalPages}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={n => { setPageSize(n); setPage(1); }}
          />
        </div>
      )}

      {/* Single-product delete confirmation */}
      {deleting && (
        <DeleteProductModal
          target={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={handleDeleted}
        />
      )}

      {/* Bulk delete confirmation */}
      {showBulkDelete && (
        <BulkDeleteModal
          count={selected.size}
          busy={busyDelete}
          onClose={() => { if (!busyDelete) setShowBulkDelete(false); }}
          onConfirm={handleBulkDelete}
        />
      )}

      {/* Floating bulk action bar — admin only */}
      {isAdmin && selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          draftCount={draftSelectedSkus.length}
          busyPublish={busyPublish}
          busyDelete={busyDelete}
          onPublish={handleBulkPublish}
          onDelete={() => setShowBulkDelete(true)}
          onClear={() => setSelected(new Set())}
        />
      )}
    </>
  );
}
