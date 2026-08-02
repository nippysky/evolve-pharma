'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bell, Menu, X, Logout } from '@/components/icons';
import { Logo } from '@/components/shared/Logo';
import { GlobalSearch } from '@/components/console/GlobalSearch';
import { Icon, type IconName } from '@/components/icons';
import { CONSOLE_NAV, DRIVER_NAV } from '@/lib/constants';
import { signOutAction } from '@/lib/actions/role';
import type { Role } from '@/types';

interface ConsoleTopbarProps {
  notificationCount?: number;
  role: Role;
}

const ROLE_LABEL: Record<Role, string> = {
  ADMIN:    'Admin',
  STAFF:    'Staff',
  DRIVER:   'Driver',
  CUSTOMER: 'Customer',
};

export function ConsoleTopbar({ notificationCount = 0, role }: ConsoleTopbarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navGroups = role === 'DRIVER' ? DRIVER_NAV : CONSOLE_NAV;

  const isItemVisible = (item: Record<string, unknown>): boolean => {
    if (!('roles' in item)) return true;
    const roles = item.roles as readonly string[];
    return roles.includes(role);
  };

  const isDriver = role === 'DRIVER';

  return (
    <>
      <div className="glass sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line-subtle px-safe">
        {/* Mobile hamburger */}
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

        {/* Desktop search — hidden for drivers */}
        {!isDriver && (
          <div className="hidden flex-1 lg:block lg:max-w-md">
            <GlobalSearch />
          </div>
        )}

        {isDriver && (
          <div className="hidden flex-1 lg:block">
            <span className="text-sm font-medium text-ink-3">
              Driver portal &middot; <span className="text-ink">{ROLE_LABEL[role]}</span>
            </span>
          </div>
        )}

        <div className="flex items-center gap-1">
          {!isDriver && (
            <Link
              href="/admin/notifications"
              aria-label="Notifications"
              className="relative grid h-9 w-9 place-items-center rounded-md text-ink-2 hover:bg-bg-muted hover:text-ink"
            >
              <Bell size={18} />
              {notificationCount > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-leaf-500 ring-2 ring-white" />
              )}
            </Link>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40 animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(280px,80vw)] flex-col bg-ink-bg p-5 text-white/85 shadow-xl animate-slide-in-left">
            <div className="mb-4 flex items-center justify-between">
              <Logo monochrome />
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-md text-white/70 hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Role badge */}
            <span className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-300">
              {ROLE_LABEL[role] ?? role}
            </span>

            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
              {navGroups.map((group) => {
                const visibleItems = group.items.filter((it) => isItemVisible(it as Record<string, unknown>));
                if (visibleItems.length === 0) return null;
                return (
                  <div key={group.section}>
                    <div className="mt-3 px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      {group.section}
                    </div>
                    {visibleItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setDrawerOpen(false)}
                        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/4 hover:text-white"
                      >
                        <Icon name={item.icon as IconName} size={16} />
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                );
              })}
            </nav>

            <form action={signOutAction} className="mt-3 border-t border-white/8 pt-3">
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/4 hover:text-white"
              >
                <Logout size={16} />
                <span>Sign out</span>
              </button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
