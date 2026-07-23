'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/shared/Logo';
import { Icon, type IconName } from '@/components/icons';
import { PORTAL_NAV } from '@/lib/constants';
import { signOutAction } from '@/lib/actions/role';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/types';

interface PortalSidebarProps {
  session: SessionUser;
}

/* ── Demo fallback — used when session cookie has no user data ─────────── */
const DEMO_FALLBACK = {
  full_name: 'Adaeze Nwosu',
  email:     'adaeze.nwosu@greenleafpharmacy.ng',
};

export function PortalSidebar({ session }: PortalSidebarProps) {
  const pathname = usePathname();

  const displayName  = session.full_name  || DEMO_FALLBACK.full_name;
  const displayEmail = session.email      || DEMO_FALLBACK.email;

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');

  return (
    <aside className="sticky top-0 hidden h-dvh w-[var(--spacing-sidebar)] shrink-0 flex-col pt-0 text-white/85 lg:flex bg-[#042a36]">

      {/* Top accent strip */}
      <div className="h-1 w-full shrink-0 rounded-b-full bg-gradient-to-r from-teal-400 to-cyan-400 opacity-90" />

      {/* Logo + badge */}
      <div className="border-b border-white/8 px-6 pb-4 pt-4">
        <Logo monochrome />
        <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-teal-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-300">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
          Customer Portal
        </span>
      </div>

      {/* Navigation */}
      <nav className="mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto px-4">
        <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
          Workspace
        </div>
        {PORTAL_NAV.map((item) => {
          const active = !!pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
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

        <div className="flex-1" />

        {/* User card */}
        <div className="mt-3 overflow-hidden rounded-xl border border-teal-400/15 bg-gradient-to-b from-white/6 to-white/3">
          <div className="flex items-center gap-3 px-3 py-3">
            {/* Avatar */}
            <span
              className={cn(
                'relative grid h-9 w-9 shrink-0 place-items-center rounded-full',
                'bg-gradient-to-br from-teal-400 to-cyan-500 text-[13px] font-bold text-white',
                'shadow-[0_0_0_2px_rgba(45,212,191,0.30)]',
              )}
            >
              {initials}
              <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-[#042a36] bg-emerald-400" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold tracking-[-0.01em] text-white">
                {displayName}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-white/45">
                {displayEmail}
              </div>
            </div>

            {/* Sign out */}
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Sign out"
                className="grid h-7 w-7 place-items-center rounded text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <path d="M6 8h7M11 6l2 2-2 2M5 5V3a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </nav>
    </aside>
  );
}
