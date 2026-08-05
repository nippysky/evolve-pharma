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

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'ADMIN') return apiForbidden();

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp, { limit: 20 });

    const userType   = sp.get('user_type')   as string | null;
    const action     = sp.get('action')      ?? '';
    const entityType = sp.get('entity_type') ?? '';
    const search     = sp.get('search')      ?? '';
    const from       = sp.get('from');
    const to         = sp.get('to');

    const validTypes = ['ADMIN','STAFF','DRIVER','CUSTOMER'];

    const where = {
      ...(userType && validTypes.includes(userType) ? { user_type: userType } : {}),
      ...(action      ? { action:      { contains: action      } } : {}),
      ...(entityType  ? { entity_type: { contains: entityType  } } : {}),
      ...(from || to  ? { created_at:  { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      ...(search ? {
        OR: [
          { email:     { contains: search } },
          { user_name: { contains: search } },
        ],
      } : {}),
    };

    const [records, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take:    limit,
      }),
      db.auditLog.count({ where }),
    ]);

    return apiPaginated(records, { page, limit, total }, 'Audit logs retrieved successfully');
  } catch (err) {
    console.error('[GET /api/admin/audit-logs]', err);
    return apiInternalError();
  }
}
