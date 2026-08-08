'use client';

/**
 * Notifications list — shared by the portal and the admin console.
 *
 * Reads /api/notifications, which is already scoped to the signed-in user, so
 * the same component serves customers, staff and admins without any role
 * branching. Clicking an unread notification marks it read and follows its link.
 */

import { useState, useMemo } from 'react';
import { useRouter }         from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Box, CreditCard, Truck, Shield, Star, InfoCircle,
  CheckCircle, RotateCw, ChevronLeft, ChevronRight,
} from '@/components/icons';
import { EmptyState } from '@/components/ui/Primitives';
import { cn }         from '@/lib/utils';

interface NotificationRecord {
  id:         number;
  title:      string;
  body:       string;
  type:       string;
  link:       string | null;
  is_read:    boolean;
  created_at: string;
}

interface ApiResponse {
  status: string;
  data: {
    records:      NotificationRecord[];
    pagination:   { current_page: number; per_page: number; total: number; total_pages: number };
    unread_count: number;
  };
}

/** Query key shared with the unread badge so both refresh together. */
export const NOTIFICATION_KEYS = {
  list:   (page: number, unread: boolean) => ['notifications', page, unread] as const,
  unread: ['notifications', 'unread-count'] as const,
};

const TYPE_META: Record<string, { Icon: typeof Bell; ring: string; bg: string; fg: string }> = {
  order:    { Icon: Box,        ring: 'ring-blue-200',    bg: 'bg-blue-50',    fg: 'text-blue-600'    },
  payment:  { Icon: CreditCard, ring: 'ring-emerald-200', bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  delivery: { Icon: Truck,      ring: 'ring-teal-200',    bg: 'bg-teal-50',    fg: 'text-teal-600'    },
  account:  { Icon: Shield,     ring: 'ring-violet-200',  bg: 'bg-violet-50',  fg: 'text-violet-600'  },
  referral: { Icon: Star,       ring: 'ring-amber-200',   bg: 'bg-amber-50',   fg: 'text-amber-600'   },
  system:   { Icon: InfoCircle, ring: 'ring-slate-200',   bg: 'bg-slate-50',   fg: 'text-slate-600'   },
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60)     return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60)     return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24)    return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7)      return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function NotificationsList() {
  const router = useRouter();
  const qc     = useQueryClient();

  const [page,       setPage]       = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<ApiResponse>({
    queryKey: NOTIFICATION_KEYS.list(page, unreadOnly),
    queryFn:  () =>
      fetch(`/api/notifications?page=${page}&limit=20${unreadOnly ? '&unread=true' : ''}`,
        { credentials: 'include' }).then(r => r.json()),
    staleTime: 15_000,
  });

  const markRead = useMutation({
    mutationFn: async (ids?: number[]) => {
      const res = await fetch('/api/notifications', {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify(ids?.length ? { ids } : {}),
      });
      return res.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const records     = useMemo(() => data?.data?.records ?? [], [data]);
  const pagination  = data?.data?.pagination;
  const unreadCount = data?.data?.unread_count ?? 0;

  function handleOpen(n: NotificationRecord) {
    if (!n.is_read) markRead.mutate([n.id]);
    if (n.link) router.push(n.link);
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-bg-muted" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white py-14">
        <Bell size={22} className="text-ink-4" />
        <p className="text-sm text-ink-3">Could not load notifications.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-bg-subtle"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex rounded-lg bg-bg-muted p-1">
          {([false, true] as const).map(v => (
            <button
              key={String(v)}
              type="button"
              onClick={() => { setUnreadOnly(v); setPage(1); }}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                unreadOnly === v ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
              )}
            >
              {v ? 'Unread' : 'All'}
              {v && unreadCount > 0 && (
                <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-teal-700">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void refetch()}
          title="Refresh"
          className="rounded-lg border border-line bg-white p-2 text-ink-3 transition-colors hover:border-brand-300 hover:text-brand-600"
        >
          <RotateCw size={14} className={cn(isFetching && 'animate-spin')} />
        </button>

        <div className="flex-1" />

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markRead.mutate(undefined)}
            disabled={markRead.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:border-teal-300 hover:text-teal-700 disabled:opacity-50"
          >
            <CheckCircle size={12} />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      {records.length === 0 ? (
        <EmptyState
          icon={<Bell size={24} />}
          title={unreadOnly ? 'Nothing unread' : 'No notifications yet'}
          description={
            unreadOnly
              ? "You're all caught up."
              : "Updates about your orders, payments and account will appear here."
          }
        />
      ) : (
        <div className="space-y-2">
          {records.map(n => {
            const meta = TYPE_META[n.type] ?? TYPE_META.system!;
            const { Icon } = meta;
            const clickable = !!n.link;
            return (
              <div
                key={n.id}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => handleOpen(n) : undefined}
                onKeyDown={clickable ? (e) => { if (e.key === 'Enter') handleOpen(n); } : undefined}
                className={cn(
                  'flex items-start gap-3.5 rounded-xl border px-4 py-3.5 transition-colors',
                  n.is_read
                    ? 'border-line bg-white'
                    : 'border-teal-200 bg-teal-50/40',
                  clickable && 'cursor-pointer hover:border-teal-300 hover:bg-teal-50/60',
                )}
              >
                <span className={cn(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1',
                  meta.bg, meta.ring, meta.fg,
                )}>
                  <Icon size={15} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className={cn(
                      'text-sm leading-snug',
                      n.is_read ? 'font-medium text-ink-2' : 'font-semibold text-ink',
                    )}>
                      {n.title}
                    </p>
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-ink-4">
                      {relativeTime(n.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{n.body}</p>
                </div>

                {!n.is_read && (
                  <span
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal-500"
                    aria-label="Unread"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between border-t border-line-subtle pt-4">
          <p className="text-xs text-ink-3">
            Page {pagination.current_page} of {pagination.total_pages} · {pagination.total} total
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="rounded-lg border border-line bg-white p-1.5 text-ink-3 transition-colors hover:text-ink disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              disabled={page >= pagination.total_pages}
              onClick={() => setPage(p => p + 1)}
              className="rounded-lg border border-line bg-white p-1.5 text-ink-3 transition-colors hover:text-ink disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
