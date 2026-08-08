'use client';

/**
 * Notification bell with a live unread count.
 *
 * Polls the notifications endpoint so a badge appears without a page refresh —
 * most notifications are produced by background events (a Paystack webhook, a
 * driver confirming delivery) that the user never triggers themselves.
 */

import Link          from 'next/link';
import { useQuery }  from '@tanstack/react-query';
import { Bell }      from '@/components/icons';
import { NOTIFICATION_KEYS } from '@/components/shared/NotificationsList';

interface UnreadResponse {
  status: string;
  data:   { unread_count: number };
}

export function NotificationBell({ href }: { href: string }) {
  const { data } = useQuery<UnreadResponse>({
    queryKey: NOTIFICATION_KEYS.unread,
    queryFn:  () =>
      fetch('/api/notifications/unread-count', { credentials: 'include' }).then(r => r.json()),
    staleTime:       30_000,
    refetchInterval: 60_000,
    // Don't keep polling for a background tab — React Query pauses interval
    // refetches when the window is blurred unless this is explicitly enabled.
    refetchIntervalInBackground: false,
    // A failed badge fetch should stay quiet rather than surface an error.
    retry: false,
  });

  const count = data?.data?.unread_count ?? 0;

  return (
    <Link
      href={href}
      aria-label={count > 0 ? `Notifications (${count} unread)` : 'Notifications'}
      className="relative grid h-9 w-9 place-items-center rounded-md text-ink-2 transition-colors hover:bg-bg-muted hover:text-ink"
    >
      <Bell size={18} />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
