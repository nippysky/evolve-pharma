'use client';
import {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import Image    from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, X, Box, Users, Basket } from '@/components/icons';
import { cn, formatNaira } from '@/lib/utils';

interface ProductResult {
  id:            number;
  sku:           string;
  brand_name:    string;
  generic_name:  string;
  status:        string;
  primary_image: string | null;
}

interface CustomerResult {
  id:           number;
  company_name: string | null;
  name:         string;
  email:        string;
  status:       string;
}

interface OrderResult {
  id:            number;
  order_number:  string;
  status:        string;
  total:         number;
  customer_name: string;
}

interface SearchResults {
  products:  ProductResult[];
  customers: CustomerResult[];
  orders:    OrderResult[];
}

type FlatResult =
  | { kind: 'product';  data: ProductResult  }
  | { kind: 'customer'; data: CustomerResult }
  | { kind: 'order';    data: OrderResult    };
// Lives outside the component so it persists across opens within the same session.
const clientCache = new Map<string, SearchResults>();

function useSearch(query: string) {
  const [results,  setResults]  = useState<SearchResults | null>(null);
  const [loading,  setLoading]  = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) { setResults(null); setLoading(false); return; }

    // Show stale result immediately — feels instant to the user
    const stale = clientCache.get(q);
    if (stale) setResults(stale);

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // Only show spinner if we have nothing cached to show
      if (!stale) setLoading(true);

      try {
        const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const json = await res.json() as { status: string; data: SearchResults };
        if (json.status === 'success') {
          clientCache.set(q, json.data);
          setResults(json.data);
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError' && !stale) setResults(null);
      } finally {
        setLoading(false);
      }
    }, stale ? 500 : 200); // faster first hit, relaxed refresh when stale shown

    return () => { clearTimeout(timer); abortRef.current?.abort(); };
  }, [query]);

  return { results, loading };
}

function StatusPill({ value }: { value: string }) {
  const v = value.toUpperCase();
  const cls =
    v === 'ACTIVE'   || v === 'APPROVED'  || v === 'DELIVERED' ? 'bg-green-100 text-green-700' :
    v === 'DRAFT'    || v === 'PENDING'   || v === 'CONFIRMED' ? 'bg-amber-100 text-amber-700' :
    v === 'DISCONTINUED' || v === 'CANCELLED' || v === 'REJECTED' ? 'bg-red-100 text-red-700' :
    'bg-bg-muted text-ink-3';
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', cls)}>
      {value}
    </span>
  );
}

export function GlobalSearch() {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [cursor,  setCursor]  = useState(-1);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const router    = useRouter();

  const { results, loading } = useSearch(query);

  const flat: FlatResult[] = useMemo(() => {
    if (!results) return [];
    return [
      ...results.products.map(d  => ({ kind: 'product',  data: d } as FlatResult)),
      ...results.customers.map(d => ({ kind: 'customer', data: d } as FlatResult)),
      ...results.orders.map(d    => ({ kind: 'order',    data: d } as FlatResult)),
    ];
  }, [results]);

  // Reset cursor when results change
  useEffect(() => { setCursor(-1); }, [flat.length]);

  const openSearch = useCallback(() => {
    setOpen(true);
    setQuery('');
    setCursor(-1);
    setTimeout(() => inputRef.current?.focus(), 40);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setCursor(-1);
  }, []);

  // ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) close(); else openSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close, openSearch]);

  function navigate(item: FlatResult) {
    close();
    if (item.kind === 'product')  router.push(`/admin/products/${encodeURIComponent(item.data.sku.toLowerCase())}`);
    if (item.kind === 'customer') router.push(`/admin/customers/${item.data.id}`);
    if (item.kind === 'order')    router.push(`/admin/orders/${item.data.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, flat.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    }
    if (e.key === 'Enter' && cursor >= 0 && flat[cursor]) {
      navigate(flat[cursor]);
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (cursor < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const hasResults = flat.length > 0;
  const showEmpty  = query.trim().length >= 2 && !loading && !hasResults;

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={openSearch}
        className="relative flex h-9 w-full items-center gap-2 rounded-md border border-transparent bg-bg-muted pl-9 pr-3 text-sm text-ink-3 hover:bg-bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label="Search (⌘K)"
      >
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" />
        <span>Search customers, orders, products…</span>
        <kbd className="ml-auto hidden rounded border border-line bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink-3 lg:inline">⌘K</kbd>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
          onClick={close}
        >
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" aria-hidden />

          <div
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
              <Search size={16} className="shrink-0 text-ink-3" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search orders, products, customers…"
                className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-4 focus:outline-none"
                autoComplete="off"
              />
              {loading && (
                <svg className="h-4 w-4 animate-spin text-ink-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              {query && !loading && (
                <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                  className="grid h-6 w-6 place-items-center rounded-full text-ink-3 hover:bg-bg-muted">
                  <X size={13} />
                </button>
              )}
              <button type="button" onClick={close}
                className="grid h-6 w-6 place-items-center rounded-full text-ink-3 hover:bg-bg-muted">
                <kbd className="text-[10px] font-medium">Esc</kbd>
              </button>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
              {query.trim().length < 2 && (
                <p className="px-4 py-6 text-center text-sm text-ink-3">Start typing to search…</p>
              )}

              {showEmpty && (
                <p className="px-4 py-6 text-center text-sm text-ink-3">No results for <span className="font-medium text-ink">&ldquo;{query}&rdquo;</span></p>
              )}

              {/* Products */}
              {(results?.products.length ?? 0) > 0 && (
                <section>
                  <p className="flex items-center gap-1.5 px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-ink-4">
                    <Box size={10} /> Products
                  </p>
                  {results!.products.map(p => {
                    const idx = flat.findIndex(f => f.kind === 'product' && f.data.id === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        data-idx={idx}
                        onClick={() => navigate({ kind: 'product', data: p })}
                        onMouseEnter={() => setCursor(idx)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          cursor === idx ? 'bg-bg-subtle' : 'hover:bg-bg-subtle/60',
                        )}
                      >
                        {p.primary_image ? (
                          <Image src={p.primary_image} alt={p.brand_name} width={32} height={32}
                            className="h-8 w-8 shrink-0 rounded-lg border border-line object-contain" />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-bg-muted text-[10px] text-ink-4">—</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{p.brand_name}</p>
                          <p className="truncate text-xs text-ink-3">{p.generic_name} · <span className="font-mono">{p.sku}</span></p>
                        </div>
                        <StatusPill value={p.status} />
                      </button>
                    );
                  })}
                </section>
              )}

              {/* Customers */}
              {(results?.customers.length ?? 0) > 0 && (
                <section>
                  <p className="flex items-center gap-1.5 px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-ink-4">
                    <Users size={10} /> Customers
                  </p>
                  {results!.customers.map(c => {
                    const idx = flat.findIndex(f => f.kind === 'customer' && f.data.id === c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        data-idx={idx}
                        onClick={() => navigate({ kind: 'customer', data: c })}
                        onMouseEnter={() => setCursor(idx)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          cursor === idx ? 'bg-bg-subtle' : 'hover:bg-bg-subtle/60',
                        )}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                          {(c.company_name ?? c.name).slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{c.company_name ?? c.name}</p>
                          <p className="truncate text-xs text-ink-3">{c.email}</p>
                        </div>
                        <StatusPill value={c.status} />
                      </button>
                    );
                  })}
                </section>
              )}

              {/* Orders */}
              {(results?.orders.length ?? 0) > 0 && (
                <section>
                  <p className="flex items-center gap-1.5 px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-ink-4">
                    <Basket size={10} /> Orders
                  </p>
                  {results!.orders.map(o => {
                    const idx = flat.findIndex(f => f.kind === 'order' && f.data.id === o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        data-idx={idx}
                        onClick={() => navigate({ kind: 'order', data: o })}
                        onMouseEnter={() => setCursor(idx)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          cursor === idx ? 'bg-bg-subtle' : 'hover:bg-bg-subtle/60',
                        )}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-[10px] font-bold text-purple-700">
                          ORD
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{o.order_number}</p>
                          <p className="truncate text-xs text-ink-3">{o.customer_name} · {formatNaira(o.total)}</p>
                        </div>
                        <StatusPill value={o.status} />
                      </button>
                    );
                  })}
                </section>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 border-t border-line-subtle px-4 py-2 text-[10px] text-ink-4">
              <span><kbd className="font-medium">↑↓</kbd> navigate</span>
              <span><kbd className="font-medium">↵</kbd> open</span>
              <span><kbd className="font-medium">Esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
