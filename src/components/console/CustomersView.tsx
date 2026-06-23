'use client';

import React, { useMemo, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Search,
  Plus,
  Upload,
  Building,
  Shield,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Users,
  User,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCw,
} from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Avatar, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { PageHead } from '@/components/shared/PageHead';
import { CreateEntityModal, type EntityField } from './CreateEntityModal';
import { useToast } from '@/contexts/ToastContext';
import {
  useAllCustomers,
  useReviewCustomer,
  useBulkUploadCustomers,
  type CustomerStage,
  type TaggedCustomerRecord,
} from '@/hooks/staff/useStaff';
import { formatDate, cn } from '@/lib/utils';
import type { Role } from '@/types';
import type { CustomerAdminRecord } from '@/lib/api/types';

// ---------- Constants -------------------------------------------------------

const PAGE_SIZE = 15;

// ---------- Stage filter types & config ------------------------------------

type StageFilter = CustomerStage | 'all';

interface StageConfig {
  label: string;
  shortDesc: string;
  icon: React.ReactNode;
  // Filter card active colors
  cardBorder: string;
  cardBg: string;
  cardText: string;
  // Table badge colors
  badgeClass: string;
  // Pulsing attention dot when count > 0
  attention?: boolean;
}

const STAGE_CONFIG: Record<StageFilter, StageConfig> = {
  all: {
    label: 'All customers',
    shortDesc: 'Everyone who signed up',
    icon: <Users size={15} />,
    cardBorder: 'border-brand-500',
    cardBg: 'bg-brand-50',
    cardText: 'text-brand-700',
    badgeClass: '',
  },
  registered: {
    label: 'Registered',
    shortDesc: 'No PCN cert uploaded yet',
    icon: <User size={15} />,
    cardBorder: 'border-ink-2',
    cardBg: 'bg-bg-subtle',
    cardText: 'text-ink-2',
    badgeClass: 'bg-bg-muted text-ink-2 ring-line',
  },
  unverified: {
    label: 'Unverified',
    shortDesc: 'PCN uploaded, OTP pending',
    icon: <AlertTriangle size={15} />,
    cardBorder: 'border-amber-400',
    cardBg: 'bg-amber-50',
    cardText: 'text-amber-700',
    badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  verified: {
    label: 'Verified',
    shortDesc: 'PCN & OTP confirmed',
    icon: <CheckCircle size={15} />,
    cardBorder: 'border-blue-400',
    cardBg: 'bg-blue-50',
    cardText: 'text-blue-700',
    badgeClass: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  pending: {
    label: 'Pending review',
    shortDesc: 'Awaiting your decision',
    icon: <Clock size={15} />,
    cardBorder: 'border-orange-400',
    cardBg: 'bg-orange-50',
    cardText: 'text-orange-700',
    badgeClass: 'bg-orange-50 text-orange-700 ring-orange-200',
    attention: true,
  },
  approved: {
    label: 'Approved',
    shortDesc: 'Active pharmacy accounts',
    icon: <Shield size={15} />,
    cardBorder: 'border-leaf-500',
    cardBg: 'bg-leaf-50',
    cardText: 'text-leaf-700',
    badgeClass: 'bg-leaf-50 text-leaf-700 ring-leaf-200',
  },
  rejected: {
    label: 'Rejected',
    shortDesc: 'Applications declined',
    icon: <XCircle size={15} />,
    cardBorder: 'border-red-400',
    cardBg: 'bg-red-50',
    cardText: 'text-red-700',
    badgeClass: 'bg-red-50 text-red-700 ring-red-200',
  },
};

const STAGE_ORDER: StageFilter[] = [
  'all', 'registered', 'unverified', 'verified', 'pending', 'approved', 'rejected',
];

// ---------- Onboard form fields (admin creates customer directly) -----------

const ONBOARD_FIELDS: EntityField[] = [
  { name: 'first_name',   label: 'Contact first name',        required: true,  placeholder: 'Chinedu' },
  { name: 'middle_name',  label: 'Middle name',                                placeholder: 'Optional' },
  { name: 'last_name',    label: 'Contact last name',          required: true,  placeholder: 'Okafor' },
  { name: 'company_name', label: 'Pharmacy / company name',    required: true,  placeholder: 'Greenleaf Pharmacy Ltd.', full: true },
  { name: 'email',        label: 'Work email',  type: 'email', required: true,  placeholder: 'orders@pharmacy.ng' },
  { name: 'phone',        label: 'Phone',       type: 'tel',   required: true,  placeholder: '+234 800 000 0000' },
  { name: 'address',      label: 'Street address',             required: true,  placeholder: '12 Lagos St., Wuse 2', full: true },
  { name: 'city',         label: 'City',                       required: true,  placeholder: 'Abuja' },
  { name: 'state',        label: 'State',                      required: true,  placeholder: 'FCT' },
];

// ---------- Stage badge (table column) ------------------------------------

function StageBadge({ stage }: { stage: CustomerStage }) {
  const cfg = STAGE_CONFIG[stage];
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

// ---------- Raw status badge (review modal — maps backend string) ----------

function RawStatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === 'APPROVED')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2.5 py-0.5 text-xs font-medium text-leaf-700 ring-1 ring-inset ring-leaf-200">
        <CheckCircle size={10} /> Approved
      </span>
    );
  if (s === 'PENDING_REVIEW' || s === 'PENDING')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
        <Clock size={10} /> Pending review
      </span>
    );
  if (s === 'REJECTED')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
        <XCircle size={10} /> Rejected
      </span>
    );
  if (s === 'PCN_CERT_UPLOADED')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-200">
        <Shield size={10} /> PCN uploaded
      </span>
    );
  if (s === 'OTP_CONFIRMED' || s === 'EMAIL_VERIFIED_PASSWORD_CREATED')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
        <CheckCircle size={10} /> Verified
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-bg-muted px-2.5 py-0.5 text-xs font-medium text-ink-3 ring-1 ring-inset ring-line">
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ---------- Stage filter card -----------------------------------------------

function StageCard({
  stage,
  count,
  isLoading,
  isActive,
  onClick,
}: {
  stage: StageFilter;
  count: number;
  isLoading: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  const cfg = STAGE_CONFIG[stage];
  const showAttention = !!(cfg.attention && count > 0);

  if (isLoading) {
    return (
      <div className="flex min-w-[8.5rem] flex-shrink-0 flex-col rounded-2xl border border-line bg-white p-4 animate-pulse">
        <div className="mb-3 h-4 w-4 rounded bg-bg-muted" />
        <div className="h-7 w-10 rounded-md bg-bg-muted" />
        <div className="mt-2 h-3 w-16 rounded bg-bg-muted" />
        <div className="mt-1 h-2.5 w-20 rounded bg-bg-muted" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={cfg.shortDesc}
      className={cn(
        'group flex min-w-[8.5rem] flex-shrink-0 flex-col rounded-2xl border p-4 text-left transition-all duration-200',
        isActive
          ? cn(cfg.cardBorder, cfg.cardBg, 'shadow-md ring-1 ring-inset', cfg.cardBorder.replace('border-', 'ring-'))
          : 'border-line bg-white hover:border-brand-200 hover:bg-bg-subtle hover:shadow-sm',
        showAttention && !isActive && 'border-orange-200 bg-orange-50/40',
      )}
    >
      {/* Icon row */}
      <div className="mb-2 flex items-center justify-between">
        <span className={cn('transition-colors', isActive ? cfg.cardText : 'text-ink-3 group-hover:text-ink-2')}>
          {cfg.icon}
        </span>
        {showAttention && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
          </span>
        )}
      </div>

      {/* Count */}
      <p className={cn(
        'text-2xl font-bold leading-none tracking-tight',
        isActive ? cfg.cardText : 'text-ink',
      )}>
        {count}
      </p>

      {/* Label */}
      <p className={cn(
        'mt-1.5 text-xs font-semibold',
        isActive ? cfg.cardText : 'text-ink-2',
      )}>
        {cfg.label}
      </p>

      {/* Short desc */}
      <p className={cn(
        'mt-0.5 text-[11px] leading-tight',
        isActive ? cn(cfg.cardText, 'opacity-60') : 'text-ink-4',
      )}>
        {cfg.shortDesc}
      </p>
    </button>
  );
}

// ---------- Review modal ---------------------------------------------------

interface ReviewModalProps {
  customer: CustomerAdminRecord | null;
  /** Pre-select which decision button is active when the modal opens. */
  initialDecision?: 'APPROVE' | 'REJECTED';
  onClose: () => void;
  onSuccess: () => void;
}

function ReviewModal({ customer, initialDecision = 'APPROVE', onClose, onSuccess }: ReviewModalProps) {
  const toast     = useToast();
  const reviewMut = useReviewCustomer();
  const [decision,    setDecision]    = useState<'APPROVE' | 'REJECTED'>(initialDecision);
  const [notes,       setNotes]       = useState('');
  const [notesError,  setNotesError]  = useState('');

  if (!customer) return null;

  const displayName = [customer.first_name, customer.last_name].filter(Boolean).join(' ');

  const handleSubmit = () => {
    if (!notes.trim()) {
      setNotesError('Review notes are required for both approval and rejection.');
      return;
    }
    setNotesError('');
    reviewMut.mutate(
      { id: customer.id, decision, review_notes: notes.trim() },
      {
        onSuccess: (data) => {
          toast.show({
            tone: decision === 'APPROVE' ? 'success' : 'info',
            title: decision === 'APPROVE' ? 'Customer approved' : 'Application rejected',
            description: `${displayName}'s status has been updated to ${data.status}.`,
          });
          onClose();
          onSuccess();
        },
        onError: (err: Error) => {
          toast.show({ tone: 'error', title: 'Action failed', description: err.message });
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line px-6 py-5">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">Review application</h2>
            <p className="mt-0.5 text-sm text-ink-3">Approve or reject this pharmacy registration.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={reviewMut.isPending}
            className="rounded-lg p-1.5 text-ink-3 hover:bg-bg-muted hover:text-ink transition-colors"
          >
            <XCircle size={18} />
          </button>
        </div>

        {/* Customer summary */}
        <div className="mx-6 mt-5 flex items-center gap-3.5 rounded-xl border border-line bg-bg-subtle p-4">
          <Avatar name={customer.company_name ?? displayName} size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{displayName}</p>
            {customer.company_name && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-ink-2">
                <Building size={12} className="shrink-0" />
                {customer.company_name}
              </p>
            )}
            <p className="mt-0.5 truncate text-xs text-ink-3">{customer.email}</p>
          </div>
          <RawStatusBadge status={customer.status} />
        </div>

        {/* Decision + notes */}
        <div className="space-y-4 px-6 py-5">
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Decision</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDecision('APPROVE')}
                className={cn(
                  'flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all',
                  decision === 'APPROVE'
                    ? 'border-leaf-500 bg-leaf-50 text-leaf-700'
                    : 'border-line bg-white text-ink-2 hover:border-leaf-300 hover:bg-leaf-50/50',
                )}
              >
                <CheckCircle size={16} /> Approve
              </button>
              <button
                type="button"
                onClick={() => setDecision('REJECTED')}
                className={cn(
                  'flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all',
                  decision === 'REJECTED'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-line bg-white text-ink-2 hover:border-red-300 hover:bg-red-50/50',
                )}
              >
                <XCircle size={16} /> Reject
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="review-notes" className="mb-1.5 block text-sm font-medium text-ink">
              Review notes <span className="text-red-500">*</span>
            </label>
            <textarea
              id="review-notes"
              rows={3}
              value={notes}
              onChange={(e) => { setNotes(e.target.value); if (notesError) setNotesError(''); }}
              placeholder={
                decision === 'APPROVE'
                  ? 'e.g. PCN certificate verified, all documents complete.'
                  : 'e.g. PCN certificate is expired or could not be verified.'
              }
              className={cn(
                'w-full resize-none rounded-lg border bg-white px-3.5 py-2.5 text-sm placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-colors',
                notesError ? 'border-red-400 focus:border-red-400' : 'border-line focus:border-brand-500',
              )}
            />
            {notesError && <p className="mt-1 text-xs text-red-600">{notesError}</p>}
            <p className="mt-1 text-xs text-ink-3">
              This note is recorded in the audit log and visible to your team.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={reviewMut.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={reviewMut.isPending}
            onClick={handleSubmit}
            className={cn(decision === 'REJECTED' && 'bg-red-600 hover:bg-red-700 focus:ring-red-500')}
          >
            {decision === 'APPROVE' ? 'Approve customer' : 'Reject application'}
          </Button>
        </div>
      </div>
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

// ---------- Table skeleton --------------------------------------------------

function TableSkeleton() {
  return (
    <div className="rounded-2xl border border-line overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0 animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-9 w-9 flex-shrink-0 rounded-full bg-bg-muted" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-36 rounded bg-bg-muted" />
            <div className="h-3 w-24 rounded bg-bg-muted" />
          </div>
          <div className="hidden sm:block w-48 space-y-1.5">
            <div className="h-3.5 w-full rounded bg-bg-muted" />
            <div className="h-3 w-24 rounded bg-bg-muted" />
          </div>
          <div className="h-6 w-24 rounded-full bg-bg-muted" />
          <div className="h-3 w-20 rounded bg-bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ---------- Main customer table --------------------------------------------

function CustomerTable({
  records,
  isLoading,
  activeFilter,
  query,
  isAdmin,
  onApprove,
  onReject,
  onReReview,
}: {
  records: TaggedCustomerRecord[];
  isLoading: boolean;
  activeFilter: StageFilter;
  query: string;
  isAdmin: boolean;
  onApprove: (c: CustomerAdminRecord) => void;
  onReject: (c: CustomerAdminRecord) => void;
  onReReview: (c: CustomerAdminRecord, decision: 'APPROVE' | 'REJECTED') => void;
}) {
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let list = activeFilter === 'all'
      ? records
      : records.filter((r) => r._stage === activeFilter);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.company_name ?? '').toLowerCase().includes(q) ||
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
          {query ? <Search size={24} /> : STAGE_CONFIG[activeFilter].icon}
        </span>
        <p className="text-base font-semibold tracking-tight text-ink">
          {query ? 'No customers match' : `No ${activeFilter === 'all' ? '' : STAGE_CONFIG[activeFilter].label.toLowerCase() + ' '}customers yet`}
        </p>
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-3">
          {query
            ? 'Try a different name, email, or company.'
            : activeFilter === 'all'
            ? 'Customers appear here once they sign up on the platform.'
            : STAGE_CONFIG[activeFilter].shortDesc + '.'}
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
              <Th>Customer</Th>
              <Th>Contact</Th>
              <Th>Stage</Th>
              <Th>Review note</Th>
              <Th>Registered</Th>
              {isAdmin && <Th align="right">Actions</Th>}
            </tr>
          </Thead>
          <Tbody>
            {paginated.map((c) => (
              <Tr key={`${c._stage}-${c.id}`}>
                {/* Customer */}
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={c.company_name ?? `${c.first_name} ${c.last_name}`} size={36} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">
                        {c.first_name} {c.last_name}
                      </div>
                      {c.company_name && (
                        <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-3">
                          <Building size={10} className="shrink-0" />
                          {c.company_name}
                        </div>
                      )}
                    </div>
                  </div>
                </Td>

                {/* Contact */}
                <Td>
                  <div className="text-sm text-ink">{c.email}</div>
                  {c.phone && <div className="mt-0.5 text-xs text-ink-3">{c.phone}</div>}
                </Td>

                {/* Stage */}
                <Td><StageBadge stage={c._stage} /></Td>

                {/* Review note */}
                <Td>
                  {c.review_note ? (
                    <p className="max-w-[180px] truncate text-xs text-ink-2" title={c.review_note}>
                      {c.review_note}
                    </p>
                  ) : (
                    <span className="text-xs text-ink-4">—</span>
                  )}
                </Td>

                {/* Date */}
                <Td muted>{formatDate(c.created_at)}</Td>

                {/* Actions */}
                {isAdmin && (
                  <Td align="right">
                    {c._stage === 'pending' ? (
                      /* Pending → explicit Approve + Reject buttons */
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onApprove(c)}
                          className="inline-flex items-center gap-1 rounded-lg bg-leaf-50 px-2.5 py-1.5 text-xs font-semibold text-leaf-700 ring-1 ring-inset ring-leaf-200 transition-colors hover:bg-leaf-100 hover:ring-leaf-300"
                          title="Approve this customer"
                        >
                          <CheckCircle size={12} />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => onReject(c)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-inset ring-red-200 transition-colors hover:bg-red-100 hover:ring-red-300"
                          title="Reject this application"
                        >
                          <XCircle size={12} />
                          Reject
                        </button>
                      </div>
                    ) : c._stage === 'approved' ? (
                      /* Approved → option to reverse (re-review as reject) */
                      <button
                        type="button"
                        onClick={() => onReReview(c, 'REJECTED')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-bg-subtle px-2.5 py-1.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-line transition-colors hover:bg-bg-muted hover:text-ink"
                        title="Re-review this customer"
                      >
                        <Eye size={12} />
                        Re-review
                      </button>
                    ) : c._stage === 'rejected' ? (
                      /* Rejected → option to reconsider (re-review as approve) */
                      <button
                        type="button"
                        onClick={() => onReReview(c, 'APPROVE')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-bg-subtle px-2.5 py-1.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-line transition-colors hover:bg-bg-muted hover:text-ink"
                        title="Reconsider this application"
                      >
                        <Eye size={12} />
                        Reconsider
                      </button>
                    ) : (
                      <span className="text-xs text-ink-4">—</span>
                    )}
                  </Td>
                )}
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

// ---------- File type helpers -----------------------------------------------

const ACCEPTED_IMPORT_TYPES = '.xlsx,.xls,.csv';
const ACCEPTED_IMPORT_MIME  = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'text/plain',
]);

function isAcceptedImportFile(file: File) {
  if (ACCEPTED_IMPORT_MIME.has(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['xlsx', 'xls', 'csv'].includes(ext);
}

// ---------- Customer import row types & validation -------------------------

const CUSTOMER_REQUIRED = ['first_name', 'last_name', 'email', 'phone', 'company_name'] as const;
const CUSTOMER_ALL_COLS = [
  'first_name', 'middle_name', 'last_name', 'company_name',
  'gender', 'phone', 'email', 'address', 'city', 'state', 'country',
] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Download a CSV with the exact backend-expected headers + one sample row. */
function downloadCustomerTemplate() {
  const headers = CUSTOMER_ALL_COLS.join(',');
  const sample  = 'Jane,A.,Doe,Acme Ltd,female,+2348000000001,jane.doe@acme.com,1 Business St,Lagos,Lagos,Nigeria';
  const csv     = `${headers}\n${sample}\n`;
  const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = 'customers_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface CustomerPreviewRow {
  index: number;
  cells: Record<string, string>;
  errors: string[];
  valid: boolean;
}

async function parseCustomerFile(file: File): Promise<CustomerPreviewRow[]> {
  const buf    = await file.arrayBuffer();
  const wb     = XLSX.read(buf, { type: 'array' });
  const wsName = wb.SheetNames[0];
  if (!wsName) throw new Error('File has no sheets.');
  const ws = wb.Sheets[wsName];
  if (!ws) throw new Error('Could not read the first sheet.');
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  if (json.length === 0) throw new Error('File contains no data rows.');

  // ── Column-header guard ────────────────────────────────────────────────────
  const fileHeaders    = Object.keys(json[0] ?? {}).map((k) => k.trim().toLowerCase());
  const missingRequired = CUSTOMER_REQUIRED.filter((col) => !fileHeaders.includes(col));
  if (missingRequired.length > 0) {
    throw new Error(
      `File headers don't match the template.\n` +
      `Missing required columns: ${missingRequired.join(', ')}.\n` +
      `Download the sample template to see the expected format.`,
    );
  }

  return json.map((raw, i) => {
    const lookup: Record<string, string> = {};
    Object.entries(raw).forEach(([k, v]) => {
      lookup[k.trim().toLowerCase()] = v == null ? '' : String(v).trim();
    });
    const cells: Record<string, string> = {};
    CUSTOMER_ALL_COLS.forEach((col) => { cells[col] = lookup[col] ?? ''; });

    const errors: string[] = [];
    CUSTOMER_REQUIRED.forEach((col) => {
      if (!cells[col]) errors.push(`${col} is required`);
    });
    if (cells.email && !EMAIL_RE.test(cells.email)) errors.push('email format invalid');

    return { index: i, cells, errors, valid: errors.length === 0 };
  });
}

// ---------- Bulk upload modal -----------------------------------------------

function BulkUploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast     = useToast();
  const uploadMut = useBulkUploadCustomers();
  const inputRef  = useRef<HTMLInputElement>(null);

  const [file,       setFile]       = useState<File | null>(null);
  const [preview,    setPreview]    = useState<CustomerPreviewRow[] | null>(null);
  const [parsing,    setParsing]    = useState(false);
  const [parseErr,   setParseErr]   = useState('');
  const [typeError,  setTypeError]  = useState('');
  const [serverFails, setServerFails] = useState<{ row: number; email: string; errors: string[] }[]>([]);

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setPreview(null);
    setParseErr('');
    setTypeError('');
    setServerFails([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (f: File | undefined) => {
    if (!f) return;
    if (!isAcceptedImportFile(f)) {
      setTypeError('Unsupported file type. Please upload a .xlsx, .xls or .csv file.');
      return;
    }
    setTypeError('');
    setFile(f);
    setPreview(null);
    setParseErr('');
    setParsing(true);
    try {
      const rows = await parseCustomerFile(f);
      setPreview(rows);
    } catch (e) {
      setParseErr((e as Error).message ?? 'Could not read file.');
    } finally {
      setParsing(false);
    }
  };

  const validCount   = preview?.filter((r) => r.valid).length ?? 0;
  const invalidCount = preview?.filter((r) => !r.valid).length ?? 0;
  const canUpload    = !!file && !parsing && !!preview && validCount > 0;

  const submit = () => {
    if (!file) return;
    setServerFails([]);
    uploadMut.mutate(file, {
      onSuccess: (data) => {
        const hasFails = data.failed > 0;
        toast.show({
          tone: hasFails ? 'warning' : 'success',
          title: hasFails ? `${data.successful}/${data.total_records} imported` : `${data.successful} customers imported`,
          description: hasFails
            ? `${data.failed} row(s) were rejected by the server.`
            : 'All records inserted successfully.',
        });
        if (hasFails) {
          setServerFails(data.failed_records);
        } else {
          reset(); onClose();
        }
      },
      onError: (err: Error) => {
        toast.show({ tone: 'error', title: 'Upload failed', description: err.message });
      },
    });
  };

  const PREVIEW_LIMIT = 100;
  const displayed = preview?.slice(0, PREVIEW_LIMIT) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className={cn(
        'flex w-full flex-col rounded-2xl border border-line bg-white shadow-2xl transition-all',
        preview ? 'max-w-4xl' : 'max-w-md',
      )}>
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line px-6 py-5">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">Import customers</h2>
            <p className="mt-0.5 text-sm text-ink-3">
              {preview
                ? `${preview.length} rows found in ${file?.name}`
                : 'Upload an Excel or CSV file. Data is previewed before import.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            disabled={uploadMut.isPending}
            className="rounded-lg p-1.5 text-ink-3 hover:bg-bg-muted hover:text-ink transition-colors"
          >
            <XCircle size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: '70vh' }}>

          {!preview && (
            <>
              <div className="mb-4 rounded-xl bg-bg-subtle px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-2">Required columns</p>
                    <p className="mt-1 font-mono text-[11px] text-ink-3 leading-relaxed">
                      first_name · last_name · email · phone · company_name
                    </p>
                    <p className="mt-2 text-xs font-medium text-ink-2">Optional</p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-3 leading-relaxed">
                      middle_name · gender · address · city · state · country
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadCustomerTemplate}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-brand-600 shadow-sm hover:bg-bg-subtle transition-colors"
                  >
                    <Upload size={11} className="rotate-180" />
                    Download template
                  </button>
                </div>
              </div>

              <div
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-bg-subtle py-10 transition-colors',
                  parsing
                    ? 'cursor-default border-brand-300 opacity-60'
                    : 'border-line hover:border-brand-400 hover:bg-brand-50/30',
                )}
                onClick={() => !parsing && inputRef.current?.click()}
              >
                {parsing ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    <p className="text-sm text-ink-3">Parsing file…</p>
                  </>
                ) : (
                  <>
                    <Upload size={20} className="text-ink-3" />
                    <p className="text-sm font-medium text-ink-2">
                      {file ? file.name : 'Click to choose a file'}
                    </p>
                    <p className="text-xs text-ink-3">.xlsx · .xls · .csv</p>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_IMPORT_TYPES}
                  className="hidden"
                  onChange={(e) => { void handleFile(e.target.files?.[0]); }}
                />
              </div>
              {typeError && <p className="mt-2 text-xs text-red-600">{typeError}</p>}
              {parseErr  && (
                <p className="mt-2 whitespace-pre-line text-xs text-red-600">
                  <AlertTriangle size={11} className="mr-1 inline" />
                  {parseErr}
                </p>
              )}
            </>
          )}

          {preview && (
            <>
              {/* Summary bar */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-3 py-1 text-xs font-semibold text-leaf-700 ring-1 ring-inset ring-leaf-200">
                  <CheckCircle size={12} /> {validCount} valid
                </span>
                {invalidCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                    <AlertTriangle size={12} /> {invalidCount} {invalidCount === 1 ? 'row has' : 'rows have'} errors
                  </span>
                )}
                <button type="button" onClick={reset} className="ml-auto text-xs font-medium text-brand-600 hover:underline">
                  Choose a different file
                </button>
              </div>

              {invalidCount > 0 && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-xs leading-relaxed text-amber-800">
                    Rows with errors will be rejected by the server. Fix them in your file and re-upload,
                    or proceed to import only the {validCount} valid row{validCount !== 1 ? 's' : ''}.
                  </p>
                </div>
              )}

              {/* Data table */}
              <div className="overflow-hidden rounded-xl border border-line">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-bg-subtle text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                      <tr>
                        <th className="w-10 px-3 py-2.5">#</th>
                        <th className="px-3 py-2.5">Name</th>
                        <th className="px-3 py-2.5">Email</th>
                        <th className="px-3 py-2.5">Phone</th>
                        <th className="px-3 py-2.5">Company</th>
                        <th className="px-3 py-2.5">Gender</th>
                        <th className="px-3 py-2.5">City / State</th>
                        <th className="px-3 py-2.5">Country</th>
                        <th className="px-3 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((row) => (
                        <tr key={row.index} className={cn('border-t border-line align-top', !row.valid && 'bg-red-50/60')}>
                          <td className="px-3 py-2.5 text-xs text-ink-3">{row.index + 1}</td>
                          <td className="px-3 py-2.5 text-xs">
                            <span className={cn(!row.cells.first_name || !row.cells.last_name ? 'text-red-600' : 'text-ink')}>
                              {[row.cells.first_name, row.cells.middle_name, row.cells.last_name].filter(Boolean).join(' ') || <span className="italic text-red-400">missing</span>}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            <span className={cn(!row.cells.email || !EMAIL_RE.test(row.cells.email) ? 'text-red-600' : 'text-ink')}>
                              {row.cells.email || <span className="italic text-red-400">missing</span>}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            <span className={cn(!row.cells.phone ? 'text-red-500 italic' : 'text-ink')}>
                              {row.cells.phone || 'missing'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            <span className={cn(!row.cells.company_name ? 'text-red-500 italic' : 'text-ink')}>
                              {row.cells.company_name || 'missing'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs capitalize text-ink-2">
                            {row.cells.gender || <span className="text-ink-4">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-ink-2">
                            {[row.cells.city, row.cells.state].filter(Boolean).join(', ') || <span className="text-ink-4">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-ink-2">
                            {row.cells.country || <span className="text-ink-4">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {row.valid ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-leaf-600">
                                <CheckCircle size={12} /> Valid
                              </span>
                            ) : (
                              <span className="inline-flex cursor-help items-center gap-1 text-xs font-medium text-red-600" title={row.errors.join('\n')}>
                                <AlertTriangle size={12} />
                                {row.errors.length} error{row.errors.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {preview.length > PREVIEW_LIMIT && (
                        <tr className="border-t border-line bg-bg-subtle">
                          <td colSpan={9} className="px-4 py-2.5 text-center text-xs text-ink-3">
                            …and {preview.length - PREVIEW_LIMIT} more rows (all will be uploaded)
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Server-side failure report */}
              {serverFails.length > 0 && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-red-800">
                    Server rejected {serverFails.length} row{serverFails.length > 1 ? 's' : ''}
                  </p>
                  <ul className="max-h-32 space-y-1 overflow-y-auto">
                    {serverFails.map((r, i) => (
                      <li key={i} className="text-xs text-red-700">
                        Row {r.row} ({r.email}): {r.errors.join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line px-6 py-4">
          <p className="text-xs text-ink-3">
            {preview
              ? `${validCount} of ${preview.length} rows ready to import`
              : 'Select a file to preview before uploading'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { reset(); onClose(); }} disabled={uploadMut.isPending}>
              Cancel
            </Button>
            <Button size="sm" loading={uploadMut.isPending} disabled={!canUpload} onClick={submit}>
              {invalidCount > 0
                ? `Upload ${validCount} valid row${validCount !== 1 ? 's' : ''}`
                : `Upload ${validCount} customer${validCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Main view -------------------------------------------------------

export function CustomersView({ role }: { role: Role }) {
  const isAdmin = role === 'admin';

  const [activeFilter,       setActiveFilter]       = useState<StageFilter>('all');
  const [query,              setQuery]              = useState('');
  const [onboard,            setOnboard]            = useState(false);
  const [importing,          setImporting]          = useState(false);
  const [reviewTarget,       setReviewTarget]       = useState<CustomerAdminRecord | null>(null);
  const [reviewInitDecision, setReviewInitDecision] = useState<'APPROVE' | 'REJECTED'>('APPROVE');

  const { allRecords, counts, isLoading, errors, refetchAll } = useAllCustomers();

  const totalCounts: Record<StageFilter, number> = {
    all: allRecords.length,
    ...counts,
  };

  const handleFilter = (f: StageFilter) => {
    setActiveFilter(f);
    setQuery('');
  };

  /** Open review modal pre-selected to Approve */
  const handleApprove = (c: CustomerAdminRecord) => {
    setReviewInitDecision('APPROVE');
    setReviewTarget(c);
  };

  /** Open review modal pre-selected to Reject */
  const handleReject = (c: CustomerAdminRecord) => {
    setReviewInitDecision('REJECTED');
    setReviewTarget(c);
  };

  /** Open review modal with a specific initial decision (re-review flow) */
  const handleReReview = (c: CustomerAdminRecord, decision: 'APPROVE' | 'REJECTED') => {
    setReviewInitDecision(decision);
    setReviewTarget(c);
  };

  const closeReview = () => setReviewTarget(null);

  const hasErrors    = errors.length > 0;
  const pendingCount = counts.pending ?? 0;

  return (
    <>
      {/* ── Page header ── */}
      <PageHead
        title="Customers"
        subtitle="Pharmacies registered with Envolve Pharmaceuticals."
        actions={
          <>
            <Button
              variant="secondary"
              leadingIcon={<Upload size={14} />}
              onClick={() => setImporting(true)}
            >
              Import
            </Button>
            {isAdmin && (
              <Button leadingIcon={<Plus size={14} />} onClick={() => setOnboard(true)}>
                Add customer
              </Button>
            )}
          </>
        }
      />

      {/* ── Stage filter cards ── */}
      <div className="mb-6 flex items-stretch gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        {STAGE_ORDER.map((stage) => (
          <StageCard
            key={stage}
            stage={stage}
            count={totalCounts[stage] ?? 0}
            isLoading={isLoading}
            isActive={activeFilter === stage}
            onClick={() => handleFilter(stage)}
          />
        ))}
      </div>

      {/* ── Search + filter info bar ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              activeFilter === 'all'
                ? 'Search across all customers…'
                : `Search ${STAGE_CONFIG[activeFilter].label.toLowerCase()}…`
            }
            aria-label="Search customers"
            className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
          />
        </div>

        {/* Clear search */}
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Clear search
          </button>
        )}

        {/* Refetch */}
        <button
          type="button"
          onClick={refetchAll}
          title="Refresh all customer data"
          className="rounded-lg border border-line bg-white p-2 text-ink-3 transition-colors hover:border-brand-300 hover:text-brand-600"
        >
          <RotateCw size={14} />
        </button>

        {/* Count text */}
        {!isLoading && (
          <p className="text-xs text-ink-3 whitespace-nowrap">
            {totalCounts[activeFilter] ?? 0} customer{(totalCounts[activeFilter] ?? 0) !== 1 ? 's' : ''}
            {activeFilter !== 'all' && ` · ${STAGE_CONFIG[activeFilter].label}`}
          </p>
        )}
      </div>

      {/* ── Admin attention banner for pending items ── */}
      {isAdmin && pendingCount > 0 && activeFilter !== 'pending' && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
          </span>
          <p className="flex-1 text-sm text-orange-800">
            <span className="font-semibold">{pendingCount} application{pendingCount !== 1 ? 's' : ''}</span>{' '}
            {pendingCount === 1 ? 'is' : 'are'} waiting for your review.
          </p>
          <button
            type="button"
            onClick={() => handleFilter('pending')}
            className="text-xs font-semibold text-orange-700 hover:underline"
          >
            Review now →
          </button>
        </div>
      )}

      {/* ── Error state ── */}
      {hasErrors && !isLoading && allRecords.length === 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-red-800">Could not load customers</p>
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

      {/* ── Customer table ── */}
      <CustomerTable
        records={allRecords}
        isLoading={isLoading}
        activeFilter={activeFilter}
        query={query}
        isAdmin={isAdmin}
        onApprove={handleApprove}
        onReject={handleReject}
        onReReview={handleReReview}
      />

      {/* ── Review modal ──
          key forces a full remount whenever the target or initial decision changes,
          so the modal always opens with fresh state (no stale notes/decision). */}
      <ReviewModal
        key={`${reviewTarget?.id ?? 'none'}-${reviewInitDecision}`}
        customer={reviewTarget}
        initialDecision={reviewInitDecision}
        onClose={closeReview}
        onSuccess={closeReview}
      />

      {/* ── Onboard modal ── */}
      <CreateEntityModal
        open={onboard}
        onClose={() => setOnboard(false)}
        title="Add a customer"
        description="Create the pharmacy account. They will receive an email to verify and set their password."
        fields={ONBOARD_FIELDS}
        schema={undefined as never}
        action={async () => ({
          ok: false as const,
          message: 'Direct onboarding coming soon. Use bulk import for now.',
        })}
        submitLabel="Create & invite"
        successTitle="Customer onboarded"
        size="xl"
      />

      {/* ── Bulk upload modal ── */}
      <BulkUploadModal open={importing} onClose={() => setImporting(false)} />
    </>
  );
}
