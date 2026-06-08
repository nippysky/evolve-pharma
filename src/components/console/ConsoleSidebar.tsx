'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/shared/Logo';
import { Icon, type IconName, Logout, Shield, Users as UsersIcon, Truck } from '@/components/icons';
import { CONSOLE_NAV, DRIVER_NAV } from '@/lib/constants';
import { signOutAction } from '@/lib/actions/role';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/types';

interface ConsoleSidebarProps {
  session: SessionUser;
}

const ROLE_LABEL: Record<string, string> = {
  admin:       'Admin',
  sales_agent: 'Staff',
  driver:      'Driver',
};

const ROLE_ICON: Record<string, typeof Shield> = {
  admin:       Shield,
  sales_agent: UsersIcon,
  driver:      Truck,
};

export function ConsoleSidebar({ session }: ConsoleSidebarProps) {
  const pathname = usePathname();
  const RoleIcon = ROLE_ICON[session.role] ?? UsersIcon;
  const roleLabel = ROLE_LABEL[session.role] ?? session.role;
  const initials = session.full_name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  // Driver gets a completely different, minimal nav
  const navGroups = session.role === 'driver' ? DRIVER_NAV : CONSOLE_NAV;

  const isVisible = (item: Record<string, unknown>) => {
    // Driver nav items have no role/permission gate — always visible in driver nav
    if (!('roles' in item)) return true;
    const roles = item.roles as readonly string[] | undefined;
    if (!roles?.includes(session.role)) return false;
    // If item needs a permission, check it (admin bypasses)
    const permission = item.permission as string | undefined;
    if (permission && session.role !== 'admin') {
      return session.permissions?.includes(permission as never) ?? false;
    }
    return true;
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col bg-ink-bg px-4 pb-4 pt-5 text-white/85 lg:flex">
      <div className="border-b border-white/8 px-2 pb-4">
        <Logo monochrome />
        <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-brand-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-300">
          <RoleIcon size={11} />
          {roleLabel}
          {session.permission_preset && (
            <span className="text-brand-400/70">· {session.permission_preset.replace('_', ' ')}</span>
          )}
        </span>
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-0.5">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((it) => isVisible(it));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.section}>
              <div className="mt-3 px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                {group.section}
              </div>
              {visibleItems.map((item) => {
                const active = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-brand-500/16 font-medium text-brand-300'
                        : 'text-white/70 hover:bg-white/4 hover:text-white',
                    )}
                  >
                    <Icon name={item.icon as IconName} size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}

        <div className="flex-1" />

        <div className="mt-3 flex items-center gap-2.5 rounded-md border border-white/8 bg-white/3 px-3 py-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-500/20 text-xs font-semibold text-brand-300">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium tracking-tight text-white">
              {session.full_name}
            </div>
            <div className="truncate text-xs text-white/50">{session.email}</div>
          </div>
          <form action={signOutAction} className="contents">
            <button
              type="submit"
              className="grid h-7 w-7 place-items-center rounded text-white/55 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Sign out"
            >
              <Logout size={14} />
            </button>
          </form>
        </div>
      </nav>
    </aside>
  );
}
