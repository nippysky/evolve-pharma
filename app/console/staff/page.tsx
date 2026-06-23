'use client';

/**
 * Console · Staff management
 * Unified view — verified (active) and unverified (pending email setup).
 * Consistent design language with the Customers page.
 */

import React, { useMemo, useState, useRef } from 'react';
import {
  Users,
  User,
  Mail,
  CheckCircle,
  Clock,
  Search,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Building,
  FileText,
} from '@/components/icons';
import { PageHead }   from '@/components/shared/PageHead';
import { Avatar }     from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { StaffActions } from '@/components/console/StaffActions';
import {
  useAllStaff,
  type StaffStatus,
  type TaggedStaffRecord,
} from '@/hooks/staff/useStaff';
import { formatDate, cn } from '@/lib/utils';

// ---------- Constants -------------------------------------------------------

const PAGE_SIZE = 15;

// ---------- Filter config ---------------------------------------------------

type StaffFilter = StaffStatus | 'all';

interface FilterConfig {
  label: string;
  shortDesc: string;
  icon: React.ReactNode;
  cardBorder: string;
  cardBg: string;
  cardText: string;
  badgeClass: string;
  attention?: boolean;
}

const FILTER_CONFIG: Record<StaffFilter, FilterConfig> = {
  all: {
    label: 'All staff',
    shortDesc: 'Everyone on the team',
    icon: <Users size={15} />,
    cardBorder: 'border-brand-500',
    cardBg: 'bg-brand-50',
    cardText: 'text-brand-700',
    badgeClass: '',
  },
  VERIFIED: {
    label: 'Verified',
    shortDesc: 'Email confirmed, account active',
    icon: <CheckCircle size={15} />,
    cardBorder: 'border-leaf-500',
    cardBg: 'bg-leaf-50',
    cardText: 'text-leaf-700',
    badgeClass: 'bg-leaf-50 text-leaf-700 ring-leaf-200',
  },
  UNVERIFIED: {
    label: 'Pending setup',
    shortDesc: 'Invited, email not verified yet',
    icon: <Clock size={15} />,
    cardBorder: 'border-amber-400',
    cardBg: 'bg-amber-50',
    cardText: 'text-amber-700',
    badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200',
    attention: true,
  },
};

const FILTER_ORDER: StaffFilter[] = ['all', 'VERIFIED', 'UNVERIFIED'];

// ---------- Status badge (in table) ----------------------------------------

function StatusBadge({ status }: { status: StaffStatus }) {
  const cfg = FILTER_CONFIG[status];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
      cfg.badgeClass,
    )}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ---------- Filter card -----------------------------------------------------

function FilterCard({
  filter,
  count,
  isLoading,
  isActive,
  onClick,
}: {
  filter: StaffFilter;
  count: number;
  isLoading: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  const cfg            = FILTER_CONFIG[filter];
  const showAttention  = !!(cfg.attention && count > 0);

  if (isLoading) {
    return (
      <div className="flex min-w-[10rem] flex-1 flex-shrink-0 flex-col rounded-2xl border border-line bg-white p-4 animate-pulse">
        <div className="mb-3 h-4 w-4 rounded bg-bg-muted" />
        <div className="h-7 w-12 rounded-md bg-bg-muted" />
        <div className="mt-2 h-3 w-16 rounded bg-bg-muted" />
        <div className="mt-1 h-2.5 w-24 rounded bg-bg-muted" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={cfg.shortDesc}
      className={cn(
        'group flex min-w-[10rem] flex-1 flex-col rounded-2xl border p-4 text-left transition-all duration-200',
        isActive
          ? cn(cfg.cardBorder, cfg.cardBg, 'shadow-md ring-1 ring-inset', cfg.cardBorder.replace('border-', 'ring-'))
          : 'border-line bg-white hover:border-brand-200 hover:bg-bg-subtle hover:shadow-sm',
        showAttention && !isActive && 'border-amber-200 bg-amber-50/40',
      )}
    >
      {/* Icon + attention */}
      <div className="mb-2 flex items-center justify-between">
        <span className={cn('transition-colors', isActive ? cfg.cardText : 'text-ink-3 group-hover:text-ink-2')}>
          {cfg.icon}
        </span>
        {showAttention && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
        )}
      </div>

      {/* Count */}
      <p className={cn('text-2xl font-bold leading-none tracking-tight', isActive ? cfg.cardText : 'text-ink')}>
        {count}
      </p>

      {/* Label */}
      <p className={cn('mt-1.5 text-xs font-semibold', isActive ? cfg.cardText : 'text-ink-2')}>
        {cfg.label}
      </p>

      {/* Desc */}
      <p className={cn('mt-0.5 text-[11px] leading-tight', isActive ? cn(cfg.cardText, 'opacity-60') : 'text-ink-4')}>
        {cfg.shortDesc}
      </p>
    </button>
  );
}

// ---------- Table skeleton --------------------------------------------------

function TableSkeleton() {
  return (
    <div className="rounded-2xl border border-line overflow-hidden">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0 animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-9 w-9 flex-shrink-0 rounded-full bg-bg-muted" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-bg-muted" />
            <div className="h-3 w-20 rounded bg-bg-muted" />
          </div>
          <div className="hidden sm:block space-y-1.5 w-44">
            <div className="h-3.5 w-full rounded bg-bg-muted" />
            <div className="h-3 w-20 rounded bg-bg-muted" />
          </div>
          <div className="hidden md:block space-y-1.5 w-32">
            <div className="h-3.5 w-full rounded bg-bg-muted" />
            <div className="h-3 w-16 rounded bg-bg-muted" />
          </div>
          <div className="h-6 w-24 rounded-full bg-bg-muted" />
          <div className="h-3 w-16 rounded bg-bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ---------- Pagination ------------------------------------------------------

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  return (
    <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
      <p className="text-xs text-ink-3">{from}–{to} of {total}</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md p-1.5 text-ink-2 hover:bg-bg-muted disabled:opacity-40 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let p: number;
          if (totalPages <= 7) {
            p = i + 1;
          } else if (page <= 4) {
            p = i < 6 ? i + 1 : totalPages;
          } else if (page >= totalPages - 3) {
            p = i === 0 ? 1 : totalPages - 6 + i;
          } else {
            const pages = [1, page - 2, page - 1, page, page + 1, page + 2, totalPages];
            p = pages[i] ?? page;
          }
          return (
            <button
              key={`${i}-${p}`}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                'h-7 min-w-[28px] rounded-md px-2 text-xs font-medium transition-colors',
                page === p ? 'bg-brand-600 text-white' : 'text-ink-2 hover:bg-bg-muted',
              )}
            >
              {p}
            </button>
          );
        })}
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md p-1.5 text-ink-2 hover:bg-bg-muted disabled:opacity-40 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ---------- Staff table -----------------------------------------------------

function StaffTable({
  records,
  isLoading,
  activeFilter,
  query,
}: {
  records: TaggedStaffRecord[];
  isLoading: boolean;
  activeFilter: StaffFilter;
  query: string;
}) {
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let list = activeFilter === 'all'
      ? records
      : records.filter((r) => r._status === activeFilter);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.employee_code ?? '').toLowerCase().includes(q) ||
          (r.department ?? '').toLowerCase().includes(q) ||
          (r.job_title ?? '').toLowerCase().includes(q) ||
          (r.phone ?? '').includes(q),
      );
    }
    return list;
  }, [records, activeFilter, query]);

  // Reset page when filter or search changes
  const prevFilterRef = useRef(activeFilter);
  const prevQueryRef  = useRef(query);
  if (prevFilterRef.current !== activeFilter || prevQueryRef.current !== query) {
    prevFilterRef.current = activeFilter;
    prevQueryRef.current  = query;
    if (page !== 1) setPage(1);
  }

  if (isLoading) return <TableSkeleton />;

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-white py-20 text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-bg-muted text-ink-3">
          {query ? <Search size={24} /> : FILTER_CONFIG[activeFilter].icon}
        </span>
        <p className="text-base font-semibold tracking-tight text-ink">
          {query
            ? 'No staff match'
            : activeFilter === 'all'
            ? 'No staff yet'
            : `No ${FILTER_CONFIG[activeFilter].label.toLowerCase()} staff`}
        </p>
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-3">
          {query
            ? 'Try a different name, email, or employee code.'
            : activeFilter === 'all'
            ? 'Add individual staff or use bulk import to get started.'
            : FILTER_CONFIG[activeFilter].shortDesc + '.'}
        </p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <TableWrap>
        <Table>
          <Thead>
            <tr>
              <Th>Employee</Th>
              <Th>Contact</Th>
              <Th>Department / Role</Th>
              <Th>Status</Th>
              <Th>Joined</Th>
            </tr>
          </Thead>
          <Tbody>
            {paginated.map((s) => (
              <Tr key={`${s._status}-${s.id}`}>
                {/* Employee */}
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      name={`${s.first_name} ${s.last_name}`}
                      size={36}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">
                        {s.first_name} {s.last_name}
                      </div>
                      {s.employee_code && (
                        <div className="mt-0.5 font-mono text-[11px] text-ink-4">
                          {s.employee_code}
                        </div>
                      )}
                    </div>
                  </div>
                </Td>

                {/* Contact */}
                <Td>
                  <div className="flex items-center gap-1.5 text-sm text-ink">
                    <Mail size={12} className="shrink-0 text-ink-3" />
                    <span className="truncate">{s.email}</span>
                  </div>
                  {s.phone && (
                    <div className="mt-0.5 pl-[1.125rem] text-xs text-ink-3">{s.phone}</div>
                  )}
                </Td>

                {/* Dept / Role */}
                <Td>
                  {s.job_title ? (
                    <div className="flex items-center gap-1.5 text-sm text-ink">
                      <FileText size={12} className="shrink-0 text-ink-3" />
                      {s.job_title}
                    </div>
                  ) : null}
                  {s.department ? (
                    <div className={cn('flex items-center gap-1.5 text-xs text-ink-3', s.job_title && 'mt-0.5 pl-[1.125rem]')}>
                      {!s.job_title && <Building size={12} className="shrink-0 text-ink-3" />}
                      {s.department}
                    </div>
                  ) : null}
                  {!s.job_title && !s.department && (
                    <span className="text-xs text-ink-4">—</span>
                  )}
                </Td>

                {/* Status */}
                <Td>
                  <StatusBadge status={s._status} />
                  {s._status === 'VERIFIED' && s.email_verified_at && (
                    <p className="mt-1 text-[11px] text-ink-4">
                      Verified {formatDate(s.email_verified_at)}
                    </p>
                  )}
                </Td>

                {/* Joined */}
                <Td muted>{formatDate(s.created_at)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableWrap>

      <Pagination
        page={safePage}
        totalPages={totalPages}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </>
  );
}

// ---------- Page ------------------------------------------------------------

export default function ConsoleStaffPage() {
  const [activeFilter, setActiveFilter] = useState<StaffFilter>('all');
  const [query,        setQuery]        = useState('');

  const { allRecords, counts, isLoading, errors, refetchAll } = useAllStaff();

  const totalCounts: Record<StaffFilter, number> = {
    all:        allRecords.length,
    VERIFIED:   counts.VERIFIED,
    UNVERIFIED: counts.UNVERIFIED,
  };

  const handleFilter = (f: StaffFilter) => {
    setActiveFilter(f);
    setQuery('');
  };

  const unverifiedCount = counts.UNVERIFIED;
  const hasErrors       = errors.length > 0;

  return (
    <>
      {/* ── Page header ── */}
      <PageHead
        title="Staff"
        subtitle="Internal team members — admins, sales staff, and drivers."
        actions={<StaffActions />}
      />

      {/* ── Filter cards ── */}
      <div className="mb-6 flex items-stretch gap-3">
        {FILTER_ORDER.map((f) => (
          <FilterCard
            key={f}
            filter={f}
            count={totalCounts[f] ?? 0}
            isLoading={isLoading}
            isActive={activeFilter === f}
            onClick={() => handleFilter(f)}
          />
        ))}
      </div>

      {/* ── Search + meta bar ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              activeFilter === 'all'
                ? 'Search across all staff…'
                : `Search ${FILTER_CONFIG[activeFilter].label.toLowerCase()}…`
            }
            aria-label="Search staff"
            className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
          />
        </div>

        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Clear
          </button>
        )}

        <button
          type="button"
          onClick={refetchAll}
          title="Refresh"
          className="rounded-lg border border-line bg-white p-2 text-ink-3 transition-colors hover:border-brand-300 hover:text-brand-600"
        >
          <RotateCw size={14} />
        </button>

        {!isLoading && (
          <p className="text-xs text-ink-3 whitespace-nowrap">
            {totalCounts[activeFilter] ?? 0} staff member{(totalCounts[activeFilter] ?? 0) !== 1 ? 's' : ''}
            {activeFilter !== 'all' && ` · ${FILTER_CONFIG[activeFilter].label}`}
          </p>
        )}
      </div>

      {/* ── Pending-setup nudge ── */}
      {unverifiedCount > 0 && activeFilter !== 'UNVERIFIED' && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
          <p className="flex-1 text-sm text-amber-800">
            <span className="font-semibold">
              {unverifiedCount} staff member{unverifiedCount !== 1 ? 's' : ''}
            </span>{' '}
            {unverifiedCount === 1 ? 'has' : 'have'} not yet verified{' '}
            {unverifiedCount === 1 ? 'their' : 'their'} email and set up{' '}
            {unverifiedCount === 1 ? 'a' : ''} password.
          </p>
          <button
            type="button"
            onClick={() => handleFilter('UNVERIFIED')}
            className="text-xs font-semibold text-amber-700 hover:underline"
          >
            View pending →
          </button>
        </div>
      )}

      {/* ── Error state ── */}
      {hasErrors && !isLoading && allRecords.length === 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-red-800">Could not load staff</p>
              <p className="mt-1 text-xs text-red-700">
                {errors[0]?.message ?? 'An unknown error occurred.'}
              </p>
            </div>
            <button
              type="button"
              onClick={refetchAll}
              className="shrink-0 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Staff table ── */}
      <StaffTable
        records={allRecords}
        isLoading={isLoading}
        activeFilter={activeFilter}
        query={query}
      />
    </>
  );
}
