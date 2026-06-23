'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/shared/Logo';
import { Icon, type IconName, Shield, Users as UsersIcon, Truck } from '@/components/icons';
import { CONSOLE_NAV, DRIVER_NAV } from '@/lib/constants';
import { LogoutButton } from '@/components/console/LogoutButton';
import { useUser } from '@/contexts/UserContext';
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
  const { user } = useUser();

  const RoleIcon = ROLE_ICON[session.role] ?? UsersIcon;
  const roleLabel = ROLE_LABEL[session.role] ?? session.role;

  // Use real data from auth/me; fall back to cookie values until it resolves
  const displayName = user
    ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`
    : session.full_name;
  const displayEmail = user?.email ?? session.email;

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  // Driver gets a completely different, minimal nav
  const navGroups = session.role === 'driver' ? DRIVER_NAV : CONSOLE_NAV;

  const isVisible = (item: Record<string, unknown>) => {
    if (!('roles' in item)) return true;
    const roles = item.roles as readonly string[] | undefined;
    if (!roles?.includes(session.role)) return false;
    // Admin sees everything; staff/driver see items matching their role.
    // Fine-grained permission filtering will be wired once the backend ships.
    return true;
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col bg-ink-bg px-4 pb-4 pt-5 text-white/85 lg:flex">
      <div className="border-b border-white/8 px-2 pb-4">
        <Logo monochrome />
        <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-brand-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-300">
          <RoleIcon size={11} />
          {roleLabel}
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

        {/* User card + logout */}
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/6 to-white/3">
          <div className="flex items-center gap-3 px-3 py-3">
            {/* Avatar */}
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[13px] font-bold text-white shadow-[0_0_0_2px_rgba(0,166,212,0.25)]">
              {initials}
              <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-ink-bg bg-green-400" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold tracking-[-0.01em] text-white">
                {displayName || displayEmail}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-white/45">
                {displayEmail}
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </nav>
    </aside>
  );
}
