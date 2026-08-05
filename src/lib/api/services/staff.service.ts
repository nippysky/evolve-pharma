import type {
  LoginStaffPayload,
  RegisterStaffPayload,
  SessionUser,
  StaffRecord,
  DriverRecord,
  StaffBulkUploadResult,
} from '@/lib/api/types';

interface ListResponse<T> { records: T[]; total: number }

async function apiFetch<T>(
  path:    string,
  init?:   RequestInit,
  isBlob = false,
): Promise<T> {
  const res  = await fetch(path, { credentials: 'include', ...init });
  if (isBlob) return res.blob() as unknown as T;
  const json = await res.json();
  if (!res.ok) {
    const err: Error & { fieldErrors?: Record<string, string[]>; status?: number } =
      new Error(json?.message ?? 'Request failed');
    if (json?.errors) err.fieldErrors = json.errors;
    err.status = res.status;
    throw err;
  }
  return json?.data as T;
}

/**
 * Authenticates a staff member (ADMIN | STAFF | DRIVER).
 * Returns `{ status, role, email }` mapped from the API's `data.user`.
 * Cookies (`ep_access`, `ep_refresh`) are set by the server automatically.
 */
export async function loginStaff(
  payload: LoginStaffPayload,
): Promise<{ status: string; role: string; email: string }> {
  const res  = await fetch('/api/auth/staff/login', {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'include',
    body:        JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    const err: Error & { status?: number } = new Error(
      json?.message ?? 'Sign in failed. Please check your credentials and try again.',
    );
    err.status = res.status;
    throw err;
  }
  const user: SessionUser = json.data.user;
  return {
    status: user.status,
    role:   user.role,
    email:  user.email,
  };
}

/**
 * Invite a staff member — sends a verification email with a 24-hour link.
 * No password required; the staff member sets it when they click the link.
 */
export async function registerStaff(
  payload: RegisterStaffPayload,
): Promise<{ user: { id: number; email: string; employee_code: string } }> {
  const res  = await fetch('/api/staff', {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'include',
    body:        JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    const err: Error & { fieldErrors?: Record<string, string[]>; status?: number } =
      new Error(json?.message ?? 'Failed to invite staff member. Please try again.');
    if (json?.errors) err.fieldErrors = json.errors;
    err.status = res.status;
    throw err;
  }
  return json.data;
}

/**
 * Bulk upload staff from an XLSX / CSV file.
 */
export async function bulkUploadStaff(file: File): Promise<StaffBulkUploadResult> {
  const fd = new FormData();
  fd.append('file', file);
  const res  = await fetch('/api/staff/bulk-upload?force_role=STAFF', {
    method:      'POST',
    credentials: 'include',
    body:        fd,
  });
  const json = await res.json();
  if (!res.ok) {
    const err: Error & { uploadResult?: StaffBulkUploadResult; status?: number } =
      new Error(json?.message ?? 'Bulk upload failed. Please try again.');
    // Partial success — some rows may have been inserted
    if (json?.data) err.uploadResult = json.data;
    err.status = res.status;
    throw err;
  }
  return json.data as StaffBulkUploadResult;
}

export async function listVerifiedStaff(): Promise<ListResponse<StaffRecord>> {
  return apiFetch<ListResponse<StaffRecord>>('/api/staff?verification=VERIFIED&limit=200');
}

export async function listUnverifiedStaff(): Promise<ListResponse<StaffRecord>> {
  return apiFetch<ListResponse<StaffRecord>>('/api/staff?verification=UNVERIFIED&limit=200');
}

export async function listDrivers(): Promise<ListResponse<DriverRecord>> {
  return apiFetch<ListResponse<DriverRecord>>('/api/staff?role=DRIVER&limit=500');
}
