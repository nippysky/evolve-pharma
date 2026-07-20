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

// ── Role metadata ─────────────────────────────────────────────────────────────

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

/**
 * Per-role visual theme.
 *
 *  Admin       — slate-900  / indigo accents   (authoritative, full access)
 *  Sales agent — green-950  / emerald accents  (operational, sales-focused)
 *  Driver      — orange-950 / amber accents    (active, on-the-move)
 */
const ROLE_THEME = {
  admin: {
    sidebar:   'bg-slate-900',
    border:    'border-white/8',
    badge:     'bg-indigo-500/20 text-indigo-300',
    activeLink:'bg-indigo-500/18 text-indigo-300 font-medium',
    hoverLink: 'text-white/70 hover:bg-white/5 hover:text-white',
    section:   'text-white/38',
    avatar:    'from-indigo-400 to-indigo-600',
    avatarRing:'shadow-[0_0_0_2px_rgba(99,102,241,0.30)]',
    userCard:  'border-white/10 from-white/6 to-white/3',
    dot:       'bg-emerald-400',
    topAccent: 'bg-indigo-500',
  },
  sales_agent: {
    sidebar:   'bg-[#052e16]',          // green-950 equivalent
    border:    'border-white/8',
    badge:     'bg-emerald-500/20 text-emerald-300',
    activeLink:'bg-emerald-500/18 text-emerald-300 font-medium',
    hoverLink: 'text-white/70 hover:bg-white/5 hover:text-white',
    section:   'text-white/38',
    avatar:    'from-emerald-400 to-emerald-600',
    avatarRing:'shadow-[0_0_0_2px_rgba(52,211,153,0.30)]',
    userCard:  'border-emerald-500/15 from-white/6 to-white/3',
    dot:       'bg-emerald-400',
    topAccent: 'bg-emerald-500',
  },
  driver: {
    sidebar:   'bg-[#431407]',          // orange-950 equivalent
    border:    'border-white/8',
    badge:     'bg-amber-500/20 text-amber-300',
    activeLink:'bg-amber-500/18 text-amber-300 font-medium',
    hoverLink: 'text-white/70 hover:bg-white/5 hover:text-white',
    section:   'text-white/38',
    avatar:    'from-amber-400 to-orange-500',
    avatarRing:'shadow-[0_0_0_2px_rgba(251,191,36,0.30)]',
    userCard:  'border-amber-500/15 from-white/6 to-white/3',
    dot:       'bg-amber-400',
    topAccent: 'bg-amber-500',
  },
} satisfies Record<string, {
  sidebar: string; border: string; badge: string;
  activeLink: string; hoverLink: string; section: string;
  avatar: string; avatarRing: string; userCard: string;
  dot: string; topAccent: string;
}>;

const DEFAULT_THEME = ROLE_THEME.admin;

// ── Component ─────────────────────────────────────────────────────────────────

export function ConsoleSidebar({ session }: ConsoleSidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();

  const theme     = ROLE_THEME[session.role as keyof typeof ROLE_THEME] ?? DEFAULT_THEME;
  const RoleIcon  = ROLE_ICON[session.role]  ?? UsersIcon;
  const roleLabel = ROLE_LABEL[session.role] ?? session.role;

  // Real data from auth/me; fall back to cookie values until it resolves
  const displayName  = user
    ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`
    : session.full_name;
  const displayEmail = user?.email ?? session.email;

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  // Driver gets a minimal nav; all other roles get the full CONSOLE_NAV
  // filtered by their roles array.
  const navGroups = session.role === 'driver' ? DRIVER_NAV : CONSOLE_NAV;

  const isVisible = (item: Record<string, unknown>) => {
    if (!('roles' in item)) return true;
    const roles = item.roles as readonly string[] | undefined;
    return roles?.includes(session.role) ?? true;
  };

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col px-4 pb-4 pt-0 text-white/85 lg:flex',
        theme.sidebar,
      )}
    >
      {/* Top accent strip — unique colour per role */}
      <div className={cn('h-1 w-full shrink-0 rounded-b-full opacity-80', theme.topAccent)} />

      {/* Logo + role badge */}
      <div className={cn('border-b px-2 pb-4 pt-4', theme.border)}>
        <Logo monochrome />
        <span className={cn(
          'mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5',
          'text-[10px] font-semibold uppercase tracking-[0.12em]',
          theme.badge,
        )}>
          <RoleIcon size={11} />
          {roleLabel}
        </span>
      </div>

      {/* Navigation */}
      <nav className="mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((it) => isVisible(it as Record<string, unknown>));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.section}>
              <div className={cn(
                'mt-3 px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                theme.section,
              )}>
                {group.section}
              </div>
              {visibleItems.map((item) => {
                const active = !!pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                      active ? theme.activeLink : theme.hoverLink,
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

        {/* User card */}
        <div className={cn(
          'mt-3 overflow-hidden rounded-xl border bg-gradient-to-b',
          theme.userCard,
        )}>
          <div className="flex items-center gap-3 px-3 py-3">
            <span className={cn(
              'relative grid h-9 w-9 shrink-0 place-items-center rounded-full',
              'bg-gradient-to-br text-[13px] font-bold text-white',
              theme.avatar,
              theme.avatarRing,
            )}>
              {initials}
              <span className={cn(
                'absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2',
                theme.dot,
              )}
                style={{ borderColor: 'inherit' }}
              />
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
