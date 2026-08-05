import { useQuery } from '@tanstack/react-query';
import {
  getLoginHistory,
  getAuditLogs,
  type LoginHistoryFilters,
  type AuditLogFilters,
} from '@/lib/api/services/admin.service';

export const ADMIN_LOG_KEYS = {
  loginHistory: (page: number, limit: number, f: LoginHistoryFilters) =>
    ['admin', 'login-history', page, limit, f] as const,
  auditLogs: (page: number, limit: number, f: AuditLogFilters) =>
    ['admin', 'audit-logs', page, limit, f] as const,
};

export function useLoginHistory(
  page    = 1,
  limit   = 20,
  filters: LoginHistoryFilters = {},
) {
  return useQuery({
    queryKey: ADMIN_LOG_KEYS.loginHistory(page, limit, filters),
    queryFn:  () => getLoginHistory(page, limit, filters),
    staleTime: 30_000,
  });
}

export function useAuditLogs(
  page    = 1,
  limit   = 20,
  filters: AuditLogFilters = {},
) {
  return useQuery({
    queryKey: ADMIN_LOG_KEYS.auditLogs(page, limit, filters),
    queryFn:  () => getAuditLogs(page, limit, filters),
    staleTime: 30_000,
  });
}
