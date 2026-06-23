/**
 * ENVOLVE PHARMACEUTICALS — Admin Logs Hooks
 *
 * TanStack Query hooks for login history and audit logs.
 */

import { useQuery } from '@tanstack/react-query';
import { getLoginHistory, getAuditLogs } from '@/lib/api/services/admin.service';

// ---------- Query key factory -----------------------------------------------

export const ADMIN_LOG_KEYS = {
  loginHistory: (page: number, limit: number) =>
    ['admin', 'login-history', page, limit] as const,
  auditLogs: (page: number, limit: number) =>
    ['admin', 'audit-logs', page, limit] as const,
};

// ---------- Login history ---------------------------------------------------

/**
 * Fetches paginated login history.
 * @param page  1-indexed page number
 * @param limit Records per page (default 10)
 */
export function useLoginHistory(page = 1, limit = 10) {
  return useQuery({
    queryKey: ADMIN_LOG_KEYS.loginHistory(page, limit),
    queryFn: () => getLoginHistory(page, limit),
    staleTime: 60 * 1000, // 1 minute — audit data is semi-static
  });
}

// ---------- Audit logs ------------------------------------------------------

/**
 * Fetches paginated audit logs.
 * @param page  1-indexed page number
 * @param limit Records per page (default 20)
 */
export function useAuditLogs(page = 1, limit = 20) {
  return useQuery({
    queryKey: ADMIN_LOG_KEYS.auditLogs(page, limit),
    queryFn: () => getAuditLogs(page, limit),
    staleTime: 60 * 1000,
  });
}
