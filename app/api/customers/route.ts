import { NextRequest } from 'next/server';
import { z }           from 'zod';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import { sendCustomerInvitationEmail } from '@/lib/mail';
import { generateOtp }                 from '@/lib/api/issue-tokens';
import { customerOnboardSchema }       from '@/lib/schemas';
import { revalidateCustomers }         from '@/lib/revalidate';
import {
  apiSuccess,
  apiPaginated,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
  handlePrismaError,
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
    return handlePrismaError(err) ?? apiInternalError();
  }
}

/** 48-hour OTP expiry for admin-generated invitations. */
function inviteOtpExpiresAt(): Date {
  return new Date(Date.now() + 48 * 60 * 60 * 1000);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    // Validate with the shared onboard schema (same fields as admin add-customer form)
    const parsed = customerOnboardSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const [f, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        fieldErrors[f] = msgs as string[];
      }
      return apiError('Please review the fields below.', 422, fieldErrors);
    }

    const {
      first_name, middle_name, last_name,
      company_name, email, phone,
      address, city, state,
    } = parsed.data;

    // Duplicate email guard
    const existing = await db.user.findUnique({
      where:  { email: email.toLowerCase() },
      select: { id: true },
    });
    if (existing) return apiError('An account with this email already exists.', 409);

    // Generate referral code, OTP
    const referralCode = 'ENV' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const otp          = generateOtp();
    const otpExpiresAt = inviteOtpExpiresAt();

    // Create User + Customer + OTP in one transaction
    const { user, customer } = await db.$transaction(async (tx: any) => {
      const u = await tx.user.create({
        data: {
          first_name,
          middle_name: middle_name ?? null,
          last_name,
          email:         email.toLowerCase(),
          phone:         phone ?? null,
          password_hash: 'UNSET',
          role:          'CUSTOMER',
          status:        'INACTIVE',
        },
      });

      const c = await tx.customer.create({
        data: {
          user_id:      u.id,
          company_name,
          address,
          city,
          state,
          referral_code: referralCode,
          status:        'REGISTERED',
        },
      });

      await tx.otpToken.create({
        data: {
          user_id:    u.id,
          token:      otp,
          type:       'EMAIL_VERIFICATION',
          expires_at: otpExpiresAt,
        },
      });

      return { user: u, customer: c };
    });

    // Build invite URL
    const siteUrl   = process.env.FRONTEND_URL ?? 'https://www.envolvepharm.com.ng';
    const inviteUrl = `${siteUrl}/sign-up/invited?email=${encodeURIComponent(email.toLowerCase())}`;

    // Fire invitation email (non-blocking — record is already persisted)
    void sendCustomerInvitationEmail({
      to:          email.toLowerCase(),
      name:        first_name,
      companyName: company_name,
      inviteUrl,
    }).catch((e) => console.error('[POST /api/customers] Invitation email failed:', e));

    revalidateCustomers();
    return apiSuccess(
      {
        customer_id: customer.id,
        user_id:     user.id,
        email:       email.toLowerCase(),
        invite_url:  inviteUrl,
      },
      201,
      'Customer created. An invitation email has been sent.',
    );
  } catch (err) {
    console.error('[POST /api/customers]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
