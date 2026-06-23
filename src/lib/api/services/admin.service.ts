/**
 * ENVOLVE PHARMACEUTICALS — Admin Logs Service
 *
 * Login history and audit logs for the admin dashboard.
 * Auth is cookie-based — cookies sent automatically by Axios (withCredentials: true).
 */

import apiClient from '@/lib/api/client';
import { ADMIN_LOGS } from '@/lib/api/endpoints';
import type {
  LoginHistoryResponse,
  AuditLogsResponse,
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

// ---------- Login history --------------------------------------------------

/**
 * GET admin/login-history?page=1&limit=10
 * Returns paginated login events (success + failure) for all user types.
 */
export async function getLoginHistory(
  page = 1,
  limit = 10,
): Promise<LoginHistoryResponse> {
  const { data } = await apiClient.get<ApiResponse<LoginHistoryResponse>>(
    `${ADMIN_LOGS.LOGIN_HISTORY}?page=${page}&limit=${limit}`,
  );
  return unwrap(data);
}

// ---------- Audit logs -----------------------------------------------------

/**
 * GET admin/logs?page=1&limit=20
 * Returns paginated audit trail of all admin/staff/customer actions.
 */
export async function getAuditLogs(
  page = 1,
  limit = 20,
): Promise<AuditLogsResponse> {
  const { data } = await apiClient.get<ApiResponse<AuditLogsResponse>>(
    `${ADMIN_LOGS.AUDIT_LOGS}?page=${page}&limit=${limit}`,
  );
  return unwrap(data);
}
