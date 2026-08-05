import type { LoginHistoryDTO, AuditLogDTO, PaginatedResponse } from '@/lib/api/types';

async function apiFetch<T>(path: string): Promise<T> {
  const res  = await fetch(path, { credentials: 'include' });
  const json = await res.json() as { data?: T; message?: string };
  if (!res.ok) throw new Error(json.message ?? 'Request failed.');
  return json.data as T;
}

function buildQS(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export interface LoginHistoryFilters {
  user_type?: string;
  event?:     string;
  search?:    string;
  from?:      string;
  to?:        string;
}

export interface AuditLogFilters {
  user_type?:   string;
  action?:      string;
  entity_type?: string;
  search?:      string;
  from?:        string;
  to?:          string;
}

export async function getLoginHistory(
  page    = 1,
  limit   = 20,
  filters: LoginHistoryFilters = {},
): Promise<PaginatedResponse<LoginHistoryDTO>> {
  const qs = buildQS({ page, limit, ...filters });
  return apiFetch<PaginatedResponse<LoginHistoryDTO>>(`/api/admin/login-history${qs}`);
}

export async function getAuditLogs(
  page    = 1,
  limit   = 20,
  filters: AuditLogFilters = {},
): Promise<PaginatedResponse<AuditLogDTO>> {
  const qs = buildQS({ page, limit, ...filters });
  return apiFetch<PaginatedResponse<AuditLogDTO>>(`/api/admin/audit-logs${qs}`);
}
