import { NextRequest } from 'next/server';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
  handlePrismaError,
} from '@/lib/api/response';

export async function GET(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id < 1) return apiError('Invalid customer ID', 400);

    const c = await db.customer.findFirst({
      where: { id },
      include: {
        user: {
          select: {
            id:                true,
            uuid:              true,
            first_name:        true,
            last_name:         true,
            email:             true,
            phone:             true,
            status:            true,
            avatar_url:        true,
            email_verified_at: true,
            created_at:        true,
          },
        },
        reviewed_by: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
        // The sales rep who owns this account. Read through the relation — this
        // used to be a raw SELECT plus a second lookup, on the grounds that the
        // column wasn't in the generated client yet. It is: `assigned_staff` is
        // declared in schema.prisma, so one include replaces two queries.
        assigned_staff: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!c) return apiError('Customer not found.', 404);

    return apiSuccess({
      // Customer record
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
      // Assigned staff
      assigned_staff:      c.assigned_staff,
      // Flattened user
      user: {
        id:                c.user.id,
        uuid:              c.user.uuid,
        first_name:        c.user.first_name,
        last_name:         c.user.last_name,
        email:             c.user.email,
        phone:             c.user.phone,
        status:            c.user.status,
        avatar_url:        c.user.avatar_url,
        email_verified_at: c.user.email_verified_at,
        created_at:        c.user.created_at,
      },
      reviewed_by: c.reviewed_by
        ? {
            id:         c.reviewed_by.id,
            name:       `${c.reviewed_by.first_name} ${c.reviewed_by.last_name}`,
            email:      c.reviewed_by.email,
          }
        : null,
      order_count: c._count.orders,
    }, 200, 'Customer retrieved successfully.');
  } catch (err) {
    console.error('[GET /api/customers/[id]]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
