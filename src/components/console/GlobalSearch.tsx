'use client';

/**
 * GlobalSearch — command-palette-style search for the console.
 * ⌘K (Mac) / Ctrl+K (Windows/Linux) to open.
 * Arrow keys to navigate, Enter to follow the result, Escape to dismiss.
 *
 * Live search is wired in Module 6. Until then the palette opens but
 * returns no results — the UI shell is complete and ready.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from '@/components/icons';

// ─── Component ────────────────────────────────────────────────────────────────

export function GlobalSearch() {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const inputRef          = useRef<HTMLInputElement>(null);

  const openSearch = useCallback(() => {
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 40);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close();
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
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search orders, products, customers…"
                className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-4 focus:outline-none"
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); inputRef.current?.focus(); }}
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

            {/* Results area */}
            <div className="max-h-[60vh] overflow-y-auto py-2">
              <p className="px-4 py-6 text-center text-sm text-ink-3">
                {query.trim().length < 2
                  ? 'Start typing to search…'
                  : 'Live search coming in Module 6.'}
              </p>
            </div>

            {/* Footer hint */}
            <div className="flex items-center gap-3 border-t border-line-subtle px-4 py-2 text-[10px] text-ink-4">
              <span><kbd className="font-medium">Esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
