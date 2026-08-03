'use client';

/**
 * Console · Audit Trail
 *
 * Complete, filterable log of every action performed across the platform.
 * Filters: user type, action keyword, entity type, actor search, date range.
 */

import React, { useState, useCallback, useTransition } from 'react';
import {
  Shield, ClipboardList, CheckCircle, XCircle, AlertTriangle,
  RotateCw, ChevronLeft, ChevronRight, User, Upload, Plus,
  Lock, Building, Clock, Search, Filter,
} from '@/components/icons';
import { useAuditLogs } from '@/hooks/admin/useAdminLogs';
import type { AuditLogFilters } from '@/lib/api/services/admin.service';
import { useToast } from '@/contexts/ToastContext';
import { cn, formatDateTime, timeAgo } from '@/lib/utils';
import type { AuditLogRecord, PaginationMeta } from '@/lib/api/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(raw: string) {
  try { return formatDateTime(raw.replace(' ', 'T')); } catch { return raw; }
}
function fmtAgo(raw: string) {
  try { return timeAgo(raw.replace(' ', 'T')); } catch { return raw; }
}
function shortAgent(ua: string): string {
  if (!ua || ua.length < 4) return '—';
  if (ua.startsWith('PostmanRuntime')) return 'Postman';
  if (ua.startsWith('Mozilla'))        return 'Browser';
  return ua.split('/')[0] ?? ua.slice(0, 20);
}

// ─── Action meta ──────────────────────────────────────────────────────────────

interface ActionMeta {
  icon: React.ReactNode; iconBg: string; iconColor: string;
  badgeBg: string; badgeText: string; badgeRing: string; label: string;
}

function getActionMeta(action: string): ActionMeta {
  const a = action.toUpperCase();
  if (a.includes('REJECT') || a.includes('FAIL') || a.includes('DELETE') || a.includes('BLOCK'))
    return { icon: <XCircle size={14} />, iconBg: 'bg-red-100', iconColor: 'text-red-600',
      badgeBg: 'bg-red-50', badgeText: 'text-red-700', badgeRing: 'ring-red-200', label: action.replace(/_/g, ' ') };
  if (a.includes('APPROVE') || a.includes('VERIF'))
    return { icon: <CheckCircle size={14} />, iconBg: 'bg-leaf-100', iconColor: 'text-leaf-700',
      badgeBg: 'bg-leaf-50', badgeText: 'text-leaf-700', badgeRing: 'ring-leaf-200', label: action.replace(/_/g, ' ') };
  if (a.includes('LOGIN') || a.includes('LOGOUT'))
    return { icon: <Shield size={14} />, iconBg: 'bg-brand-100', iconColor: 'text-brand-700',
      badgeBg: 'bg-brand-50', badgeText: 'text-brand-700', badgeRing: 'ring-brand-200', label: action.replace(/_/g, ' ') };
  if (a.includes('CREATE') || a.includes('REGISTER') || a.includes('ONBOARD'))
    return { icon: <Plus size={14} />, iconBg: 'bg-teal-100', iconColor: 'text-teal-700',
      badgeBg: 'bg-teal-50', badgeText: 'text-teal-700', badgeRing: 'ring-teal-200', label: action.replace(/_/g, ' ') };
  if (a.includes('UPLOAD') || a.includes('BULK') || a.includes('IMPORT') || a.includes('PCN'))
    return { icon: <Upload size={14} />, iconBg: 'bg-violet-100', iconColor: 'text-violet-700',
      badgeBg: 'bg-violet-50', badgeText: 'text-violet-700', badgeRing: 'ring-violet-200', label: action.replace(/_/g, ' ') };
  if (a.includes('PASSWORD') || a.includes('RESET'))
    return { icon: <Lock size={14} />, iconBg: 'bg-amber-100', iconColor: 'text-amber-700',
      badgeBg: 'bg-amber-50', badgeText: 'text-amber-700', badgeRing: 'ring-amber-200', label: action.replace(/_/g, ' ') };
  if (a.includes('UPDATE') || a.includes('EDIT') || a.includes('ASSIGN'))
    return { icon: <Building size={14} />, iconBg: 'bg-sky-100', iconColor: 'text-sky-700',
      badgeBg: 'bg-sky-50', badgeText: 'text-sky-700', badgeRing: 'ring-sky-200', label: action.replace(/_/g, ' ') };
  return { icon: <ClipboardList size={14} />, iconBg: 'bg-slate-100', iconColor: 'text-slate-500',
    badgeBg: 'bg-slate-50', badgeText: 'text-slate-600', badgeRing: 'ring-slate-200', label: action.replace(/_/g, ' ') };
}

// ─── Pills ────────────────────────────────────────────────────────────────────

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

function ActionBadge({ action }: { action: string }) {
  const m = getActionMeta(action);
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
      m.badgeBg, m.badgeText, m.badgeRing)}>
      {m.label}
    </span>
  );
}

// ─── Skeleton / states ────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-5 py-4 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex gap-2"><div className="h-4 w-28 rounded-full bg-bg-muted" /><div className="h-4 w-16 rounded-full bg-bg-muted" /></div>
            <div className="h-3 w-72 rounded bg-bg-muted" />
            <div className="h-3 w-44 rounded bg-bg-muted" />
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
      <p className="text-sm font-semibold text-ink">Failed to load audit trail</p>
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
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-bg-muted text-ink-3"><ClipboardList size={22} /></span>
      <p className="text-sm font-medium text-ink-2">No audit records found</p>
      <p className="mt-1 text-xs text-ink-4">Try adjusting your filters.</p>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

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

// ─── Pagination ───────────────────────────────────────────────────────────────

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

// ─── Filter bar ───────────────────────────────────────────────────────────────

const USER_TYPES   = ['ADMIN', 'STAFF', 'CUSTOMER', 'DRIVER'] as const;
const ENTITY_TYPES = ['Product', 'Customer', 'Order', 'Staff', 'Driver', 'Delivery', 'User'] as const;

interface Filters {
  search:      string;
  user_type:   string;
  entity_type: string;
  from:        string;
  to:          string;
}

const BLANK: Filters = { search: '', user_type: '', entity_type: '', from: '', to: '' };

function FilterBar({
  value, onChange, onReset, activeCount,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  onReset: () => void;
  activeCount: number;
}) {
  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...value, [key]: e.target.value });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-3">
      {/* Search */}
      <div className="relative min-w-[200px] flex-1">
        <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
        <input
          type="search"
          placeholder="Search actor or email…"
          value={value.search}
          onChange={set('search')}
          className="h-8 w-full rounded-lg border border-line bg-bg-subtle pl-8 pr-3 text-xs text-ink placeholder:text-ink-4 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {/* User type */}
      <select
        value={value.user_type}
        onChange={set('user_type')}
        className="h-8 rounded-lg border border-line bg-bg-subtle px-2 text-xs text-ink focus:border-brand-400 focus:outline-none"
      >
        <option value="">All roles</option>
        {USER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      {/* Entity type */}
      <select
        value={value.entity_type}
        onChange={set('entity_type')}
        className="h-8 rounded-lg border border-line bg-bg-subtle px-2 text-xs text-ink focus:border-brand-400 focus:outline-none"
      >
        <option value="">All entities</option>
        {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      {/* Date range */}
      <div className="flex items-center gap-1">
        <input type="date" value={value.from} onChange={set('from')}
          className="h-8 rounded-lg border border-line bg-bg-subtle px-2 text-xs text-ink focus:border-brand-400 focus:outline-none" />
        <span className="text-xs text-ink-4">–</span>
        <input type="date" value={value.to} onChange={set('to')}
          className="h-8 rounded-lg border border-line bg-bg-subtle px-2 text-xs text-ink focus:border-brand-400 focus:outline-none" />
      </div>

      {/* Clear */}
      {activeCount > 0 && (
        <button type="button" onClick={onReset}
          className="flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-medium text-ink-2 hover:bg-bg-subtle transition-colors">
          <Filter size={11} /> Clear {activeCount}
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const toast  = useToast();
  const [page, setPage]       = useState(1);
  const [filters, setFilters] = useState<Filters>(BLANK);
  const [, startTransition]   = useTransition();

  // Derive API filters (omit empty strings)
  const apiFilters: AuditLogFilters = {
    ...(filters.search      ? { search:      filters.search      } : {}),
    ...(filters.user_type   ? { user_type:   filters.user_type   } : {}),
    ...(filters.entity_type ? { entity_type: filters.entity_type } : {}),
    ...(filters.from        ? { from:        filters.from        } : {}),
    ...(filters.to          ? { to:          filters.to          } : {}),
  };

  const activeFilterCount = Object.values(apiFilters).filter(Boolean).length;

  const { data, isLoading, isFetching, error, refetch } = useAuditLogs(page, 20, apiFilters);

  const handleRefresh = useCallback(() => {
    void refetch()
      .then(() => toast.success('Audit trail refreshed'))
      .catch(() => toast.error('Could not refresh audit trail'));
  }, [refetch, toast]);

  const handleFiltersChange = (f: Filters) => {
    startTransition(() => {
      setFilters(f);
      setPage(1); // reset to first page on filter change
    });
  };

  const records = data?.records ?? [];

  // Derived stats from total (not just current page)
  const totalAdmin    = records.filter((r: AuditLogRecord) => r.user_type === 'ADMIN').length;
  const totalStaff    = records.filter((r: AuditLogRecord) => r.user_type === 'STAFF').length;
  const totalCustomer = records.filter((r: AuditLogRecord) => r.user_type === 'CUSTOMER').length;

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Audit Trail</h1>
          <p className="mt-1 text-sm text-ink-3">Complete log of every action performed across the platform.</p>
        </div>
        <button type="button" onClick={handleRefresh} title="Refresh"
          className="rounded-lg border border-line bg-white p-2 text-ink-3 transition hover:border-brand-300 hover:text-brand-600">
          <RotateCw size={14} className={isFetching && !isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Total entries"    value={data?.pagination.total ?? 0} icon={<ClipboardList size={15} />} color="bg-brand-50 text-brand-600"   isLoading={isLoading} />
        <StatCard label="Admin actions"    value={totalAdmin}                   icon={<Shield size={15} />}       color="bg-violet-50 text-violet-700" isLoading={isLoading} />
        <StatCard label="Staff actions"    value={totalStaff}                   icon={<User size={15} />}         color="bg-teal-50 text-teal-700"     isLoading={isLoading} />
        <StatCard label="Customer actions" value={totalCustomer}                icon={<User size={15} />}         color="bg-slate-100 text-slate-500"  isLoading={isLoading} />
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <FilterBar
        value={filters}
        onChange={handleFiltersChange}
        onReset={() => handleFiltersChange(BLANK)}
        activeCount={activeFilterCount}
      />

      {/* ── Feed ───────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white">

        {isLoading && <FeedSkeleton />}
        {error && !isLoading && <ErrorState message={(error as Error).message} onRetry={handleRefresh} />}
        {!isLoading && !error && records.length === 0 && <EmptyFeed />}

        {!isLoading && !error && records.length > 0 && (
          <div className="divide-y divide-line">
            {records.map((r: AuditLogRecord) => {
              const meta     = getActionMeta(r.action);
              const actor    = r.user_name && r.user_name !== 'SYSTEM' ? r.user_name : r.email ?? null;
              const isSystem = !actor || r.user_name === 'SYSTEM';

              return (
                <div key={r.id} className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-bg-subtle/50">

                  {/* Action icon */}
                  <div className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full', meta.iconBg, meta.iconColor)}>
                    {meta.icon}
                  </div>

                  {/* Detail */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ActionBadge action={r.action} />
                      {r.entity_type && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-subtle px-2 py-0.5 text-[10px] font-medium text-ink-2">
                          {r.entity_type}
                          {r.entity_id && <span className="font-mono text-ink-4">#{r.entity_id}</span>}
                        </span>
                      )}
                      <UserTypePill type={r.user_type} />
                    </div>

                    {r.description && (
                      <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{r.description}</p>
                    )}

                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-ink-3">
                      {isSystem ? (
                        <span className="flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          ⚙ SYSTEM
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <User size={10} />
                          <span className="font-medium text-ink-2">{actor}</span>
                          {r.email && actor !== r.email && (
                            <span className="text-ink-4">({r.email})</span>
                          )}
                        </span>
                      )}
                      {r.ip_address && (
                        <span className="flex items-center gap-1 font-mono">
                          <span className="text-ink-4">IP</span>
                          <span className="text-ink-2">{r.ip_address}</span>
                        </span>
                      )}
                      {r.user_agent && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> {shortAgent(r.user_agent)}
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
