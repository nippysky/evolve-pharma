/**
 * ENVOLVE PHARMACEUTICALS — Staff / Admin Auth Service
 *
 * All staff roles (ADMIN, STAFF, DRIVER) authenticate through a single
 * endpoint. The role field in the response is used to scope the session.
 *
 * Auth is cookie-based (withCredentials: true) — no manual token handling.
 */

import { adminApiClient } from '@/lib/api/client';
import { API_BASE_URL, AUTH, STAFF_ADMIN } from '@/lib/api/endpoints';
import type {
  LoginStaffPayload,
  LoginStaffResponse,
  RegisterStaffPayload,
  RegisterStaffResponse,
  StaffListResponse,
  BulkUploadStaffSuccess,
  ApiResponse,
  ApiSuccess,
  ApiError,
} from '@/lib/api/types';

// ---------- Helpers --------------------------------------------------------

function unwrap<T>(res: ApiResponse<T>): T {
  if (res.status !== 'success') {
    const err = new Error(res.message ?? 'Request failed');
    (err as Error & { fieldErrors?: Record<string, string[]> }).fieldErrors =
      (res as ApiError).errors;
    throw err;
  }
  return (res as ApiSuccess<T>).data;
}

// ---------- Staff login ----------------------------------------------------

/**
 * POST auth/login-staff
 * Admin, Staff, and Driver all use this endpoint.
 * Response includes `role: "ADMIN" | "STAFF" | "DRIVER"` — scope by that.
 */
export async function loginStaff(
  payload: LoginStaffPayload,
): Promise<LoginStaffResponse> {
  const { data } = await adminApiClient.post<ApiResponse<LoginStaffResponse>>(
    AUTH.LOGIN_STAFF,
    payload,
  );
  return unwrap(data);
}

// ---------- Staff register (admin-initiated) --------------------------------

/**
 * POST auth/staff/register
 * Admin creates a staff account; staff member gets email to verify & set password.
 * Error shape: { status:"error", error:{ message, code, details:{ field:[...] } } }
 * This is normalised by the Axios interceptor — thrown as a plain Error.
 */
export async function registerStaff(
  payload: RegisterStaffPayload,
): Promise<RegisterStaffResponse> {
  const { data } = await adminApiClient.post<ApiResponse<RegisterStaffResponse>>(
    STAFF_ADMIN.REGISTER,
    payload,
  );
  return unwrap(data);
}

// ---------- Staff bulk upload -----------------------------------------------

/**
 * POST staff/bulk-upload (multipart/form-data, key = "staff")
 * Success: { total_record_inserted, existing_emails, total_existing_record }
 *
 * WHY native fetch instead of Axios:
 * The Axios instance has a default Content-Type: application/json which
 * leaks through even for FormData requests, preventing the browser from
 * setting the correct multipart boundary → backend returns 400.
 * Native fetch with credentials:"include" handles FormData correctly.
 */
export async function bulkUploadStaff(
  file: File,
): Promise<BulkUploadStaffSuccess> {
  const fd = new FormData();
  fd.set('staff', file); // backend expects key = "staff"

  const res = await fetch(`${API_BASE_URL}${STAFF_ADMIN.BULK_UPLOAD}`, {
    method:      'POST',
    credentials: 'include',
    body:        fd,
    // No Content-Type — browser sets multipart/form-data; boundary=XXX automatically
  });

  const json = (await res.json()) as ApiResponse<BulkUploadStaffSuccess>;

  if (!res.ok && json.status !== 'success') {
    const msg = (json as ApiError).message ?? `Upload failed (${res.status})`;
    throw new Error(msg);
  }

  return unwrap(json);
}

// ---------- Staff lists -----------------------------------------------------

/** GET staff/verified — staff whose email is verified */
export async function listVerifiedStaff(): Promise<StaffListResponse> {
  const { data } = await adminApiClient.get<ApiResponse<StaffListResponse>>(
    STAFF_ADMIN.VERIFIED,
  );
  return unwrap(data);
}

/** GET staff/unverified — staff whose email has not yet been verified */
export async function listUnverifiedStaff(): Promise<StaffListResponse> {
  const { data } = await adminApiClient.get<ApiResponse<StaffListResponse>>(
    STAFF_ADMIN.UNVERIFIED,
  );
  return unwrap(data);
}
