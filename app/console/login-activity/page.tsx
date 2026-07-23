'use client';

/**
 * Console · Login Activity
 * Real-time feed of all login events across admin, staff, and customer accounts.
 * Data: GET admin/login-history (paginated)
 */

import React, { useState, useCallback } from 'react';
import {
  Shield,
  ClipboardList,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  MapPin,
  User,
  Users,
  Mail,
} from '@/components/icons';
import { useLoginHistory } from '@/hooks/admin/useAdminLogs';
import { useToast } from '@/contexts/ToastContext';
import { cn, formatDateTime, timeAgo } from '@/lib/utils';
import type { LoginHistoryRecord, PaginationMeta } from '@/lib/api/types';

// ─── Date helpers ─────────────────────────────────────────────────────────

function parseBackendDate(raw: string): Date {
  return new Date(raw.replace(' ', 'T'));
}
function fmtDateTime(raw: string): string {
  try { return formatDateTime(raw.replace(' ', 'T')); } catch { return raw; }
}
function fmtAgo(raw: string): string {
  try { return timeAgo(raw.replace(' ', 'T')); } catch { return raw; }
}
function isRecent(raw: string, withinMs = 60 * 60 * 1000): boolean {
  try { return Date.now() - parseBackendDate(raw).getTime() < withinMs; } catch { return false; }
}

// ─── User-type pill ───────────────────────────────────────────────────────

const USER_TYPE_STYLE: Record<string, string> = {
  ADMIN:    'bg-brand-50 text-brand-700 ring-brand-200',
  STAFF:    'bg-violet-50 text-violet-700 ring-violet-200',
  CUSTOMER: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function UserTypePill({ type }: { type: string }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset uppercase tracking-wide',
      USER_TYPE_STYLE[type] ?? 'bg-slate-100 text-slate-500 ring-slate-200',
    )}>
      {type}
    </span>
  );
}

// ─── Event badge ──────────────────────────────────────────────────────────

function eventTone(event: string): 'success' | 'danger' | 'warn' {
  const e = event.toUpperCase();
  if (e.includes('FAIL') || e.includes('REJECT') || e.includes('BLOCK')) return 'danger';
  if (e.includes('WARN') || e.includes('ATTEMPT')) return 'warn';
  return 'success';
}

const EVENT_STYLES = {
  success: { dot: 'bg-leaf-500',  ping: 'bg-leaf-400',  badge: 'bg-leaf-50 text-leaf-700 ring-leaf-200',   icon: <CheckCircle size={10} /> },
  danger:  { dot: 'bg-red-500',   ping: 'bg-red-400',   badge: 'bg-red-50 text-red-700 ring-red-200',       icon: <XCircle size={10} /> },
  warn:    { dot: 'bg-amber-400', ping: 'bg-amber-300', badge: 'bg-amber-50 text-amber-700 ring-amber-200', icon: <AlertTriangle size={10} /> },
};

function EventBadge({ event }: { event: string }) {
  const tone   = eventTone(event);
  const styles = EVENT_STYLES[tone];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset', styles.badge)}>
      {styles.icon}
      {event.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Skeletons / error / empty ────────────────────────────────────────────

function FeedSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-5 py-4 animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex gap-2">
              <div className="h-4 w-20 rounded-full bg-bg-muted" />
              <div className="h-4 w-14 rounded-full bg-bg-muted" />
            </div>
            <div className="h-3 w-48 rounded bg-bg-muted" />
          </div>
          <div className="h-3 w-20 shrink-0 rounded bg-bg-muted" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-500">
        <AlertTriangle size={22} />
      </span>
      <p className="text-sm font-semibold text-ink">Failed to load login history</p>
      <p className="mt-1 text-xs text-ink-3">{message ?? 'An unexpected error occurred.'}</p>
      <button type="button" onClick={onRetry}
        className="mt-4 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
      >
        <RotateCw size={12} /> Retry
      </button>
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-bg-muted text-ink-3">
        <ClipboardList size={22} />
      </span>
      <p className="text-sm text-ink-3">No login events found.</p>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, isLoading }: {
  label: string; value: number; icon: React.ReactNode; color: string; isLoading: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', color)}>{icon}</span>
      <div>
        {isLoading
          ? <div className="h-5 w-8 animate-pulse rounded bg-bg-muted" />
          : <p className="text-lg font-bold leading-none tracking-tight text-ink">{value.toLocaleString()}</p>
        }
        <p className="mt-0.5 text-[11px] text-ink-3">{label}</p>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────

function PaginationBar({ meta, page, onPage }: { meta: PaginationMeta; page: number; onPage: (p: number) => void }) {
  if (meta.total_pages <= 1) return null;
  const { total_pages, current_page } = meta;
  const pages: (number | '…')[] = [];
  for (let p = 1; p <= total_pages; p++) {
    if (p === 1 || p === total_pages || (p >= current_page - 1 && p <= current_page + 1)) pages.push(p);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  return (
    <div className="flex items-center justify-between border-t border-line px-5 py-3">
      <p className="text-[11px] text-ink-3">
        Page <span className="font-semibold text-ink-2">{meta.current_page}</span> of{' '}
        <span className="font-semibold text-ink-2">{meta.total_pages}</span>
        <span className="mx-1.5 text-ink-4">·</span>
        <span className="font-semibold text-ink-2">{meta.total.toLocaleString()}</span> records
      </p>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-3 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-30"
        ><ChevronLeft size={13} /></button>
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} className="px-1 text-xs text-ink-3">…</span>
            : <button key={p} type="button" onClick={() => onPage(p as number)}
                className={cn('flex h-7 min-w-[28px] items-center justify-center rounded-lg px-1.5 text-xs font-medium transition',
                  page === p ? 'bg-brand-600 text-white' : 'border border-line text-ink-2 hover:border-brand-300 hover:text-brand-600')}
              >{p}</button>
        )}
        <button type="button" disabled={page >= meta.total_pages} onClick={() => onPage(page + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-3 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-30"
        ><ChevronRight size={13} /></button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function LoginActivityPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, error, refetch } = useLoginHistory(page, 15);

  const handleRefresh = useCallback(() => {
    void refetch()
      .then(() => toast.success('Login activity refreshed'))
      .catch(() => toast.error('Could not refresh'));
  }, [refetch, toast]);

  const handlePage = (p: number) => { setPage(p); };

  const records   = data?.records ?? [];
  const failures  = records.filter((r) => eventTone(r.event) === 'danger').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Login Activity</h1>
          <p className="mt-1 text-sm text-ink-3">All sign-in events across admin, staff, and customer accounts.</p>
        </div>
        <button type="button" onClick={handleRefresh} title="Refresh"
          className="rounded-lg border border-line bg-white p-2 text-ink-3 transition hover:border-brand-300 hover:text-brand-600"
        >
          <RotateCw size={14} className={isFetching && !isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total events"   value={data?.pagination.total ?? 0}                            icon={<Users size={15} />}       color="bg-brand-50 text-brand-600" isLoading={isLoading} />
        <StatCard label="Successful"     value={data ? (data.pagination.total - failures) : 0}          icon={<CheckCircle size={15} />} color="bg-leaf-50 text-leaf-700"   isLoading={isLoading} />
        <StatCard label="Failed (page)"  value={failures}                                               icon={<XCircle size={15} />}     color="bg-red-50 text-red-600"     isLoading={isLoading} />
      </div>

      {/* Feed */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {isLoading && <FeedSkeleton />}
        {error && !isLoading && <ErrorState message={(error as Error).message} onRetry={handleRefresh} />}
        {!isLoading && !error && records.length === 0 && <EmptyFeed />}

        {!isLoading && !error && records.length > 0 && (
          <div className="divide-y divide-line">
            {records.map((r: LoginHistoryRecord) => {
              const tone    = eventTone(r.event);
              const styles  = EVENT_STYLES[tone];
              const recent  = isRecent(r.created_at);
              const location = [r.city, r.country].filter(Boolean).join(', ');
              return (
                <div key={r.id} className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-bg-subtle/50">
                  {/* Dot */}
                  <div className="relative mt-1 shrink-0">
                    {recent && <span className={cn('absolute -inset-1 rounded-full animate-ping opacity-50', styles.ping)} />}
                    <span className={cn('relative grid h-8 w-8 place-items-center rounded-full text-white', styles.dot)}>
                      <Shield size={13} />
                    </span>
                  </div>

                  {/* Detail */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EventBadge event={r.event} />
                      <UserTypePill type={r.user_type} />
                      {r.user_name && <span className="text-xs font-medium text-ink">{r.user_name}</span>}
                      {r.email && (
                        <span className="flex items-center gap-0.5 text-[11px] text-ink-3">
                          <Mail size={10} /> {r.email}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-ink-3">
                      <span className="flex items-center gap-1 font-mono">
                        <span className="text-ink-4">IP</span>
                        <span className="text-ink-2">{r.ip_address}</span>
                      </span>
                      {location && <span className="flex items-center gap-1"><MapPin size={10} /> {location}</span>}
                      {r.device_name && r.device_name !== 'Unknown Device' && (
                        <span className="flex items-center gap-1"><User size={10} /> {r.device_name}</span>
                      )}
                      {r.browser && r.browser !== 'Unknown' && (
                        <span>{r.browser}{r.operating_system && r.operating_system !== 'Unknown' ? ` · ${r.operating_system}` : ''}</span>
                      )}
                    </div>
                  </div>

                  {/* Time */}
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-medium text-ink-2">{fmtAgo(r.created_at)}</p>
                    <p className="mt-0.5 text-[10px] text-ink-4">{fmtDateTime(r.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {data?.pagination && <PaginationBar meta={data.pagination} page={page} onPage={handlePage} />}
      </div>
    </div>
  );
}
