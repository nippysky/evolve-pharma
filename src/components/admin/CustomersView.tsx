'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {Search, Plus, Upload, Building, Shield, CheckCircle, Clock, XCircle, AlertTriangle, Users, User, ChevronLeft, ChevronRight, Eye, RotateCw, ArrowUpRight, FileText, Phone, Mail, MapPin} from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import {Avatar} from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { PageHead } from '@/components/shared/PageHead';
import { useToast } from '@/contexts/ToastContext';
import {useAllCustomers, useReviewCustomer, useCreateCustomer, useBulkUploadCustomers, type CustomerStage, type TaggedCustomerRecord} from '@/hooks/staff/useStaff';
import { customerOnboardSchema } from '@/lib/schemas';
import { NIGERIAN_STATES } from '@/lib/constants';
import { formatDate, cn } from '@/lib/utils';
import type { Role } from '@/types';
import type { CustomerAdminRecord, AssignedStaff } from '@/lib/api/types';

type CustomerBulkResult = {
  total_records:  number;
  successful:     number;
  failed:         number;
  failed_records: Array<{ row: number; email?: string; errors: string[] }>;
};

const PAGE_SIZE = 15;

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
//
// Admin enters customer details → POST /api/customers → invitation email sent.
// Customer receives email with OTP + link to /sign-up/invited to upload PCN
// and set their password. No PCN is collected here.

const emptyInviteForm = {
  first_name:   '',
  middle_name:  '',
  last_name:    '',
  company_name: '',
  email:        '',
  phone:        '',
  address:      '',
  city:         '',
  state:        '',
};
type InviteForm = typeof emptyInviteForm;

function InviteCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast      = useToast();
  const createMut  = useCreateCustomer();
  const [form, setForm]           = React.useState<InviteForm>(emptyInviteForm);
  const [errors, setErrors]       = React.useState<Partial<Record<keyof InviteForm, string>>>({});
  const [serverError, setServer]  = React.useState('');

  if (!open) return null;

  const set = (k: keyof InviteForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      // Clear the error for this field as soon as the user starts correcting it
      if (errors[k]) setErrors((prev) => { const n = { ...prev }; delete n[k]; return n; });
    };

  const validate = (): boolean => {
    // Run through the same Zod schema the server uses — keeps client + server in sync
    const result = customerOnboardSchema.safeParse({
      first_name:   form.first_name.trim(),
      middle_name:  form.middle_name.trim() || undefined,
      last_name:    form.last_name.trim(),
      company_name: form.company_name.trim(),
      email:        form.email.trim().toLowerCase(),
      phone:        form.phone.trim(),
      address:      form.address.trim(),
      city:         form.city.trim(),
      state:        form.state.trim(),
    });

    if (result.success) return true;

    const mapped: Partial<Record<keyof InviteForm, string>> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof InviteForm | undefined;
      if (field && !mapped[field]) mapped[field] = issue.message;
    }
    setErrors(mapped);
    return false;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setServer('');
    createMut.mutate(
      {
        first_name:   form.first_name.trim(),
        middle_name:  form.middle_name.trim() || undefined,
        last_name:    form.last_name.trim(),
        company_name: form.company_name.trim(),
        email:        form.email.trim().toLowerCase(),
        phone:        form.phone.trim(),
        address:      form.address.trim(),
        city:         form.city.trim(),
        state:        form.state.trim(),
      },
      {
        onSuccess: (data) => {
          toast.show({
            tone:        'success',
            title:       'Invitation sent',
            description: `An activation email was sent to ${data.email}.`,
          });
          setForm(emptyInviteForm);
          onClose();
        },
        onError: (err: Error & { status?: number; fieldErrors?: Record<string, string[]> }) => {
          if (err.status === 409) {
            setErrors({ email: 'An account with this email already exists.' });
          } else if (err.status === 422 && err.fieldErrors && Object.keys(err.fieldErrors).length) {
            // Map server-side Zod errors back to form fields so users see exactly which cell is wrong
            const mapped: Partial<Record<keyof InviteForm, string>> = {};
            Object.entries(err.fieldErrors).forEach(([k, msgs]) => {
              if (msgs?.[0]) mapped[k as keyof InviteForm] = msgs[0];
            });
            setErrors(mapped);
            setServer('');
          } else {
            setServer(err.message ?? 'Could not send invitation. Please try again.');
          }
        },
      },
    );
  };

  const close = () => { setForm(emptyInviteForm); setErrors({}); setServer(''); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl flex-col rounded-2xl border border-line bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-line px-6 py-5">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">Add customer</h2>
            <p className="mt-0.5 text-sm text-ink-3">
              Enter their details. An invitation email with a one-time code will be sent
              so they can upload their PCN certificate and set a password.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={createMut.isPending}
            className="ml-4 rounded-lg p-1.5 text-ink-3 hover:bg-bg-muted hover:text-ink transition-colors"
          >
            <XCircle size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-4" style={{ maxHeight: '70vh' }}>
          {serverError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm text-red-800">{serverError}</p>
            </div>
          )}

          {/* Name row */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="First name" htmlFor="inv_first" required error={errors.first_name}>
              <Input id="inv_first" value={form.first_name} onChange={set('first_name')} placeholder="Chinedu" />
            </Field>
            <Field label="Middle name" htmlFor="inv_mid">
              <Input id="inv_mid" value={form.middle_name} onChange={set('middle_name')} placeholder="Optional" />
            </Field>
            <Field label="Last name" htmlFor="inv_last" required error={errors.last_name}>
              <Input id="inv_last" value={form.last_name} onChange={set('last_name')} placeholder="Okafor" />
            </Field>
          </div>

          {/* Company */}
          <Field label="Pharmacy / company name" htmlFor="inv_company" required error={errors.company_name}>
            <Input id="inv_company" value={form.company_name} onChange={set('company_name')} placeholder="Greenleaf Pharmacy Ltd." />
          </Field>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Work email" htmlFor="inv_email" required error={errors.email}>
              <Input id="inv_email" type="email" value={form.email} onChange={set('email')} placeholder="orders@pharmacy.ng" />
            </Field>
            <Field label="Phone" htmlFor="inv_phone" required hint="10–11 digits, e.g. 08012345678" error={errors.phone}>
              <Input
                id="inv_phone"
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setForm((f) => ({ ...f, phone: digits }));
                }}
                placeholder="08012345678"
              />
            </Field>
          </div>

          {/* Address */}
          <Field label="Street address" htmlFor="inv_addr" required error={errors.address}>
            <Input id="inv_addr" value={form.address} onChange={set('address')} placeholder="No 33, Allen Avenue, Ikeja" />
          </Field>

          {/* City + State */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" htmlFor="inv_city" required error={errors.city}>
              <Input id="inv_city" value={form.city} onChange={set('city')} placeholder="Lagos" />
            </Field>
            <Field label="State" htmlFor="inv_state" required error={errors.state}>
              <Select
                id="inv_state"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              >
                <option value="">Select state</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Info callout */}
          <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <Mail size={14} className="mt-0.5 shrink-0 text-blue-500" />
            <p className="text-xs leading-relaxed text-blue-800">
              After you submit, the customer will receive an invitation email with a 6-digit code.
              They&apos;ll click the link in the email to upload their PCN certificate, verify their email, and set a password.
              No further action is needed from you at this stage.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
          <Button type="button" variant="ghost" onClick={close} disabled={createMut.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={createMut.isPending}
            onClick={handleSubmit}
            trailingIcon={<Mail size={14} />}
          >
            Send invitation
          </Button>
        </div>
      </div>
    </div>
  );
}

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

/** Returns true when the Cloudinary URL is a raw/PDF upload. */
function isCldPdf(url: string): boolean {
  return url.includes('/raw/upload/') || /\.pdf(\?|$)/i.test(url);
}

/*
 * A client-side PDF thumbnail used to be built here by rewriting the delivery
 * URL. That's now done server-side and returned as `preview_url`, because these
 * URLs are **signed** — the signature covers the transformation string, so
 * inserting `pg_1,f_jpg` client-side invalidates it and Cloudinary 401s.
 * Only the server has the API secret needed to re-sign.
 */

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
  const [imgError,    setImgError]    = useState(false);
  // Deliverable URL for the PCN file, fetched once when the modal opens.
  // Going through the endpoint rather than using the stored URL directly is
  // what writes the "who viewed this licence" audit entry.
  const [signedUrl,   setSignedUrl]   = useState<string | null>(null);
  /** Server-signed page-1 JPEG. Renders even when PDF delivery is blocked. */
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);

  useEffect(() => {
    if (!customer?.id || !customer.pcn_certificate_url) return;
    fetch(`/api/customers/${customer.id}/pcn-url`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j: { data?: { url?: string; preview_url?: string } }) => {
        if (j.data?.url)         setSignedUrl(j.data.url);
        if (j.data?.preview_url) setPreviewUrl(j.data.preview_url);
      })
      .catch((e) => console.warn('[ReviewModal] Could not fetch PCN URL:', e));
  }, [customer?.id, customer?.pcn_certificate_url]);

  if (!customer) return null;

  const displayName = [customer.first_name, customer.last_name].filter(Boolean).join(' ');
  const pcnUrl      = customer.pcn_certificate_url ?? null;
  const isPdf       = pcnUrl ? isCldPdf(pcnUrl) : false;
  // Use the signed URL for viewing; the signed URL will also work for thumbnails
  const viewUrl     = signedUrl ?? pcnUrl;
  // Always prefer the server's signed preview — it renders whatever the source
  // format is, including PDFs that Cloudinary won't deliver directly.
  const thumbUrl    = previewUrl ?? viewUrl;

  const handleSubmit = () => {
    if (!notes.trim()) {
      setNotesError('Review notes are required for both approval and rejection.');
      return;
    }
    setNotesError('');
    reviewMut.mutate(
      { id: customer.id, decision, review_notes: notes.trim() },
      {
        onSuccess: (data: CustomerAdminRecord) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-4xl flex-col rounded-2xl border border-line bg-white shadow-2xl" style={{ maxHeight: '90vh' }}>

        {/* ── Fixed header ──────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">Review application</h2>
            <p className="mt-0.5 text-sm text-ink-3">
              Verify the PCN certificate, then approve or reject this pharmacy registration.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={reviewMut.isPending}
            aria-label="Close"
            className="ml-4 shrink-0 rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-bg-muted hover:text-ink"
          >
            <XCircle size={18} />
          </button>
        </div>

        {/* ── Scrollable body — two columns ─────────────────────────────── */}
        <div className="flex min-h-0 flex-1 overflow-hidden">

          {/* LEFT — customer details */}
          <aside className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-line bg-bg-subtle px-5 py-6">

            {/* Avatar + name + badge */}
            <div className="flex flex-col items-center gap-3 text-center">
              <Avatar name={customer.company_name ?? displayName} size={64} />
              <div>
                <p className="font-semibold text-ink">{displayName}</p>
                {customer.company_name && (
                  <p className="mt-0.5 text-sm text-ink-2">{customer.company_name}</p>
                )}
              </div>
              <RawStatusBadge status={customer.status} />
            </div>

            <hr className="border-line" />

            {/* Detail rows */}
            <dl className="space-y-3.5">
              {customer.email && (
                <div className="flex items-start gap-2.5">
                  <Mail size={14} className="mt-0.5 shrink-0 text-ink-3" />
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-4">Email</dt>
                    <dd className="break-all text-sm text-ink">{customer.email}</dd>
                  </div>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-start gap-2.5">
                  <Phone size={14} className="mt-0.5 shrink-0 text-ink-3" />
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-4">Phone</dt>
                    <dd className="text-sm text-ink">{customer.phone}</dd>
                  </div>
                </div>
              )}
              {(customer.address || customer.city || customer.state) && (
                <div className="flex items-start gap-2.5">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-ink-3" />
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-4">Address</dt>
                    <dd className="text-sm text-ink">
                      {[customer.address, customer.city, customer.state].filter(Boolean).join(', ')}
                    </dd>
                  </div>
                </div>
              )}
              {customer.company_name && (
                <div className="flex items-start gap-2.5">
                  <Building size={14} className="mt-0.5 shrink-0 text-ink-3" />
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-4">Pharmacy</dt>
                    <dd className="text-sm text-ink">{customer.company_name}</dd>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <Clock size={14} className="mt-0.5 shrink-0 text-ink-3" />
                <div className="min-w-0">
                  <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-4">Registered</dt>
                  <dd className="text-sm text-ink">{formatDate(customer.created_at)}</dd>
                </div>
              </div>
              {customer.referral_code && (
                <div className="flex items-start gap-2.5">
                  <Shield size={14} className="mt-0.5 shrink-0 text-ink-3" />
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-4">Ref. code</dt>
                    <dd className="font-mono text-xs text-ink">{customer.referral_code}</dd>
                  </div>
                </div>
              )}
            </dl>

            {/* Prior review note (if this was previously rejected and re-submitted) */}
            {customer.review_note && (
              <>
                <hr className="border-line" />
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                    Prior review note
                  </p>
                  <p className="text-xs text-amber-800 leading-relaxed">{customer.review_note}</p>
                  {customer.reviewed_by && (
                    <p className="mt-1.5 text-[10px] text-amber-500">by {customer.reviewed_by}</p>
                  )}
                </div>
              </>
            )}
          </aside>

          {/* RIGHT — PCN viewer + decision form */}
          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">

            {/* PCN Certificate viewer */}
            <section className="border-b border-line px-6 py-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <FileText size={15} className="text-brand-500" />
                  PCN Certificate
                </h3>
                {pcnUrl && (
                  <a
                    href={viewUrl ?? pcnUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-2 shadow-sm transition-all hover:border-brand-400 hover:text-brand-600"
                  >
                    Open full size <ArrowUpRight size={12} />
                  </a>
                )}
              </div>

              {!pcnUrl ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-bg-subtle text-center">
                  <FileText size={28} className="text-ink-4" />
                  <p className="text-sm text-ink-3">No certificate uploaded</p>
                </div>
              ) : isPdf && !imgError ? (
                /* PDF — show Cloudinary page-1 thumbnail */
                <div className="overflow-hidden rounded-xl border border-line bg-bg-subtle">
                  <img
                    src={thumbUrl!}
                    alt="PCN certificate preview"
                    onError={() => setImgError(true)}
                    className="mx-auto block max-h-72 w-full object-contain"
                  />
                  <div className="flex items-center gap-2 border-t border-line bg-white px-4 py-2.5">
                    <FileText size={13} className="text-ink-3" />
                    <span className="text-xs text-ink-3">PDF document · page 1 preview</span>
                  </div>
                </div>
              ) : !isPdf ? (
                /* Image */
                <div className="overflow-hidden rounded-xl border border-line bg-bg-subtle">
                  <img
                    src={thumbUrl!}
                    alt="PCN certificate"
                    className="mx-auto block max-h-72 w-full object-contain"
                  />
                </div>
              ) : (
                /* Thumbnail fetch failed — fallback link card */
                <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-line bg-bg-subtle">
                  <FileText size={28} className="text-ink-3" />
                  <p className="text-sm text-ink-3">Preview unavailable</p>
                  <a
                    href={viewUrl ?? pcnUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                  >
                    Open document <ArrowUpRight size={13} />
                  </a>
                </div>
              )}
            </section>

            {/* Decision + notes */}
            <div className="flex flex-1 flex-col gap-5 px-6 py-5">

              {/* Decision toggle */}
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Decision</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecision('APPROVE')}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all',
                      decision === 'APPROVE'
                        ? 'border-leaf-500 bg-leaf-50 text-leaf-700 shadow-sm'
                        : 'border-line bg-white text-ink-2 hover:border-leaf-300 hover:bg-leaf-50/50',
                    )}
                  >
                    <CheckCircle size={16} /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('REJECTED')}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all',
                      decision === 'REJECTED'
                        ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                        : 'border-line bg-white text-ink-2 hover:border-red-300 hover:bg-red-50/50',
                    )}
                  >
                    <XCircle size={16} /> Reject
                  </button>
                </div>

                {/* Contextual hint beneath buttons */}
                <p className="mt-2 text-xs text-ink-3">
                  {decision === 'APPROVE'
                    ? 'Approving will activate this account and notify the customer by email.'
                    : 'Rejecting will notify the customer with your reason below.'}
                </p>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="review-notes" className="mb-1.5 block text-sm font-semibold text-ink">
                  Review notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="review-notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); if (notesError) setNotesError(''); }}
                  placeholder={
                    decision === 'APPROVE'
                      ? 'e.g. PCN certificate verified — license number and expiry date confirmed.'
                      : 'e.g. PCN certificate is expired or the license number could not be verified.'
                  }
                  className={cn(
                    'w-full resize-none rounded-xl border bg-white px-4 py-3 text-sm placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-colors',
                    notesError ? 'border-red-400 focus:border-red-400' : 'border-line focus:border-brand-500',
                  )}
                />
                {notesError && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600">
                    <AlertTriangle size={12} /> {notesError}
                  </p>
                )}
                <p className="mt-1.5 text-xs text-ink-3">
                  Recorded in the audit log and sent to the customer. Required.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Fixed footer ──────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-t border-line bg-bg-subtle px-6 py-4">
          <p className="text-xs text-ink-4">
            {customer.pcn_verified ? (
              <span className="flex items-center gap-1 text-leaf-600">
                <CheckCircle size={12} /> PCN previously verified
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600">
                <Clock size={12} /> PCN not yet verified
              </span>
            )}
          </p>
          <div className="flex gap-2">
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
    </div>
  );
}

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

/**
 * Assign (or reassign) the sales rep who owns a customer account.
 *
 * Mirrors the driver-assignment flow on deliveries so the two feel identical.
 * Admin-only — the API enforces this too, this just avoids showing a control
 * that would fail.
 */
function AssignRepModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: CustomerAdminRecord;
  onClose:  () => void;
  onSaved:  () => void;
}) {
  const toast = useToast();
  const [staff,    setStaff]    = useState<AssignedStaff[]>([]);
  const [selected, setSelected] = useState<string>(customer.assigned_staff?.id.toString() ?? '');
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    // apiPaginated returns { data: { records, pagination } } — not `items`.
    fetch('/api/staff?role=STAFF&limit=200', { credentials: 'include' })
      .then(r => r.json())
      .then((j: { data?: { records?: AssignedStaff[] } }) => setStaff(j.data?.records ?? []))
      .catch(() => {/* leave the list empty; the empty state explains it */})
      .finally(() => setLoading(false));
  }, []);

  async function save(staffId: number | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/assign-staff`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        // API field is staff_user_id (the users.id, not a staff-table id).
        body:        JSON.stringify({ staff_user_id: staffId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'Could not update assignment.');
      toast.show({
        tone:  'success',
        title: staffId ? 'Rep assigned' : 'Assignment removed',
        description: `${customer.first_name} ${customer.last_name} updated.`,
      });
      onSaved();
      onClose();
    } catch (err) {
      toast.show({ tone: 'error', title: 'Failed', description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-ink">Assign sales rep</h2>
        <p className="mt-1 text-sm text-ink-3">
          {customer.company_name ?? `${customer.first_name} ${customer.last_name}`}
        </p>

        {customer.assigned_staff && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-bg-subtle px-3.5 py-2.5">
            <User size={13} className="shrink-0 text-ink-3" />
            <span className="text-sm text-ink-2">
              Currently&nbsp;
              <strong className="text-ink">
                {customer.assigned_staff.first_name} {customer.assigned_staff.last_name}
              </strong>
            </span>
          </div>
        )}

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">Assign to</span>
          {loading ? (
            <div className="h-10 animate-pulse rounded-xl bg-bg-muted" />
          ) : staff.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              No active staff accounts found. Invite a staff member first, and make
              sure they have verified their email.
            </p>
          ) : (
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">— Unassigned —</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.email})
                </option>
              ))}
            </select>
          )}
        </label>

        <div className="mt-5 flex items-center justify-between gap-2">
          {customer.assigned_staff ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => save(null)}
              className="rounded-xl px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
            >
              Remove assignment
            </button>
          ) : <span />}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || loading || staff.length === 0}
              onClick={() => save(selected ? Number(selected) : null)}
              className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {saving && <RotateCw size={13} className="animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerTable({
  records,
  isLoading,
  activeFilter,
  query,
  isAdmin,
  onReview,
  onReReview,
  onAssign,
}: {
  records: TaggedCustomerRecord[];
  isLoading: boolean;
  activeFilter: StageFilter;
  query: string;
  isAdmin: boolean;
  onReview: (c: CustomerAdminRecord) => void;
  onReReview: (c: CustomerAdminRecord, decision: 'APPROVE' | 'REJECTED') => void;
  onAssign: (c: CustomerAdminRecord) => void;
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

  // Reset to page 1 whenever the filter or search changes.
  // Uses React's "adjust state during render" pattern rather than mutating a
  // ref — refs must not be read or written during render, and doing so here
  // meant the reset could be skipped on a re-render React discarded.
  const [prevFilter, setPrevFilter] = useState(activeFilter);
  const [prevQuery,  setPrevQuery]  = useState(query);
  if (prevFilter !== activeFilter || prevQuery !== query) {
    setPrevFilter(activeFilter);
    setPrevQuery(query);
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
              {isAdmin && <Th>Assigned rep</Th>}
              <Th align="right">Actions</Th>
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

                {/* Assigned rep — admin only, mirrors the driver-assign control
                    on deliveries so the two flows feel the same. */}
                {isAdmin && (
                  <Td>
                    {c.assigned_staff ? (
                      <button
                        type="button"
                        onClick={() => onAssign(c)}
                        title="Change assigned rep"
                        className="inline-flex max-w-[11rem] items-center gap-1.5 rounded-lg border border-line bg-bg-subtle px-2.5 py-1 text-xs font-medium text-ink-2 transition-colors hover:border-brand-300 hover:text-brand-700"
                      >
                        <User size={11} className="shrink-0" />
                        <span className="truncate">
                          {c.assigned_staff.first_name} {c.assigned_staff.last_name}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAssign(c)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-100"
                      >
                        <User size={11} />
                        Assign rep
                      </button>
                    )}
                  </Td>
                )}

                {/* Actions */}
                <Td align="right">
                  <div className="flex items-center justify-end gap-2">
                    {/* View detail page — always visible */}
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-bg-subtle px-2.5 py-1.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-line transition-colors hover:bg-bg-muted hover:text-ink"
                      title="View full customer profile"
                    >
                      <Eye size={12} />
                      View
                    </Link>

                    {/* Stage-specific action */}
                    {c._stage === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => onReview(c)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 hover:border-brand-400"
                        title="Open review panel to verify PCN certificate"
                      >
                        Review
                      </button>
                    ) : c._stage === 'approved' && isAdmin ? (
                      <button
                        type="button"
                        onClick={() => onReReview(c, 'REJECTED')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-bg-subtle px-2.5 py-1.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-line transition-colors hover:bg-bg-muted hover:text-ink"
                        title="Re-review this customer"
                      >
                        Re-review
                      </button>
                    ) : c._stage === 'rejected' && isAdmin ? (
                      <button
                        type="button"
                        onClick={() => onReReview(c, 'APPROVE')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-bg-subtle px-2.5 py-1.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-line transition-colors hover:bg-bg-muted hover:text-ink"
                        title="Reconsider this application"
                      >
                        Reconsider
                      </button>
                    ) : null}
                  </div>
                </Td>
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

const CUSTOMER_REQUIRED = ['first_name', 'last_name', 'email', 'phone', 'company_name', 'address', 'city', 'state'] as const;
const CUSTOMER_OPTIONAL = ['middle_name', 'referral_code'] as const;
const CUSTOMER_ALL_COLS = [...CUSTOMER_REQUIRED, ...CUSTOMER_OPTIONAL] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\d{10,11}$/;

/** Download a CSV template with the exact columns the server expects. */
function downloadCustomerTemplate() {
  const headers = CUSTOMER_ALL_COLS.join(',');
  const sample  = 'Jane,Okafor,jane.okafor@greenleafpharm.ng,08012345678,Greenleaf Pharmacy Ltd.,12 Allen Avenue Ikeja,Lagos,Lagos,A.,ENV2025';
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
      if (!cells[col]) errors.push(`${col}: required`);
    });
    if (cells.email  && !EMAIL_RE.test(cells.email))  errors.push('email: invalid format');
    if (cells.phone  && !PHONE_RE.test(cells.phone))  errors.push('phone: must be 10–11 digits');

    return { index: i, cells, errors, valid: errors.length === 0 };
  });
}

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
      onSuccess: (data: CustomerBulkResult) => {
        const hasFails = data.failed > 0;
        toast.show({
          tone: hasFails ? 'warning' : 'success',
          title: hasFails ? `${data.successful}/${data.total_records} imported` : `${data.successful} customers imported`,
          description: hasFails
            ? `${data.failed} row(s) were rejected by the server.`
            : 'All records inserted successfully.',
        });
        if (hasFails) {
          setServerFails((data.failed_records ?? []) as Parameters<typeof setServerFails>[0]);
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
                      first_name · last_name · email · phone · company_name · address · city · state
                    </p>
                    <p className="mt-2 text-xs font-medium text-ink-2">Optional</p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-3 leading-relaxed">
                      middle_name · referral_code
                    </p>
                    <p className="mt-2 text-[10px] text-ink-4">
                      Each row receives an invitation email with a setup link. Max 1,000 rows per file.
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
                        <th className="px-3 py-2.5">Company</th>
                        <th className="px-3 py-2.5">Email</th>
                        <th className="px-3 py-2.5">Phone</th>
                        <th className="px-3 py-2.5">Address</th>
                        <th className="px-3 py-2.5">City / State</th>
                        <th className="px-3 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((row) => (
                        <tr key={row.index} className={cn('border-t border-line align-top', !row.valid && 'bg-red-50/40')}>
                          <td className="px-3 py-2.5 text-xs text-ink-3">{row.index + 1}</td>

                          {/* Name */}
                          <td className="px-3 py-2.5 text-xs">
                            <span className={cn(!row.cells.first_name || !row.cells.last_name ? 'text-red-600' : 'text-ink')}>
                              {[row.cells.first_name, row.cells.middle_name, row.cells.last_name].filter(Boolean).join(' ') || <span className="italic text-red-400">missing</span>}
                            </span>
                          </td>

                          {/* Company */}
                          <td className="px-3 py-2.5 text-xs">
                            <span className={cn(!row.cells.company_name ? 'text-red-500 italic' : 'text-ink')}>
                              {row.cells.company_name || 'missing'}
                            </span>
                          </td>

                          {/* Email */}
                          <td className="px-3 py-2.5 text-xs">
                            <span className={cn(!row.cells.email || !EMAIL_RE.test(row.cells.email) ? 'text-red-600' : 'text-ink')}>
                              {row.cells.email || <span className="italic text-red-400">missing</span>}
                            </span>
                          </td>

                          {/* Phone */}
                          <td className="px-3 py-2.5 text-xs">
                            <span className={cn(!row.cells.phone || !PHONE_RE.test(row.cells.phone) ? 'text-red-500' : 'text-ink')}>
                              {row.cells.phone || <span className="italic text-red-400">missing</span>}
                            </span>
                          </td>

                          {/* Address */}
                          <td className="max-w-[140px] truncate px-3 py-2.5 text-xs text-ink-2">
                            <span className={cn(!row.cells.address ? 'italic text-red-400' : '')}>
                              {row.cells.address || 'missing'}
                            </span>
                          </td>

                          {/* City / State */}
                          <td className="px-3 py-2.5 text-xs text-ink-2">
                            <span className={cn((!row.cells.city || !row.cells.state) ? 'text-red-500' : '')}>
                              {[row.cells.city, row.cells.state].filter(Boolean).join(', ') || <span className="italic text-red-400">missing</span>}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-3 py-2.5 text-right">
                            {row.valid ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-leaf-600">
                                <CheckCircle size={12} /> Valid
                              </span>
                            ) : (
                              <div className="flex flex-col items-end gap-0.5">
                                {row.errors.map((e, ei) => (
                                  <span key={ei} className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600">
                                    <AlertTriangle size={10} /> {e}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {preview.length > PREVIEW_LIMIT && (
                        <tr className="border-t border-line bg-bg-subtle">
                          <td colSpan={8} className="px-4 py-2.5 text-center text-xs text-ink-3">
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

export function CustomersView({ role }: { role: Role }) {
  const isAdmin = role === 'ADMIN';

  const [activeFilter,       setActiveFilter]       = useState<StageFilter>('all');
  const [query,              setQuery]              = useState('');
  const [onboard,            setOnboard]            = useState(false);
  const [importing,          setImporting]          = useState(false);
  const [reviewTarget,       setReviewTarget]       = useState<CustomerAdminRecord | null>(null);
  const [reviewInitDecision, setReviewInitDecision] = useState<'APPROVE' | 'REJECTED'>('APPROVE');
  const [assignTarget,       setAssignTarget]       = useState<CustomerAdminRecord | null>(null);

  const { allRecords, counts, isLoading, errors, refetchAll } = useAllCustomers();

  const totalCounts: Record<StageFilter, number> = {
    all: allRecords.length,
    ...counts,
  };

  const handleFilter = (f: StageFilter) => {
    setActiveFilter(f);
    setQuery('');
  };

  /**
   * Open review modal — no pre-selection so the admin reads the PCN before deciding.
   * Default decision shown is APPROVE (can be toggled inside the modal).
   */
  const handleReview = (c: CustomerAdminRecord) => {
    setReviewInitDecision('APPROVE');
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
        subtitle="Pharmacies registered with EnvolveCare Express."
        actions={
          <>
            <Button
              variant="secondary"
              leadingIcon={<Upload size={14} />}
              onClick={() => setImporting(true)}
            >
              Import
            </Button>
            <Button leadingIcon={<Plus size={14} />} onClick={() => setOnboard(true)}>
              Add customer
            </Button>
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
        onReview={handleReview}
        onReReview={handleReReview}
        onAssign={setAssignTarget}
      />

      {/* ── Assign sales rep modal ── */}
      {assignTarget && (
        <AssignRepModal
          customer={assignTarget}
          onClose={() => setAssignTarget(null)}
          onSaved={refetchAll}
        />
      )}

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

      {/* ── Add customer modal ── */}
      <InviteCustomerModal open={onboard} onClose={() => setOnboard(false)} />

      {/* ── Bulk upload modal ── */}
      <BulkUploadModal open={importing} onClose={() => setImporting(false)} />
    </>
  );
}
