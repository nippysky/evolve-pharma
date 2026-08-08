'use client';
import React, { use, useState, useEffect, useCallback } from 'react';
import Link          from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHead }  from '@/components/shared/PageHead';
import { Button }    from '@/components/ui/Button';
import { useToast }  from '@/contexts/ToastContext';
import { useUser }   from '@/contexts/UserContext';
import { cn }        from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/utils';
import {
  ArrowLeft, Building, Mail, Phone, MapPin, Shield, CheckCircle,
  Clock, XCircle, FileText, RotateCw, AlertTriangle, User, Calendar,
  Tag, ArrowUpRight, Eye, Users, ChevronDown, Basket,
} from '@/components/icons';

interface StaffUser {
  id:         number;
  first_name: string;
  last_name:  string;
  email:      string;
}

interface CustomerDetail {
  id:                   number;
  uuid?:                string | null;
  company_name?:        string | null;
  address?:             string | null;
  city?:                string | null;
  state?:               string | null;
  pcn_certificate_url?: string | null;
  pcn_verified:         boolean;
  status:               string;
  referral_code?:       string | null;
  referred_by?:         string | null;
  review_note?:         string | null;
  reviewed_at?:         string | null;
  created_at:           string;
  updated_at:           string;
  assigned_staff?:      StaffUser | null;
  user: {
    id:                 number;
    uuid?:              string | null;
    first_name:         string;
    last_name:          string;
    email:              string;
    phone?:             string | null;
    status:             string;
    avatar_url?:        string | null;
    email_verified_at?: string | null;
    created_at:         string;
  };
  reviewed_by?: { id: number; name: string; email: string } | null;
  order_count:  number;
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === 'APPROVED')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-3 py-1 text-sm font-semibold text-leaf-700 ring-1 ring-inset ring-leaf-200">
        <CheckCircle size={13} /> Approved
      </span>
    );
  if (s === 'PENDING_REVIEW')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
        <Clock size={13} /> Pending review
      </span>
    );
  if (s === 'REJECTED')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700 ring-1 ring-inset ring-red-200">
        <XCircle size={13} /> Rejected
      </span>
    );
  if (s === 'PCN_CERT_UPLOADED')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-sm font-semibold text-purple-700 ring-1 ring-inset ring-purple-200">
        <Shield size={13} /> PCN uploaded
      </span>
    );
  if (s === 'OTP_CONFIRMED')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
        <CheckCircle size={13} /> Email verified
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-muted px-3 py-1 text-sm font-medium text-ink-3 ring-1 ring-inset ring-line">
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon:   React.ReactNode;
  label:  string;
  value?: string | null;
  mono?:  boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 shrink-0 text-ink-3">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">{label}</p>
        <p className={cn('mt-0.5 break-all text-sm text-ink', mono && 'font-mono')}>{value}</p>
      </div>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title:    string;
  icon?:    React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        {icon && <span className="text-ink-3">{icon}</span>}
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
      </div>
      <div className="divide-y divide-line px-5">{children}</div>
    </div>
  );
}

function PcnViewer({
  customerId,
  rawUrl,
  verified,
}: {
  customerId: number;
  rawUrl?:    string | null;
  verified:   boolean;
}) {
  const [revealed,  setRevealed]  = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);

  // Only fetch the signed URL once the user explicitly opens the viewer
  const handleReveal = () => {
    setRevealed(true);
    if (signedUrl) return; // already fetched
    setLoading(true);
    fetch(`/api/customers/${customerId}/pcn-url`, { credentials: 'include' })
      .then(r => r.json())
      .then((j: { data?: { url?: string } }) => { setSignedUrl(j.data?.url ?? rawUrl ?? null); })
      .catch(() => { setSignedUrl(rawUrl ?? null); })
      .finally(() => setLoading(false));
  };

  if (!rawUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-bg-muted">
          <FileText size={22} className="text-ink-3" />
        </div>
        <p className="text-sm font-medium text-ink-2">No PCN certificate uploaded</p>
        <p className="text-xs text-ink-4">The customer has not submitted their certificate yet.</p>
      </div>
    );
  }

  const url   = signedUrl ?? rawUrl;
  const isPdf = url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('/raw/');

  // ── Collapsed state: prompt to view ────────────────────────────────────────
  if (!revealed) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-bg-muted">
          <FileText size={22} className="text-ink-3" />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">PCN certificate available</p>
          <p className="mt-0.5 text-xs text-ink-4">Click below to load and view the document.</p>
        </div>
        <span className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
          verified
            ? 'bg-leaf-50 text-leaf-700 ring-1 ring-inset ring-leaf-200'
            : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
        )}>
          <Shield size={11} />
          {verified ? 'PCN verified' : 'Awaiting verification'}
        </span>
        <button
          type="button"
          onClick={handleReveal}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-bg-subtle"
        >
          <Eye size={14} /> View certificate
        </button>
      </div>
    );
  }

  // ── Revealed state ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {/* Status + open link */}
      <div className="flex items-center justify-between">
        <span className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
          verified
            ? 'bg-leaf-50 text-leaf-700 ring-1 ring-inset ring-leaf-200'
            : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
        )}>
          <Shield size={11} />
          {verified ? 'PCN verified' : 'Awaiting verification'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRevealed(false)}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-3 transition-colors hover:bg-bg-subtle"
          >
            Hide
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50"
          >
            <ArrowUpRight size={12} /> Open full size
          </a>
        </div>
      </div>

      {/* Viewer */}
      {loading ? (
        <div className="flex h-[440px] items-center justify-center rounded-xl bg-bg-subtle">
          <RotateCw size={20} className="animate-spin text-ink-3" />
        </div>
      ) : isPdf ? (
        <iframe
          src={`${url}#toolbar=0&navpanes=0`}
          className="h-[500px] w-full rounded-xl border border-line bg-white"
          title="PCN Certificate"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-bg-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="PCN Certificate"
            className="w-full object-contain"
            style={{ maxHeight: 520 }}
          />
        </div>
      )}
    </div>
  );
}

function ReviewPanel({
  customer,
  isAdmin,
  onDone,
}: {
  customer: CustomerDetail;
  isAdmin:  boolean;
  onDone:   () => void;
}) {
  const toast                   = useToast();
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [note,     setNote]     = useState(customer.review_note ?? '');
  const [saving,   setSaving]   = useState(false);

  const isPending = customer.status === 'PENDING_REVIEW';
  const canReview = isPending || (isAdmin && (customer.status === 'APPROVED' || customer.status === 'REJECTED'));

  if (!canReview) return null;

  const handleSubmit = async () => {
    if (!decision) return;
    if (decision === 'reject' && !note.trim()) {
      toast.error('Note required', 'Please provide a reason for rejection.');
      return;
    }
    setSaving(true);
    try {
      const res  = await fetch(`/api/customers/${customer.id}/review`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ decision, review_note: note }),
      });
      const json = await res.json() as { message?: string };
      if (!res.ok) throw new Error(json.message ?? 'Review failed');
      toast.success(
        decision === 'approve' ? 'Customer approved' : 'Customer rejected',
        decision === 'approve' ? 'Account is now active.' : 'Application has been rejected.',
      );
      setDecision(null);
      onDone();
    } catch (e) {
      toast.error('Review failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <Eye size={15} className="text-ink-3" />
        <h2 className="text-sm font-semibold text-ink">
          {isPending ? 'Review application' : 'Re-review'}
        </h2>
        {!isPending && (
          <span className="ml-auto rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
            Admin only
          </span>
        )}
      </div>
      <div className="space-y-4 p-5">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDecision('approve')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-all',
              decision === 'approve'
                ? 'border-leaf-400 bg-leaf-50 text-leaf-700 ring-2 ring-leaf-200'
                : 'border-line bg-white text-ink-2 hover:border-leaf-300 hover:bg-leaf-50 hover:text-leaf-700',
            )}
          >
            <CheckCircle size={15} /> Approve
          </button>
          <button
            type="button"
            onClick={() => setDecision('reject')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-all',
              decision === 'reject'
                ? 'border-red-400 bg-red-50 text-red-700 ring-2 ring-red-200'
                : 'border-line bg-white text-ink-2 hover:border-red-300 hover:bg-red-50 hover:text-red-700',
            )}
          >
            <XCircle size={15} /> Reject
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-2">
            {decision === 'reject' ? 'Reason for rejection *' : 'Review notes (optional)'}
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={decision === 'reject' ? 'State clearly why this application is being rejected…' : 'Any notes about this customer application…'}
            className="w-full resize-none rounded-xl border border-line bg-bg-subtle px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <Button
          fullWidth
          loading={saving}
          disabled={!decision || saving}
          onClick={handleSubmit}
          variant={decision === 'reject' ? 'danger' : 'primary'}
        >
          {saving
            ? 'Submitting…'
            : decision === 'approve'
            ? 'Approve application'
            : decision === 'reject'
            ? 'Reject application'
            : 'Select approve or reject'}
        </Button>
      </div>
    </div>
  );
}

// ── Staff Assignment Panel ────────────────────────────────────────────────────

function StaffAssignPanel({
  customerId,
  current,
  onDone,
}: {
  customerId: number;
  current:    StaffUser | null | undefined;
  onDone:     () => void;
}) {
  const toast                       = useToast();
  const [staffList, setStaffList]   = useState<StaffUser[]>([]);
  const [selected,  setSelected]    = useState<string>(current?.id.toString() ?? '');
  const [saving,    setSaving]      = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    fetch('/api/staff?role=STAFF&limit=200', { credentials: 'include' })
      .then(r => r.json())
      .then((j: { data?: { items?: StaffUser[] } }) => {
        setStaffList(j.data?.items ?? []);
      })
      .catch(() => {/* silent */})
      .finally(() => setLoadingList(false));
  }, []);

  // Keep dropdown in sync if current assignment changes after reload
  useEffect(() => {
    setSelected(current?.id.toString() ?? '');
  }, [current]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const staff_user_id = selected ? parseInt(selected, 10) : null;
      const res  = await fetch(`/api/customers/${customerId}/assign-staff`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ staff_user_id }),
      });
      const json = await res.json() as { message?: string };
      if (!res.ok) throw new Error(json.message ?? 'Assignment failed');
      toast.success(
        staff_user_id ? 'Staff assigned' : 'Assignment removed',
        staff_user_id ? 'Customer is now assigned to this staff member.' : 'Customer has been unassigned.',
      );
      onDone();
    } catch (e) {
      toast.error('Assignment failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = selected !== (current?.id.toString() ?? '');

  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <Users size={15} className="text-ink-3" />
        <h2 className="text-sm font-semibold text-ink">Assigned staff</h2>
        <span className="ml-auto rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
          Admin only
        </span>
      </div>

      <div className="space-y-4 p-5">
        {/* Current assignment chip */}
        <div className={cn(
          'flex items-center gap-2.5 rounded-xl px-3.5 py-2.5',
          current ? 'bg-teal-50 border border-teal-100' : 'bg-bg-muted border border-line',
        )}>
          <div className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            current ? 'bg-teal-500 text-white' : 'bg-line text-ink-4',
          )}>
            {current ? `${current.first_name[0]}${current.last_name[0]}` : '–'}
          </div>
          <div className="min-w-0">
            <p className={cn('text-sm font-semibold leading-tight truncate', current ? 'text-teal-800' : 'text-ink-3')}>
              {current ? `${current.first_name} ${current.last_name}` : 'Not assigned'}
            </p>
            {current && (
              <p className="mt-0.5 truncate text-[11px] text-teal-600">{current.email}</p>
            )}
          </div>
        </div>

        {/* Staff selector */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-2">
            Assign to staff member
          </label>
          <div className="relative">
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              disabled={loadingList || saving}
              className="w-full appearance-none rounded-xl border border-line bg-bg-subtle py-2.5 pl-3.5 pr-9 text-sm text-ink focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:opacity-50"
            >
              <option value="">— Unassigned —</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id.toString()}>
                  {s.first_name} {s.last_name} · {s.email}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-ink-3" />
          </div>
        </div>

        <Button
          fullWidth
          loading={saving}
          disabled={!isDirty || saving}
          onClick={handleSave}
          variant="primary"
        >
          {saving ? 'Saving…' : selected ? 'Assign staff' : 'Remove assignment'}
        </Button>
      </div>
    </div>
  );
}

const LIFECYCLE_STEPS = [
  { key: 'REGISTERED',        label: 'Registered'    },
  { key: 'OTP_CONFIRMED',     label: 'Email verified' },
  { key: 'PCN_CERT_UPLOADED', label: 'PCN uploaded'  },
  { key: 'PENDING_REVIEW',    label: 'Under review'  },
  { key: 'APPROVED',          label: 'Approved'      },
];

const STATUS_ORDER: Record<string, number> = {
  REGISTERED:        0,
  OTP_CONFIRMED:     1,
  PCN_CERT_UPLOADED: 2,
  PENDING_REVIEW:    3,
  APPROVED:          4,
  REJECTED:          4,
};

function LifecycleTracker({ status }: { status: string }) {
  const idx      = STATUS_ORDER[status] ?? 0;
  const rejected = status === 'REJECTED';

  return (
    <div className="flex items-start">
      {LIFECYCLE_STEPS.map((step, i) => {
        const done    = i < idx;
        const current = i === idx && !rejected;
        const isRej   = rejected && i === idx;

        return (
          <div key={step.key} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {i > 0 && (
                <div className={cn('h-0.5 flex-1', done || current ? 'bg-brand-400' : 'bg-line')} />
              )}
              <div className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                done    && 'bg-brand-500 text-white',
                current && 'bg-brand-500 text-white ring-4 ring-brand-100',
                isRej   && 'bg-red-500 text-white ring-4 ring-red-100',
                !done && !current && !isRej && 'bg-bg-muted text-ink-4 ring-1 ring-inset ring-line',
              )}>
                {isRej ? '✕' : done ? '✓' : i + 1}
              </div>
              {i < LIFECYCLE_STEPS.length - 1 && (
                <div className={cn('h-0.5 flex-1', done ? 'bg-brand-400' : 'bg-line')} />
              )}
            </div>
            <p className={cn(
              'mt-1.5 text-center text-[10px] font-semibold leading-snug',
              done || current ? 'text-brand-600' : isRej ? 'text-red-600' : 'text-ink-4',
            )}>
              {isRej ? 'Rejected' : step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }   = use(params);
  const router   = useRouter();
  const { user: me } = useUser();
  const isAdmin  = me?.role === 'ADMIN';

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`/api/customers/${id}`, { credentials: 'include' });
      const json = await res.json() as { data?: CustomerDetail; message?: string };
      if (!res.ok) throw new Error(json.message ?? 'Failed to load customer');
      setCustomer(json.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void fetchCustomer(); }, [fetchCustomer]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <PageHead title="Customer" subtitle="Loading profile…" />
        <div className="mb-6 h-28 animate-pulse rounded-2xl bg-white" />
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
          <div className="h-[560px] animate-pulse rounded-2xl bg-white" />
        </div>
      </>
    );
  }

  // ── Error / not found ─────────────────────────────────────────────────────
  if (error || !customer) {
    return (
      <>
        <PageHead title="Customer" subtitle="Could not load this record." />
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-red-50">
            <AlertTriangle size={22} className="text-danger" />
          </div>
          <p className="text-sm font-medium text-ink-2">{error || 'Customer not found.'}</p>
          <Button variant="secondary" onClick={() => router.push('/admin/customers')}>
            Back to customers
          </Button>
        </div>
      </>
    );
  }

  const fullName    = `${customer.user.first_name} ${customer.user.last_name}`;
  const fullAddress = [customer.address, customer.city, customer.state].filter(Boolean).join(', ');

  return (
    <>
      <PageHead
        title={fullName}
        subtitle={customer.company_name ?? 'Customer profile'}
        actions={
          <div className="flex items-center gap-2">
            {/* Only approved customers can have an order placed for them —
                the API rejects anything else, so don't offer it here. */}
            {customer.status === 'APPROVED' && (
              <Link href={`/admin/orders/new?customer_id=${customer.id}`}>
                <Button leadingIcon={<Basket size={14} />}>
                  Place order
                </Button>
              </Link>
            )}
            <Link href="/admin/customers">
              <Button variant="secondary" leadingIcon={<ArrowLeft size={14} />}>
                All customers
              </Button>
            </Link>
          </div>
        }
      />

      {/* Lifecycle tracker */}
      <div className="mb-6 rounded-2xl border border-line bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">
            Account lifecycle
          </p>
          <StatusBadge status={customer.status} />
        </div>
        <LifecycleTracker status={customer.status} />
      </div>

      {/* Two-column grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">

        {/* ── Left ──────────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Identity */}
          <Card title="Identity" icon={<User size={15} />}>
            <InfoRow icon={<User size={14} />}     label="Full name"     value={fullName} />
            <InfoRow icon={<Mail size={14} />}     label="Email"         value={customer.user.email} />
            <InfoRow icon={<Phone size={14} />}    label="Phone"         value={customer.user.phone} />
            <InfoRow icon={<Calendar size={14} />} label="Registered"    value={formatDateTime(customer.user.created_at)} />
            <InfoRow
              icon={<CheckCircle size={14} />}
              label="Email verified"
              value={customer.user.email_verified_at
                ? formatDateTime(customer.user.email_verified_at)
                : 'Not yet verified'}
            />
          </Card>

          {/* Company & address */}
          <Card title="Company & address" icon={<Building size={15} />}>
            <InfoRow icon={<Building size={14} />} label="Company name"  value={customer.company_name} />
            <InfoRow icon={<MapPin size={14} />}   label="Address"       value={fullAddress || null} />
            <InfoRow icon={<Tag size={14} />}     label="Referral code" value={customer.referral_code} mono />
            <InfoRow icon={<Tag size={14} />}     label="Referred by"   value={customer.referred_by}   mono />
            {!customer.company_name && !fullAddress && (
              <p className="py-4 text-sm text-ink-4">No company or address on file.</p>
            )}
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">Total orders</p>
              <p className="mt-1.5 text-3xl font-bold text-ink">{customer.order_count}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">PCN verified</p>
              <p className={cn(
                'mt-1.5 text-lg font-bold',
                customer.pcn_verified ? 'text-leaf-600' : 'text-amber-600',
              )}>
                {customer.pcn_verified ? 'Verified' : 'Not yet'}
              </p>
            </div>
          </div>

          {/* Review history (only if reviewed) */}
          {(customer.reviewed_by || customer.review_note) && (
            <Card title="Review history" icon={<Eye size={15} />}>
              {customer.reviewed_by && (
                <InfoRow
                  icon={<User size={14} />}
                  label="Reviewed by"
                  value={`${customer.reviewed_by.name} · ${customer.reviewed_by.email}`}
                />
              )}
              {customer.reviewed_at && (
                <InfoRow
                  icon={<Calendar size={14} />}
                  label="Reviewed at"
                  value={formatDateTime(customer.reviewed_at)}
                />
              )}
              {customer.review_note && (
                <div className="py-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                    Notes
                  </p>
                  <p className="text-sm leading-relaxed text-ink-2">{customer.review_note}</p>
                </div>
              )}
            </Card>
          )}

          {/* Inline review action */}
          <ReviewPanel
            customer={customer}
            isAdmin={isAdmin}
            onDone={() => void fetchCustomer()}
          />
        </div>

        {/* ── Right: PCN + metadata ──────────────────────────────────────── */}
        <div className="space-y-5">

          {/* PCN cert card */}
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-line pb-4">
              <Shield size={15} className="text-ink-3" />
              <h2 className="text-sm font-semibold text-ink">PCN Certificate</h2>
            </div>
            <PcnViewer
              customerId={customer.id}
              rawUrl={customer.pcn_certificate_url}
              verified={customer.pcn_verified}
            />
          </div>

          {/* Staff assignment — admin only */}
          {isAdmin && (
            <StaffAssignPanel
              customerId={customer.id}
              current={customer.assigned_staff}
              onDone={() => void fetchCustomer()}
            />
          )}

          {/* Account metadata */}
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">
              Account metadata
            </p>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-ink-3">Customer ID</dt>
                <dd className="font-mono text-ink-2">#{customer.id}</dd>
              </div>
              {customer.uuid && (
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-ink-3">UUID</dt>
                  <dd className="break-all text-right font-mono text-ink-2">{customer.uuid}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-ink-3">Created</dt>
                <dd className="text-ink-2">{formatDate(customer.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-ink-3">Last updated</dt>
                <dd className="text-ink-2">{formatDate(customer.updated_at)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-ink-3">User status</dt>
                <dd className="text-ink-2">{customer.user.status}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
