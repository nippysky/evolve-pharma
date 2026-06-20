'use client';

/**
 * Console · Staff (admin-only)
 * Shows verified staff (active) and unverified staff (pending email verification).
 * All data fetched client-side via TanStack Query.
 */

import { useMemo, useState } from 'react';
import { Users, Mail, Calendar, AlertTriangle } from '@/components/icons';
import { PageHead } from '@/components/shared/PageHead';
import { EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { StaffActions } from '@/components/console/StaffActions';
import { useVerifiedStaff, useUnverifiedStaff } from '@/hooks/staff/useStaff';
import { formatDate, cn } from '@/lib/utils';
import type { StaffRecord } from '@/lib/api/types';

// ---------- Tab config ------------------------------------------------------

type Tab = 'verified' | 'unverified';

// ---------- Staff table -----------------------------------------------------

function StaffTable({ records }: { records: StaffRecord[] }) {
  if (records.length === 0) {
    return (
      <EmptyState
        icon={<Users size={24} />}
        title="No staff here yet"
        description="Use the buttons above to add or import staff."
      />
    );
  }

  return (
    <TableWrap>
      <Table>
        <Thead>
          <tr>
            <Th>Name</Th>
            <Th>Contact</Th>
            <Th>Role details</Th>
            <Th>Verification</Th>
            <Th>Joined</Th>
          </tr>
        </Thead>
        <Tbody>
          {records.map((s) => {
            const isVerified = s.verification_status === 'VERIFIED';
            return (
              <Tr key={s.id}>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                      {(s.first_name[0] ?? '').toUpperCase()}
                      {(s.last_name[0] ?? '').toUpperCase()}
                    </span>
                    <div>
                      <div className="font-medium text-ink">
                        {s.first_name} {s.last_name}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-ink-4">
                        {s.employee_code}
                      </div>
                    </div>
                  </div>
                </Td>
                <Td>
                  <div className="flex items-center gap-1.5 text-sm text-ink">
                    <Mail size={12} className="shrink-0 text-ink-3" />
                    {s.email}
                  </div>
                  {s.phone && (
                    <div className="mt-0.5 text-xs text-ink-3">{s.phone}</div>
                  )}
                </Td>
                <Td>
                  {s.job_title && (
                    <div className="text-sm text-ink">{s.job_title}</div>
                  )}
                  {s.department && (
                    <div className="mt-0.5 text-xs text-ink-3">{s.department}</div>
                  )}
                  {!s.job_title && !s.department && (
                    <span className="text-xs text-ink-4">—</span>
                  )}
                </Td>
                <Td>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      isVerified
                        ? 'bg-leaf-50 text-leaf-700'
                        : 'bg-amber-50 text-amber-700',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        isVerified ? 'bg-leaf-500' : 'bg-amber-400',
                      )}
                    />
                    {isVerified ? 'Verified' : 'Pending email'}
                  </span>
                </Td>
                <Td muted>
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={11} />
                    {formatDate(s.created_at)}
                  </span>
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </TableWrap>
  );
}

// ---------- Panel with loading / error state --------------------------------

function StaffPanel({ tab }: { tab: Tab }) {
  const verifiedQuery   = useVerifiedStaff();
  const unverifiedQuery = useUnverifiedStaff();

  const { data, isLoading, isError, error, refetch } =
    tab === 'verified' ? verifiedQuery : unverifiedQuery;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <span className="ml-3 text-sm text-ink-3">Loading staff…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-danger-soft px-4 py-3 text-sm text-red-800">
        <AlertTriangle size={14} className="shrink-0" />
        <span>{(error as Error).message ?? 'Failed to load staff.'}</span>
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-auto text-xs underline underline-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  return <StaffTable records={data?.records ?? []} />;
}

// ---------- Page ------------------------------------------------------------

export default function ConsoleStaffPage() {
  const [tab, setTab] = useState<Tab>('verified');

  const verifiedQuery   = useVerifiedStaff();
  const unverifiedQuery = useUnverifiedStaff();

  const totals = useMemo(() => ({
    verified:   verifiedQuery.data?.total   ?? 0,
    unverified: unverifiedQuery.data?.total ?? 0,
  }), [verifiedQuery.data, unverifiedQuery.data]);

  return (
    <>
      <PageHead
        title="Staff"
        subtitle="Internal team members — admins, sales staff, and drivers."
        actions={<StaffActions />}
      />

      {/* Summary cards */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total staff"     value={totals.verified + totals.unverified} />
        <StatCard label="Active (verified)" value={totals.verified} />
        <StatCard label="Pending setup"   value={totals.unverified} />
      </div>

      {/* Tab bar */}
      <div className="mb-5 inline-flex rounded-md bg-bg-muted p-0.5">
        {([
          { value: 'verified' as const,   label: 'Active staff' },
          { value: 'unverified' as const, label: 'Pending verification' },
        ] as const).map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              'rounded px-3 py-1.5 text-xs font-medium transition-colors',
              tab === t.value
                ? 'bg-white text-ink shadow-sm'
                : 'text-ink-2 hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <StaffPanel tab={tab} />

      <p className="mt-4 text-xs text-ink-4">
        Pending staff have been added but haven't verified their email yet.
      </p>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        {label}
      </div>
      <div className="num mt-1 font-display text-2xl tracking-tight text-ink">
        {value}
      </div>
    </div>
  );
}
