/**
 * Customers service — real API calls
 * All functions call Next.js API routes; httpOnly cookies are sent automatically.
 */

import type { CustomerAdminRecord, CustomerStatus } from '@/lib/api/types';

interface ListResponse<T> { records: T[]; total: number }

type CustomerStage = 'pending' | 'registered' | 'unverified' | 'verified' | 'approved' | 'rejected';

// Stage → CustomerStatus (follows the customer lifecycle)
const STAGE_TO_STATUS: Record<CustomerStage, CustomerStatus> = {
  registered: 'REGISTERED',
  unverified: 'OTP_CONFIRMED',
  verified:   'PCN_CERT_UPLOADED',
  pending:    'PENDING_REVIEW',
  approved:   'APPROVED',
  rejected:   'REJECTED',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res  = await fetch(path, { credentials: 'include', ...init });
  const json = await res.json();
  if (!res.ok) {
    const err: Error & { status?: number; fieldErrors?: Record<string, string[]> } =
      new Error(json?.message ?? 'Request failed. Please try again.');
    err.status      = res.status;
    err.fieldErrors = json?.errors;
    throw err;
  }
  return json?.data as T;
}

/** Flatten the API's nested `{ user: { … }, … }` shape into CustomerAdminRecord. */
function mapRecord(raw: Record<string, unknown>): CustomerAdminRecord {
  const user = (raw.user ?? {}) as Record<string, unknown>;

  // reviewed_by may come back as a nested object { first_name, last_name } or a plain string
  let reviewedBy: string | null | undefined = undefined;
  if (raw.reviewed_by && typeof raw.reviewed_by === 'object') {
    const rb = raw.reviewed_by as Record<string, unknown>;
    reviewedBy = [rb.first_name, rb.last_name].filter(Boolean).join(' ') || null;
  } else {
    reviewedBy = raw.reviewed_by as string | null | undefined;
  }

  return {
    id:                   raw.id                                      as number,
    uuid:                 (raw.uuid                                   as string | null | undefined),
    user_id:              ((user.id ?? raw.user_id)                  as number),
    company_name:         (raw.company_name                          as string | null | undefined),
    address:              (raw.address                               as string | null | undefined),
    city:                 (raw.city                                  as string | null | undefined),
    state:                (raw.state                                 as string | null | undefined),
    status:               (raw.status                                as CustomerStatus),
    referral_code:        (raw.referral_code                         as string | null | undefined),
    review_note:          (raw.review_note                           as string | null | undefined),
    reviewed_by:          reviewedBy,
    reviewed_at:          (raw.reviewed_at                           as string | null | undefined),
    pcn_verified:         Boolean(raw.pcn_verified),
    pcn_certificate_url:  (raw.pcn_certificate_url                   as string | null | undefined),
    first_name:           ((user.first_name ?? raw.first_name)       as string),
    last_name:            ((user.last_name  ?? raw.last_name)        as string),
    email:                ((user.email      ?? raw.email)            as string),
    phone:                ((user.phone      ?? raw.phone)            as string | null | undefined),
    created_at:           (raw.created_at                            as string),
  };
}

// ─── Exported service functions ───────────────────────────────────────────────

export async function listCustomersByStage(
  stage: CustomerStage,
): Promise<ListResponse<CustomerAdminRecord>> {
  const status = STAGE_TO_STATUS[stage];
  const data   = await apiFetch<{
    records:    Record<string, unknown>[];
    pagination: { total: number };
  }>(`/api/customers?status=${status}&limit=200`);

  return {
    records: (data.records ?? []).map(mapRecord),
    total:   data.pagination?.total ?? data.records?.length ?? 0,
  };
}

export async function reviewCustomer(
  id: number,
  action: 'approve' | 'reject',
  note?: string,
): Promise<CustomerAdminRecord> {
  const data = await apiFetch<{ customer_id: number; status: CustomerStatus }>(
    `/api/customers/${id}/review`,
    {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ decision: action, review_note: note }),
    },
  );
  // Return a minimal record — callers refetch the list after a successful review.
  return {
    id,
    user_id:      0,
    status:       data.status,
    pcn_verified: false,
    first_name:   '',
    last_name:    '',
    email:        '',
    created_at:   new Date().toISOString(),
  };
}

export async function bulkUploadCustomers(file: File): Promise<{
  total_records:  number;
  successful:     number;
  failed:         number;
  failed_records: Array<{ row: number; email?: string; errors: string[] }>;
}> {
  const fd = new FormData();
  fd.append('file', file);

  const res  = await fetch('/api/customers/bulk', { credentials: 'include', method: 'POST', body: fd });
  const json = await res.json();
  if (!res.ok) {
    const err: Error & { status?: number } = new Error(json?.message ?? 'Bulk import failed.');
    err.status = res.status;
    throw err;
  }
  return json?.data as ReturnType<typeof bulkUploadCustomers> extends Promise<infer T> ? T : never;
}

// ─── Admin — create single customer ──────────────────────────────────────────

export interface CreateCustomerInput {
  first_name:    string;
  last_name:     string;
  middle_name?:  string;
  company_name:  string;
  email:         string;
  phone:         string;
  address:       string;
  city:          string;
  state:         string;
  referral_code?: string;
}

export interface CreateCustomerResult {
  customer_id: number;
  user_id:     number;
  email:       string;
  invite_url:  string;
}

export async function createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
  return apiFetch<CreateCustomerResult>('/api/customers', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  });
}
