'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, Basket, Menu, X } from '@/components/icons';
import { Logo } from '@/components/shared/Logo';
import { Icon, type IconName } from '@/components/icons';
import { useBasket } from '@/lib/hooks/useBasket';
import { PORTAL_NAV } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface PortalTopbarProps {
  notificationCount?: number;
}

export function PortalTopbar({ notificationCount = 0 }: PortalTopbarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const items = useBasket((s) => s.items);

  useEffect(() => setMounted(true), []);
  const itemCount = mounted ? items.reduce((acc, i) => acc + i.quantity, 0) : 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/portal/catalog?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <>
      <div className="glass sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line-subtle px-safe">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-md border border-line bg-white text-ink lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>

        <div className="flex flex-1 justify-center lg:hidden">
          <Logo variant="mark" />
        </div>

        <form onSubmit={onSubmit} role="search" className="relative hidden flex-1 lg:block lg:max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            placeholder="Search catalog…"
            aria-label="Search catalog"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-transparent bg-bg-muted pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand-500 focus:bg-white focus:outline-none"
          />
        </form>

        <div className="flex items-center gap-1">
          <Link
            href="/portal/notifications"
            aria-label="Notifications"
            className="relative grid h-9 w-9 place-items-center rounded-md text-ink-2 hover:bg-bg-muted hover:text-ink"
          >
            <Bell size={18} />
            {notificationCount > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-leaf-500 ring-2 ring-white" />
            )}
          </Link>
          <Link
            href="/portal/basket"
            aria-label="Basket"
            className="relative grid h-9 w-9 place-items-center rounded-md text-ink-2 hover:bg-bg-muted hover:text-ink"
          >
            <Basket size={18} />
            {itemCount > 0 && (
              <span className="num absolute -right-0.5 -top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40 animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(280px,80vw)] flex-col bg-white p-5 shadow-xl animate-slide-in-left">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-md text-ink-3 hover:bg-bg-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-col gap-0.5">
              {PORTAL_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-ink hover:bg-bg-subtle"
                >
                  <Icon name={item.icon as IconName} size={16} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
