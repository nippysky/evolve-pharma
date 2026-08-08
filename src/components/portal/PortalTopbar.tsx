'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, ShoppingCart, Menu, X } from '@/components/icons';
import { Logo } from '@/components/shared/Logo';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { Icon, type IconName } from '@/components/icons';
import { useBasket } from '@/lib/hooks/useBasket';
import { PORTAL_NAV } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function PortalTopbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const items = useBasket((s) => s.items);

  useEffect(() => { setMounted(true); }, []);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const itemCount = mounted ? items.reduce((acc, i) => acc + i.quantity, 0) : 0;

  // Real-time search: push URL 300ms after typing stops
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!value.trim()) {
        if (pathname?.startsWith('/portal/catalog')) {
          router.replace('/portal/catalog', { scroll: false });
        }
        return;
      }
      router.replace(`/portal/catalog?q=${encodeURIComponent(value.trim())}`, { scroll: false });
    }, 300);
  }, [router, pathname]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/portal/catalog?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <>
      {/* ── Main topbar ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line-subtle bg-white/95 px-safe backdrop-blur-md">

        {/* Mobile: hamburger */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line bg-white text-ink transition-colors hover:bg-bg-subtle lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>

        {/* Mobile: logo */}
        <div className="flex flex-1 justify-center lg:hidden">
          <Logo variant="mark" />
        </div>

        {/* Desktop: search bar */}
        <form
          onSubmit={onSubmit}
          role="search"
          className="relative hidden flex-1 lg:block lg:max-w-lg"
        >
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <input
            type="search"
            placeholder="Search catalogue by name, generic, SKU…"
            aria-label="Search catalogue"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className={cn(
              'h-10 w-full rounded-full border bg-bg-muted pl-9 pr-9 text-sm text-ink',
              'placeholder:text-ink-3',
              'transition-all duration-200',
              'focus:border-teal-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(45,212,191,0.15)] focus:outline-none',
              query ? 'border-teal-400/60 bg-white' : 'border-transparent',
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </form>

        {/* Spacer */}
        <div className="hidden flex-1 lg:block" />

        {/* Notifications */}
        <NotificationBell href="/portal/notifications" />

        {/* Cart — far right */}
        <Link
          href="/portal/basket"
          aria-label={`Basket${itemCount > 0 ? ` — ${itemCount} item${itemCount !== 1 ? 's' : ''}` : ''}`}
          className={cn(
            'relative flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200',
            itemCount > 0
              ? 'bg-[#042a36] text-white shadow-md hover:opacity-90'
              : 'border border-line bg-white text-ink-2 hover:border-teal-400 hover:text-[#042a36]',
          )}
        >
          <ShoppingCart size={16} />
          <span className="hidden sm:inline">Basket</span>
          {itemCount > 0 && (
            <span className="grid min-w-[20px] place-items-center rounded-full bg-teal-400 px-1 py-px text-[10px] font-bold text-[#042a36]">
              {itemCount > 99 ? '99+' : itemCount}
            </span>
          )}
        </Link>
      </div>

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(280px,80vw)] flex-col bg-[#042a36] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Logo monochrome />
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Mobile search */}
            <form onSubmit={onSubmit} role="search" className="mb-4">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="search"
                  placeholder="Search catalogue…"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="h-10 w-full rounded-md border border-white/15 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/35 focus:border-teal-400 focus:bg-white/15 focus:outline-none"
                />
              </div>
            </form>

            <nav className="flex flex-col gap-0.5">
              {PORTAL_NAV.map((item) => {
                const active = !!pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors',
                      active
                        ? 'bg-teal-400/15 font-medium text-teal-300'
                        : 'text-white/65 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <Icon name={item.icon as IconName} size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <Link
                href="/portal/basket"
                className="mt-1 flex items-center justify-between rounded-md px-3 py-2.5 text-sm text-white/65 hover:bg-white/5 hover:text-white"
              >
                <span className="flex items-center gap-2.5">
                  <ShoppingCart size={16} />
                  Basket
                </span>
                {itemCount > 0 && (
                  <span className="rounded-full bg-teal-400 px-2 py-0.5 text-[10px] font-bold text-[#042a36]">
                    {itemCount}
                  </span>
                )}
              </Link>
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
