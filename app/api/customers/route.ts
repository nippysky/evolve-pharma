/**
 * GET /api/customers — paginated customer list (Admin/Staff)
 *
 * Query params:
 *   page, limit
 *   status     — REGISTERED | OTP_CONFIRMED | PCN_CERT_UPLOADED | PENDING_REVIEW | APPROVED | REJECTED
 *   search     — name, email, company_name
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

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp, { limit: 20 });

    const statusFilter = sp.get('status') as string | null;
    const search       = sp.get('search') ?? '';

    const validStatuses = ['REGISTERED','OTP_CONFIRMED','PCN_CERT_UPLOADED','PENDING_REVIEW','APPROVED','REJECTED'];

    const where = {
      user: {
        role: 'CUSTOMER' as const,
        ...(search ? {
          OR: [
            { first_name:   { contains: search } },
            { last_name:    { contains: search } },
            { email:        { contains: search } },
          ],
        } : {}),
      },
      ...(statusFilter && validStatuses.includes(statusFilter)
        ? { status: statusFilter as 'REGISTERED' | 'OTP_CONFIRMED' | 'PCN_CERT_UPLOADED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' }
        : {}),
      ...(search ? {
        OR: [
          { company_name: { contains: search } },
        ],
      } : {}),
    };

    const [records, total] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take:    limit,
        include: {
          user: {
            select: {
              id:         true,
              first_name: true,
              last_name:  true,
              email:      true,
              phone:      true,
              status:     true,
              avatar_url: true,
              created_at: true,
            },
          },
          reviewed_by: {
            select: { first_name: true, last_name: true, email: true },
          },
        },
      }),
      db.customer.count({ where }),
    ]);

    const customers = records.map(c => ({
      id:                  c.id,
      uuid:                c.uuid,
      company_name:        c.company_name,
      address:             c.address,
      city:                c.city,
      state:               c.state,
      pcn_certificate_url: c.pcn_certificate_url,
      pcn_verified:        c.pcn_verified,
      status:              c.status,
      referral_code:       c.referral_code,
      referred_by:         c.referred_by,
      review_note:         c.review_note,
      reviewed_at:         c.reviewed_at,
      created_at:          c.created_at,
      updated_at:          c.updated_at,
      user: {
        id:         c.user.id,
        first_name: c.user.first_name,
        last_name:  c.user.last_name,
        email:      c.user.email,
        phone:      c.user.phone,
        status:     c.user.status,
        avatar_url: c.user.avatar_url,
        created_at: c.user.created_at,
      },
      reviewed_by: c.reviewed_by
        ? `${c.reviewed_by.first_name} ${c.reviewed_by.last_name}`
        : null,
    }));

    return apiPaginated(customers, { page, limit, total }, 'Customers retrieved successfully');
  } catch (err) {
    console.error('[GET /api/customers]', err);
    return apiInternalError();
  }
}
