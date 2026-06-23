'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/shared/Logo';
import { Icon, type IconName, Logout } from '@/components/icons';
import { Avatar } from '@/components/ui/Primitives';
import { PORTAL_NAV } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/types';

interface PortalSidebarProps {
  session: SessionUser;
  notificationCount?: number;
}

export function PortalSidebar({ session, notificationCount = 0 }: PortalSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[var(--spacing-sidebar)] shrink-0 flex-col border-r border-line bg-white px-4 pb-4 pt-5 lg:flex">
      <div className="border-b border-line-subtle px-2 pb-5">
        <Logo />
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-0.5">
        <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          Workspace
        </div>
        {PORTAL_NAV.map((item) => {
          const active = pathname?.startsWith(item.href);
          const showBadge = item.label === 'Notifications' && notificationCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-brand-50 font-medium text-brand-700'
                  : 'text-ink-2 hover:bg-bg-subtle hover:text-ink',
              )}
            >
              <Icon name={item.icon as IconName} size={16} />
              <span>{item.label}</span>
              {showBadge && (
                <span className="ml-auto rounded-full bg-brand-500 px-1.5 py-px text-[10px] font-semibold text-white">
                  {notificationCount}
                </span>
              )}
            </Link>
          );
        })}

        <div className="flex-1" />

        <div className="mt-3 flex items-center gap-2.5 rounded-md border border-line bg-bg-subtle px-3 py-2.5">
          <Avatar name={session.full_name} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium tracking-tight text-ink">
              {session.full_name}
            </div>
            <div className="truncate text-xs text-ink-3">
              {session.email}
            </div>
          </div>
          <Link
            href="/sign-in"
            className="grid h-7 w-7 place-items-center rounded text-ink-3 hover:bg-white hover:text-ink"
            aria-label="Sign out"
          >
            <Logout size={14} />
          </Link>
        </div>
      </nav>
    </aside>
  );
}
