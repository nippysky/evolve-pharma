import React, { useState, useCallback, useTransition } from 'react';
import {
  Shield, ClipboardList, CheckCircle, XCircle, AlertTriangle,
  RotateCw, ChevronLeft, ChevronRight, MapPin, User, Users, Mail,
  Logout, Search, Filter,
} from '@/components/icons';
import { useLoginHistory } from '@/hooks/admin/useAdminLogs';
import type { LoginHistoryFilters } from '@/lib/api/services/admin.service';
import { useToast } from '@/contexts/ToastContext';
import { cn, formatDateTime, timeAgo } from '@/lib/utils';
import type { LoginHistoryRecord, PaginationMeta } from '@/lib/api/types';

function fmtDateTime(raw: string) {
  try { return formatDateTime(raw.replace(' ', 'T')); } catch { return raw; }
}
function fmtAgo(raw: string) {
  try { return timeAgo(raw.replace(' ', 'T')); } catch { return raw; }
}
function isRecent(raw: string, ms = 60 * 60_000): boolean {
  try { return Date.now() - new Date(raw.replace(' ', 'T')).getTime() < ms; } catch { return false; }
}

function eventTone(event: string): 'success' | 'danger' | 'warn' | 'neutral' {
  const e = event.toUpperCase();
  if (e === 'LOGIN_FAILED')    return 'danger';
  if (e === 'LOGOUT')          return 'neutral';
  if (e === 'TOKEN_REFRESHED') return 'warn';
  return 'success';
}

const TONE_STYLES = {
  success: {
    dot: 'bg-leaf-500', ping: 'bg-leaf-400',
    badge: 'bg-leaf-50 text-leaf-700 ring-leaf-200',
    icon: <CheckCircle size={10} />,
  },
  danger: {
    dot: 'bg-red-500',  ping: 'bg-red-400',
    badge: 'bg-red-50 text-red-700 ring-red-200',
    icon: <XCircle size={10} />,
  },
  warn: {
    dot: 'bg-amber-400', ping: 'bg-amber-300',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    icon: <AlertTriangle size={10} />,
  },
  neutral: {
    dot: 'bg-slate-400', ping: 'bg-slate-300',
    badge: 'bg-slate-100 text-slate-600 ring-slate-200',
    icon: <Logout size={10} />,
  },
} as const;

function EventBadge({ event }: { event: string }) {
  const s = TONE_STYLES[eventTone(event)];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset', s.badge)}>
      {s.icon} {event.replace(/_/g, ' ')}
    </span>
  );
}

const USER_TYPE_STYLE: Record<string, string> = {
  ADMIN:    'bg-brand-50 text-brand-700 ring-brand-200',
  STAFF:    'bg-violet-50 text-violet-700 ring-violet-200',
  CUSTOMER: 'bg-slate-100 text-slate-600 ring-slate-200',
  DRIVER:   'bg-teal-50 text-teal-700 ring-teal-200',
};

function UserTypePill({ type }: { type: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset uppercase tracking-wide',
      USER_TYPE_STYLE[type] ?? 'bg-slate-100 text-slate-500 ring-slate-200')}>
      {type}
    </span>
  );
}

function FeedSkeleton() {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-5 py-4 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="mt-1 h-8 w-8 shrink-0 rounded-full bg-bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex gap-2"><div className="h-4 w-24 rounded-full bg-bg-muted" /><div className="h-4 w-14 rounded-full bg-bg-muted" /></div>
            <div className="h-3 w-52 rounded bg-bg-muted" />
          </div>
          <div className="h-3 w-20 shrink-0 rounded bg-bg-muted" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-500"><AlertTriangle size={22} /></span>
      <p className="text-sm font-semibold text-ink">Failed to load login history</p>
      <p className="mt-1 text-xs text-ink-3">{message ?? 'An unexpected error occurred.'}</p>
      <button type="button" onClick={onRetry}
        className="mt-4 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors">
        <RotateCw size={12} /> Retry
      </button>
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-bg-muted text-ink-3"><Shield size={22} /></span>
      <p className="text-sm font-medium text-ink-2">No login events found</p>
      <p className="mt-1 text-xs text-ink-4">Try adjusting your filters.</p>
    </div>
  );
}

function StatCard({ label, value, icon, color, isLoading }: {
  label: string; value: number; icon: React.ReactNode; color: string; isLoading: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', color)}>{icon}</span>
      <div>
        {isLoading
          ? <div className="h-5 w-10 animate-pulse rounded bg-bg-muted" />
          : <p className="text-lg font-bold leading-none tracking-tight text-ink">{value.toLocaleString()}</p>}
        <p className="mt-0.5 text-[11px] text-ink-3">{label}</p>
      </div>
    </div>
  );
}

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
        Page <span className="font-semibold text-ink-2">{current_page}</span> of{' '}
        <span className="font-semibold text-ink-2">{total_pages}</span>
        <span className="mx-1.5 text-ink-4">·</span>
        <span className="font-semibold text-ink-2">{meta.total.toLocaleString()}</span> records
      </p>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-3 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-30">
          <ChevronLeft size={13} />
        </button>
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} className="px-1 text-xs text-ink-3">…</span>
            : <button key={p} type="button" onClick={() => onPage(p as number)}
                className={cn('flex h-7 min-w-[28px] items-center justify-center rounded-lg px-1.5 text-xs font-medium transition',
                  page === p ? 'bg-brand-600 text-white' : 'border border-line text-ink-2 hover:border-brand-300 hover:text-brand-600')}>
                {p}
              </button>
        )}
        <button type="button" disabled={page >= meta.total_pages} onClick={() => onPage(page + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-3 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-30">
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

const USER_TYPES  = ['ADMIN', 'STAFF', 'CUSTOMER', 'DRIVER'] as const;
const LOGIN_EVENTS = ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'TOKEN_REFRESHED'] as const;

interface Filters {
  search:    string;
  user_type: string;
  event:     string;
  from:      string;
  to:        string;
}

const BLANK: Filters = { search: '', user_type: '', event: '', from: '', to: '' };

function FilterBar({ value, onChange, onReset, activeCount }: {
  value: Filters; onChange: (f: Filters) => void; onReset: () => void; activeCount: number;
}) {
  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...value, [key]: e.target.value });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-3">
      {/* Search */}
      <div className="relative min-w-[200px] flex-1">
        <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
        <input type="search" placeholder="Search name or email…"
          value={value.search} onChange={set('search')}
          className="h-8 w-full rounded-lg border border-line bg-bg-subtle pl-8 pr-3 text-xs text-ink placeholder:text-ink-4 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100" />
      </div>

      {/* Role */}
      <select value={value.user_type} onChange={set('user_type')}
        className="h-8 rounded-lg border border-line bg-bg-subtle px-2 text-xs text-ink focus:border-brand-400 focus:outline-none">
        <option value="">All roles</option>
        {USER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      {/* Event */}
      <select value={value.event} onChange={set('event')}
        className="h-8 rounded-lg border border-line bg-bg-subtle px-2 text-xs text-ink focus:border-brand-400 focus:outline-none">
        <option value="">All events</option>
        {LOGIN_EVENTS.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
      </select>

      {/* Date range */}
      <div className="flex items-center gap-1">
        <input type="date" value={value.from} onChange={set('from')}
          className="h-8 rounded-lg border border-line bg-bg-subtle px-2 text-xs text-ink focus:border-brand-400 focus:outline-none" />
        <span className="text-xs text-ink-4">–</span>
        <input type="date" value={value.to} onChange={set('to')}
          className="h-8 rounded-lg border border-line bg-bg-subtle px-2 text-xs text-ink focus:border-brand-400 focus:outline-none" />
      </div>

      {activeCount > 0 && (
        <button type="button" onClick={onReset}
          className="flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-medium text-ink-2 hover:bg-bg-subtle transition-colors">
          <Filter size={11} /> Clear {activeCount}
        </button>
      )}
    </div>
  );
}

export default function LoginActivityPage() {
  const toast  = useToast();
  const [page, setPage]       = useState(1);
  const [filters, setFilters] = useState<Filters>(BLANK);
  const [, startTransition]   = useTransition();

  const apiFilters: LoginHistoryFilters = {
    ...(filters.search    ? { search:    filters.search    } : {}),
    ...(filters.user_type ? { user_type: filters.user_type } : {}),
    ...(filters.event     ? { event:     filters.event     } : {}),
    ...(filters.from      ? { from:      filters.from      } : {}),
    ...(filters.to        ? { to:        filters.to        } : {}),
  };

  const activeFilterCount = Object.values(apiFilters).filter(Boolean).length;

  const { data, isLoading, isFetching, error, refetch } = useLoginHistory(page, 20, apiFilters);

  const handleRefresh = useCallback(() => {
    void refetch()
      .then(() => toast.success('Login activity refreshed'))
      .catch(() => toast.error('Could not refresh'));
  }, [refetch, toast]);

  const handleFiltersChange = (f: Filters) => {
    startTransition(() => { setFilters(f); setPage(1); });
  };

  const records  = data?.records ?? [];
  const failures = records.filter((r: LoginHistoryRecord) => eventTone(r.event) === 'danger').length;
  const logouts  = records.filter((r: LoginHistoryRecord) => r.event === 'LOGOUT').length;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Login Activity</h1>
          <p className="mt-1 text-sm text-ink-3">All sign-in events across admin, staff, and customer accounts.</p>
        </div>
        <button type="button" onClick={handleRefresh} title="Refresh"
          className="rounded-lg border border-line bg-white p-2 text-ink-3 transition hover:border-brand-300 hover:text-brand-600">
          <RotateCw size={14} className={isFetching && !isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Total events"  value={data?.pagination.total ?? 0}           icon={<Users size={15} />}       color="bg-brand-50 text-brand-600" isLoading={isLoading} />
        <StatCard label="Successful"    value={records.length - failures - logouts}    icon={<CheckCircle size={15} />} color="bg-leaf-50 text-leaf-700"   isLoading={isLoading} />
        <StatCard label="Failed logins" value={failures}                               icon={<XCircle size={15} />}     color="bg-red-50 text-red-600"     isLoading={isLoading} />
        <StatCard label="Logouts"       value={logouts}                                icon={<Logout size={15} />}      color="bg-slate-100 text-slate-500" isLoading={isLoading} />
      </div>

      {/* Filters */}
      <FilterBar
        value={filters}
        onChange={handleFiltersChange}
        onReset={() => handleFiltersChange(BLANK)}
        activeCount={activeFilterCount}
      />

      {/* Feed */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white">

        {isLoading && <FeedSkeleton />}
        {error && !isLoading && <ErrorState message={(error as Error).message} onRetry={handleRefresh} />}
        {!isLoading && !error && records.length === 0 && <EmptyFeed />}

        {!isLoading && !error && records.length > 0 && (
          <div className="divide-y divide-line">
            {records.map((r: LoginHistoryRecord) => {
              const tone    = eventTone(r.event);
              const styles  = TONE_STYLES[tone];
              const recent  = isRecent(r.created_at);
              const location = [r.city, r.country].filter(Boolean).join(', ');

              return (
                <div key={r.id} className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-bg-subtle/50">

                  {/* Animated dot */}
                  <div className="relative mt-1 shrink-0">
                    {recent && (
                      <span className={cn('absolute -inset-1 rounded-full animate-ping opacity-40', styles.ping)} />
                    )}
                    <span className={cn('relative grid h-8 w-8 place-items-center rounded-full text-white', styles.dot)}>
                      <Shield size={13} />
                    </span>
                  </div>

                  {/* Detail */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EventBadge event={r.event} />
                      <UserTypePill type={r.user_type} />
                      {r.user_name && (
                        <span className="text-xs font-medium text-ink">{r.user_name}</span>
                      )}
                      {r.email && (
                        <span className="flex items-center gap-0.5 text-[11px] text-ink-3">
                          <Mail size={10} /> {r.email}
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-ink-3">
                      {r.ip_address && (
                        <span className="flex items-center gap-1 font-mono">
                          <span className="text-ink-4">IP</span>
                          <span className="text-ink-2">{r.ip_address}</span>
                        </span>
                      )}
                      {location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={10} /> {location}
                        </span>
                      )}
                      {r.device_name && r.device_name !== 'Unknown Device' && (
                        <span className="flex items-center gap-1">
                          <User size={10} /> {r.device_name}
                        </span>
                      )}
                      {r.browser && r.browser !== 'Unknown' && (
                        <span>
                          {r.browser}
                          {r.operating_system && r.operating_system !== 'Unknown'
                            ? ` · ${r.operating_system}`
                            : ''}
                        </span>
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

        {data?.pagination && (
          <PaginationBar meta={data.pagination} page={page} onPage={setPage} />
        )}
      </div>
    </div>
  );
}
