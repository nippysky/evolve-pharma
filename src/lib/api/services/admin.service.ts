/**
 * Admin Service — client-side stubs
 *
 * Will call /api/admin/* routes implemented in Module 7.
 * Stubs return empty/typed values so the TypeScript graph compiles cleanly.
 */

import type { LoginHistoryDTO, AuditLogDTO, PaginatedResponse } from '@/lib/api/types';

// ─── Login history ────────────────────────────────────────────────────────────

export async function getLoginHistory(
  _page  = 1,
  _limit = 10,
): Promise<PaginatedResponse<LoginHistoryDTO>> {
  // Module 7 — will call GET /api/admin/login-history
  return {
    records:    [],
    pagination: { current_page: 1, per_page: _limit, total: 0, total_pages: 0 },
  };
}

// ─── Audit logs ───────────────────────────────────────────────────────────────

export async function getAuditLogs(
  _page  = 1,
  _limit = 20,
): Promise<PaginatedResponse<AuditLogDTO>> {
  // Module 7 — will call GET /api/admin/audit-logs
  return {
    records:    [],
    pagination: { current_page: 1, per_page: _limit, total: 0, total_pages: 0 },
  };
}
