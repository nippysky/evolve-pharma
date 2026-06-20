'use client';

import { useMemo, useState, useRef } from 'react';
import Link from 'next/link';
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
} from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Avatar, EmptyState } from '@/components/ui/Primitives';
import { TableWrap, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { PageHead } from '@/components/shared/PageHead';
import { CreateEntityModal, type EntityField } from './CreateEntityModal';
import { useToast } from '@/contexts/ToastContext';
import {
  useCustomerAdminList,
  useReviewCustomer,
  useBulkUploadCustomers,
} from '@/hooks/staff/useStaff';
import { formatDate, cn } from '@/lib/utils';
import type { Role } from '@/types';
import type { CustomerAdminRecord } from '@/lib/api/types';

// ---------- Onboard form fields (admin creates customer directly) -----------

const ONBOARD_FIELDS: EntityField[] = [
  { name: 'first_name',   label: 'Contact first name',        required: true,  placeholder: 'Chinedu' },
  { name: 'middle_name',  label: 'Middle name',                                placeholder: 'Optional' },
  { name: 'last_name',    label: 'Contact last name',          required: true,  placeholder: 'Okafor' },
  { name: 'company_name', label: 'Pharmacy / company name',    required: true,  placeholder: 'Greenleaf Pharmacy Ltd.', full: true },
  { name: 'email',        label: 'Work email',    type: 'email', required: true, placeholder: 'orders@pharmacy.ng' },
  { name: 'phone',        label: 'Phone',         type: 'tel',   required: true, placeholder: '+234 800 000 0000' },
  { name: 'address',      label: 'Street address',              required: true,  placeholder: '12 Lagos St., Wuse 2', full: true },
  { name: 'city',         label: 'City',                        required: true,  placeholder: 'Abuja' },
  { name: 'state',        label: 'State',                       required: true,  placeholder: 'FCT' },
];

// ---------- Tab config ------------------------------------------------------

type Stage = 'pending' | 'registered' | 'unverified' | 'verified';

const TABS: { value: Stage; label: string; desc: string }[] = [
  { value: 'pending',    label: 'Pending review', desc: 'Awaiting admin approval' },
  { value: 'verified',   label: 'Verified',       desc: 'Email + password created' },
  { value: 'unverified', label: 'Unverified',     desc: 'PCN uploaded, unverified' },
  { value: 'registered', label: 'Registered',     desc: 'Email not yet verified' },
];

// ---------- Status badge helper --------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === 'APPROVED')
    return <span className="inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2 py-0.5 text-xs font-medium text-leaf-700"><CheckCircle size={10} /> Approved</span>;
  if (s === 'PENDING_REVIEW')
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"><Clock size={10} /> Pending</span>;
  if (s === 'REJECTED')
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"><XCircle size={10} /> Rejected</span>;
  if (s === 'PCN_CERT_UPLOADED')
    return <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700"><Shield size={10} /> PCN uploaded</span>;
  if (s === 'OTP_CONFIRMED' || s === 'EMAIL_VERIFIED_PASSWORD_CREATED')
    return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"><CheckCircle size={10} /> Verified</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-bg-muted px-2 py-0.5 text-xs font-medium text-ink-3">{status.replace(/_/g, ' ')}</span>;
}

// ---------- Review buttons (pending tab only) --------------------------------

function ReviewButtons({ customerId, onDone }: { customerId: string | number; onDone: () => void }) {
  const toast       = useToast();
  const reviewMut   = useReviewCustomer();
  const [noteOpen, setNoteOpen]   = useState(false);
  const [noteText, setNoteText]   = useState('');
  const pending = reviewMut.isPending;

  const act = (action: 'approve' | 'reject') => {
    reviewMut.mutate(
      { id: customerId, action, review_notes: noteText || undefined },
      {
        onSuccess: (data) => {
          toast.show({
            tone: action === 'approve' ? 'success' : 'info',
            title: action === 'approve' ? 'Customer approved' : 'Application rejected',
            description: `Status updated to ${data.status}.`,
          });
          setNoteOpen(false);
          setNoteText('');
          onDone();
        },
        onError: (err: Error) => {
          toast.show({ tone: 'error', title: 'Action failed', description: err.message });
        },
      },
    );
  };

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => act('approve')}
          className="rounded-md bg-success-soft px-2.5 py-1 text-xs font-semibold text-green-800 transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {pending ? 'Working…' : 'Approve'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setNoteOpen((o) => !o)}
          className="rounded-md bg-danger-soft px-2.5 py-1 text-xs font-semibold text-red-800 transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          Reject
        </button>
      </div>
      {noteOpen && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Rejection reason (optional)"
            className="h-7 flex-1 rounded border border-line bg-white px-2 text-xs placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => act('reject')}
            className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Customer table --------------------------------------------------

function CustomerTable({
  records,
  query,
  isAdmin,
  showReview,
  onReviewDone,
}: {
  records: CustomerAdminRecord[];
  query: string;
  isAdmin: boolean;
  showReview: boolean;
  onReviewDone: () => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.company_name ?? '').toLowerCase().includes(q) ||
        (r.phone ?? '').includes(q),
    );
  }, [records, query]);

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={<Building size={24} />}
        title={query ? 'No customers match' : 'No customers in this group'}
        description={query ? 'Try a different search term.' : 'Nothing here yet.'}
      />
    );
  }

  return (
    <TableWrap>
      <Table>
        <Thead>
          <tr>
            <Th>Name / company</Th>
            <Th>Contact</Th>
            <Th>Status</Th>
            <Th>Registered</Th>
            {showReview && isAdmin && <Th>Actions</Th>}
          </tr>
        </Thead>
        <Tbody>
          {filtered.map((c) => (
            <Tr key={c.id}>
              <Td>
                <div className="flex items-center gap-2.5">
                  <Avatar name={c.company_name ?? `${c.first_name} ${c.last_name}`} />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">
                      {c.first_name} {c.last_name}
                    </div>
                    {c.company_name && (
                      <div className="mt-0.5 truncate text-xs text-ink-3">{c.company_name}</div>
                    )}
                  </div>
                </div>
              </Td>
              <Td>
                <div className="text-sm text-ink">{c.email}</div>
                <div className="text-xs text-ink-3">{c.phone}</div>
              </Td>
              <Td>
                <StatusBadge status={c.status} />
              </Td>
              <Td muted>{formatDate(c.created_at)}</Td>
              {showReview && isAdmin && (
                <Td>
                  <ReviewButtons customerId={c.id} onDone={onReviewDone} />
                </Td>
              )}
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableWrap>
  );
}

// ---------- Stage panel (fetches its own data) ------------------------------

function StagePanel({
  stage,
  query,
  isAdmin,
}: {
  stage: Stage;
  query: string;
  isAdmin: boolean;
}) {
  const { data, isLoading, isError, error, refetch } = useCustomerAdminList(stage);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <span className="ml-3 text-sm text-ink-3">Loading customers…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-danger-soft px-4 py-3 text-sm text-red-800">
        <AlertTriangle size={14} className="shrink-0" />
        <span>{(error as Error).message ?? 'Failed to load customers.'}</span>
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

  const records = data?.records ?? [];

  return (
    <>
      <p className="mb-3 text-xs text-ink-3">
        {data?.total ?? 0} customer{(data?.total ?? 0) !== 1 ? 's' : ''}
      </p>
      <CustomerTable
        records={records}
        query={query}
        isAdmin={isAdmin}
        showReview={stage === 'pending'}
        onReviewDone={() => refetch()}
      />
    </>
  );
}

// ---------- Bulk upload modal -----------------------------------------------

function BulkUploadModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast     = useToast();
  const uploadMut = useBulkUploadCustomers();
  const inputRef  = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  if (!open) return null;

  const submit = () => {
    if (!file) return;
    uploadMut.mutate(file, {
      onSuccess: (data) => {
        const hasFails = data.failed > 0;
        toast.show({
          tone: hasFails ? 'warning' : 'success',
          title: hasFails
            ? `${data.successful}/${data.total_records} imported`
            : `${data.successful} customers imported`,
          description: hasFails
            ? `${data.failed} row(s) failed — check the details below.`
            : 'All records inserted successfully.',
        });
        if (!hasFails) onClose();
      },
      onError: (err: Error) => {
        toast.show({ tone: 'error', title: 'Upload failed', description: err.message });
      },
    });
  };

  const result = uploadMut.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold tracking-tight text-ink">Import customers</h2>
        <p className="mt-1 text-sm text-ink-3">
          Upload an Excel (.xlsx) file. Each row must have first_name, last_name, email, phone,
          company_name, address, city, state.
        </p>

        <div
          className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-bg-subtle py-8 transition-colors hover:border-brand-400"
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={20} className="text-ink-3" />
          <p className="text-sm text-ink-2">
            {file ? file.name : 'Click to choose a file'}
          </p>
          {file && (
            <p className="text-xs text-ink-3">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {/* Partial-failure report */}
        {result && result.failed > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-xs font-semibold text-amber-800">
              Failed rows ({result.failed})
            </p>
            <ul className="space-y-1">
              {result.failed_records.map((r, i) => (
                <li key={i} className="text-xs text-amber-700">
                  Row {r.row} — {r.email}: {r.errors.join(', ')}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={uploadMut.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={uploadMut.isPending}
            disabled={!file}
            onClick={submit}
          >
            Upload
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Main view -------------------------------------------------------

export function CustomersView({ role }: { role: Role }) {
  const isAdmin = role === 'admin';
  const [activeTab, setActiveTab] = useState<Stage>('pending');
  const [query, setQuery]         = useState('');
  const [onboard, setOnboard]     = useState(false);
  const [importing, setImporting] = useState(false);

  return (
    <>
      <PageHead
        title="Customers"
        subtitle="Pharmacies that have registered with Envolve."
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

      {/* Tabs + search bar */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="inline-flex rounded-md bg-bg-muted p-0.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => { setActiveTab(t.value); setQuery(''); }}
              title={t.desc}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === t.value
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-ink-2 hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-sm flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, company"
            aria-label="Search customers"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Active tab panel */}
      <StagePanel stage={activeTab} query={query} isAdmin={isAdmin} />

      {/* Onboard modal (placeholder — wired to real API in a future task) */}
      <CreateEntityModal
        open={onboard}
        onClose={() => setOnboard(false)}
        title="Add a customer"
        description="Create the pharmacy account. They will receive an email to verify and set their password."
        fields={ONBOARD_FIELDS}
        schema={undefined as never}
        action={async () => ({ ok: false as const, message: 'Direct onboarding coming soon. Use bulk import for now.' })}
        submitLabel="Create & invite"
        successTitle="Customer onboarded"
        size="xl"
      />

      {/* Bulk upload modal */}
      <BulkUploadModal open={importing} onClose={() => setImporting(false)} />
    </>
  );
}
