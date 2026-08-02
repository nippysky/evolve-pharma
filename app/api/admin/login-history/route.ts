/**
 * GET /api/admin/login-history
 *
 * Paginated login history (Admin only).
 *
 * Query params:
 *   page, limit
 *   user_type  — CUSTOMER | STAFF | DRIVER | ADMIN
 *   event      — LOGIN_SUCCESS | LOGIN_FAILED | LOGOUT | TOKEN_REFRESHED
 *   search     — email or user_name
 *   from, to   — date range
 */

import { NextRequest } from 'next/server';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiPaginated,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
  parsePagination,
} from '@/lib/api/response';
import type { LoginEvent } from '@db/enums';

const VALID_TYPES  = ['CUSTOMER','STAFF','DRIVER','ADMIN'] as const;
const VALID_EVENTS: LoginEvent[] = ['LOGIN_SUCCESS','LOGIN_FAILED','LOGOUT','TOKEN_REFRESHED'];

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'ADMIN') return apiForbidden();

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp, { limit: 20 });

    const userTypeRaw = sp.get('user_type');
    const eventRaw    = sp.get('event');
    const search      = sp.get('search') ?? '';
    const from        = sp.get('from');
    const to          = sp.get('to');

    const userType = (userTypeRaw && (VALID_TYPES as readonly string[]).includes(userTypeRaw))
      ? userTypeRaw
      : undefined;

    const event = (eventRaw && VALID_EVENTS.includes(eventRaw as LoginEvent))
      ? eventRaw as LoginEvent
      : undefined;

    const where = {
      ...(userType ? { user_type: userType } : {}),
      ...(event    ? { event }               : {}),
      ...(from || to ? {
        created_at: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to)   } : {}),
        },
      } : {}),
      ...(search ? {
        OR: [
          { email:     { contains: search } },
          { user_name: { contains: search } },
        ],
      } : {}),
    };

    const [records, total] = await Promise.all([
      db.loginHistory.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take:    limit,
      }),
      db.loginHistory.count({ where }),
    ]);

    return apiPaginated(records, { page, limit, total }, 'Login history retrieved successfully');
  } catch (err) {
    console.error('[GET /api/admin/login-history]', err);
    return apiInternalError();
  }
}
