'use client';

/**
 * GlobalSearch — real-time command-palette-style search for the console.
 * Searches across products, orders, and customers from dummy-console data.
 * ⌘K (Mac) / Ctrl+K (Windows/Linux) to open.
 * Arrow keys to navigate, Enter to follow the result, Escape to dismiss.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Box, Building, Pill } from '@/components/icons';
import { Badge } from '@/components/ui/Primitives';
import { cn } from '@/lib/utils';
import { DUMMY_PRODUCTS } from '@/lib/data/dummy-products';
import { DUMMY_CONSOLE_ORDERS, DUMMY_CUSTOMERS } from '@/lib/data/dummy-console';

// ─── Result types ─────────────────────────────────────────────────────────

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand' | 'accent';
type ResultGroup = 'Orders' | 'Products' | 'Customers';

interface SearchResult {
  id: string;
  group: ResultGroup;
  label: string;
  sublabel: string;
  href: string;
  badge?: { label: string; tone: BadgeTone };
}

// ─── Build index once (module-level for perf) ─────────────────────────────

const ALL_RESULTS: SearchResult[] = [
  ...DUMMY_CONSOLE_ORDERS.map((o) => ({
    id: `order-${o.id}`,
    group: 'Orders' as const,
    label: o.order_number,
    sublabel: `${o.customer_company ?? o.customer_name} · ₦${o.total_amount.toLocaleString()}`,
    href: '/console/orders',
    badge: { label: o.status, tone: orderTone(o.status) },
  })),
  ...DUMMY_PRODUCTS.map((p) => ({
    id: `product-${p.id}`,
    group: 'Products' as const,
    label: p.name,
    sublabel: `${p.sku} · ${p.manufacturer}`,
    href: '/console/products',
    badge: { label: p.category, tone: 'neutral' as BadgeTone },
  })),
  ...DUMMY_CUSTOMERS.map((c) => ({
    id: `customer-${c.id}`,
    group: 'Customers' as const,
    label: c.company_name,
    sublabel: `${c.user.fname} ${c.user.lname} · ${c.user.email}`,
    href: '/console/customers',
    badge: c.pcn_verified
      ? { label: 'Verified', tone: 'success' as BadgeTone }
      : { label: 'Unverified', tone: 'warning' as BadgeTone },
  })),
];

function orderTone(status: string): BadgeTone {
  const map: Record<string, BadgeTone> = {
    pending:    'warning',
    processing: 'info',
    dispatched: 'brand',
    delivered:  'success',
    cancelled:  'danger',
  };
  return map[status] ?? 'neutral';
}

const GROUP_ICON: Record<ResultGroup, React.ReactNode> = {
  Orders:    <Box size={12} />,
  Products:  <Pill size={12} />,
  Customers: <Building size={12} />,
};

// ─── Component ────────────────────────────────────────────────────────────

export function GlobalSearch() {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const [active, setActive]   = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const router    = useRouter();

  // Filter
  const results = query.trim().length < 2
    ? []
    : ALL_RESULTS.filter((r) => {
        const q = query.toLowerCase();
        return (
          r.label.toLowerCase().includes(q) ||
          r.sublabel.toLowerCase().includes(q)
        );
      }).slice(0, 12);

  // Group results
  const grouped = results.reduce<Record<ResultGroup, SearchResult[]>>(
    (acc, r) => { (acc[r.group] ??= []).push(r); return acc; },
    {} as Record<ResultGroup, SearchResult[]>,
  );

  const flat = Object.values(grouped).flat();

  const openSearch = useCallback(() => {
    setOpen(true);
    setQuery('');
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 40);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  const goTo = useCallback((href: string) => {
    close();
    router.push(href);
  }, [close, router]);

  // ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        open ? close() : openSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close, openSearch]);

  // Arrow navigation + Enter + Escape
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && flat[active]) {
      goTo(flat[active]!.href);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const flatIdx = (group: ResultGroup, idx: number) => {
    let offset = 0;
    for (const g of Object.keys(grouped) as ResultGroup[]) {
      if (g === group) return offset + idx;
      offset += grouped[g]!.length;
    }
    return offset + idx;
  };

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={openSearch}
        className="relative flex h-9 w-full items-center gap-2 rounded-md border border-transparent bg-bg-muted pl-9 pr-3 text-sm text-ink-3 hover:bg-bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label="Search (⌘K)"
      >
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" />
        <span>Search customers, orders, products…</span>
        <kbd className="ml-auto hidden rounded border border-line bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink-3 lg:inline">
          ⌘K
        </kbd>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
          onClick={close}
        >
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm animate-fade-in" aria-hidden />

          {/* Panel */}
          <div
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-white shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
              <Search size={16} className="shrink-0 text-ink-3" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                placeholder="Search orders, products, customers…"
                className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-4 focus:outline-none"
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setActive(0); inputRef.current?.focus(); }}
                  className="grid h-6 w-6 place-items-center rounded-full text-ink-3 hover:bg-bg-muted hover:text-ink"
                  aria-label="Clear"
                >
                  <X size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={close}
                className="grid h-6 w-6 place-items-center rounded-full text-ink-3 hover:bg-bg-muted hover:text-ink"
                aria-label="Close"
              >
                <kbd className="text-[10px] font-medium">Esc</kbd>
              </button>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
              {query.trim().length < 2 && (
                <p className="px-4 py-6 text-center text-sm text-ink-3">
                  Start typing to search…
                </p>
              )}

              {query.trim().length >= 2 && flat.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-ink-3">
                  No results for <strong className="text-ink">&ldquo;{query}&rdquo;</strong>
                </p>
              )}

              {(Object.entries(grouped) as [ResultGroup, SearchResult[]][]).map(([group, items]) => (
                <div key={group}>
                  {/* Group header */}
                  <div className="flex items-center gap-1.5 px-4 pb-1 pt-3">
                    <span className="text-ink-3">{GROUP_ICON[group]}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                      {group}
                    </span>
                  </div>

                  {items.map((r, idx) => {
                    const gi = flatIdx(group, idx);
                    const isActive = gi === active;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        data-active={isActive}
                        onClick={() => goTo(r.href)}
                        onMouseEnter={() => setActive(gi)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          isActive ? 'bg-brand-50' : 'hover:bg-bg-subtle',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink">{r.label}</div>
                          <div className="truncate text-xs text-ink-3">{r.sublabel}</div>
                        </div>
                        {r.badge && (
                          <Badge tone={r.badge.tone} noDot className="shrink-0">
                            {r.badge.label}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer hint */}
            {flat.length > 0 && (
              <div className="flex items-center gap-3 border-t border-line-subtle px-4 py-2 text-[10px] text-ink-4">
                <span><kbd className="font-medium">↑↓</kbd> navigate</span>
                <span><kbd className="font-medium">↵</kbd> open</span>
                <span><kbd className="font-medium">Esc</kbd> close</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
