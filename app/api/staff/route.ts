/**
 * GET  /api/staff — paginated staff list (Admin only)
 * POST /api/staff — invite a staff / driver member (Admin only)
 *
 * Staff invitation flow (per backend engineer spec):
 *   1. Admin fills in staff details — NO password required
 *   2. System creates User (INACTIVE) + Staff/Driver record (UNVERIFIED)
 *   3. Stores a UUID verification token in OtpToken (24-hour expiry)
 *   4. Sends staff-verify-email with a secure link
 *   5. Staff clicks link → /staff/verify?token=UUID → sets password → ACTIVE
 */

import { NextRequest }   from 'next/server';
import { z }             from 'zod';
import { v4 as uuidv4 }  from 'uuid';
import { db }            from '@/lib/db';
import { getSession }    from '@/lib/auth';
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
import { writeAuditLog }           from '@/lib/audit';
import { sendStaffVerificationEmail } from '@/lib/mail';
import type { UserRole, StaffVerificationStatus } from '@db/enums';

// ─── Validation ───────────────────────────────────────────────────────────────

const createSchema = z.object({
  first_name:  z.string().min(1).max(100),
  middle_name: z.string().max(100).optional(),
  last_name:   z.string().min(1).max(100),
  email:       z.email('Invalid email address'),
  phone:       z.string().max(20).optional(),
  gender:      z.string().max(20).optional(),
  department:    z.string().max(100).optional(),
  job_title:     z.string().max(100).optional(),
  role:          z.enum(['STAFF', 'DRIVER']).default('STAFF'),
  // Driver-specific (only used when role === 'DRIVER')
  vehicle_plate: z.string().max(30).optional(),
  vehicle_type:  z.string().max(100).optional(),
  region:        z.string().max(100).optional(),
  // employee_code auto-generated server-side
});

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp, { limit: 20 });

    const search       = sp.get('search') ?? '';
    const roleRaw      = sp.get('role');
    const verifyRaw    = sp.get('verification');

    const roleFilter:   UserRole | undefined = (roleRaw === 'STAFF' || roleRaw === 'DRIVER') ? roleRaw : undefined;
    const verification: StaffVerificationStatus | undefined =
      (verifyRaw === 'UNVERIFIED' || verifyRaw === 'VERIFIED') ? verifyRaw : undefined;

    const roleCondition: UserRole[] = roleFilter ? [roleFilter] : ['STAFF', 'DRIVER'];

    const where = {
      role: { in: roleCondition },
      ...(search ? {
        OR: [
          { first_name: { contains: search } },
          { last_name:  { contains: search } },
          { email:      { contains: search } },
        ],
      } : {}),
      ...(verification ? {
        staff: { verification_status: verification },
      } : {}),
    };

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take:    limit,
        include: {
          staff:  true,
          driver: true,
        },
      }),
      db.user.count({ where }),
    ]);

    const records = (users as any[]).map((u) => ({
      id:                  u.id,
      uuid:                u.uuid,
      first_name:          u.first_name,
      last_name:           u.last_name,
      email:               u.email,
      phone:               u.phone,
      role:                u.role,
      status:              u.status,
      avatar_url:          u.avatar_url,
      created_at:          u.created_at,
      employee_code:       u.staff?.employee_code ?? u.driver?.employee_code ?? null,
      department:          u.staff?.department   ?? null,
      job_title:           u.staff?.job_title    ?? null,
      verification_status: u.staff?.verification_status ?? null,
      driver_status:       u.driver?.driver_status ?? null,
      vehicle_plate:       u.driver?.vehicle_plate  ?? null,
      vehicle_type:        u.driver?.vehicle_type   ?? null,
    }));

    return apiPaginated(records, { page, limit, total }, 'Staff retrieved successfully');
  } catch (err) {
    console.error('[GET /api/staff]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const [field, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        errors[field] = msgs as string[];
      }
      return apiError('Please review the fields below.', 422, errors);
    }

    const { first_name, middle_name, last_name, email, phone, gender, department, job_title, role, vehicle_plate, vehicle_type, region } = parsed.data;

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) return apiError('An account with this email already exists.', 409);

    // Auto-generate employee code: ROLE-TIMESTAMP-RANDOM
    const timestamp    = Date.now().toString(36).toUpperCase();
    const random       = Math.random().toString(36).substring(2, 5).toUpperCase();
    const employee_code = `${role.slice(0, 2)}-${timestamp}-${random}`;

    // Verification UUID token (stored in OtpToken, 24-hour expiry)
    const verifyToken = uuidv4();
    const expiresAt   = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await db.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          first_name,
          middle_name,
          last_name,
          email,
          phone,
          gender,
          // Password will be set after email verification
          password_hash: 'UNSET',
          role,
          // INACTIVE until they verify email and set password
          status: 'INACTIVE',
        },
      });

      if (role === 'STAFF') {
        await tx.staff.create({
          data: {
            user_id:             newUser.id,
            employee_code,
            department,
            job_title,
            // UNVERIFIED until they click the verification link
            verification_status: 'UNVERIFIED',
          },
        });
      } else if (role === 'DRIVER') {
        await tx.driver.create({
          data: {
            user_id:       newUser.id,
            employee_code,
            vehicle_plate: vehicle_plate ?? null,
            vehicle_type:  vehicle_type  ?? null,
            driver_status: 'AVAILABLE',
          },
        });
      }

      // Store verification token
      await tx.otpToken.create({
        data: {
          user_id:    newUser.id,
          token:      verifyToken,
          type:       'EMAIL_VERIFICATION',
          expires_at: expiresAt,
        },
      });

      return newUser;
    });

    // Send verification email (fire-and-forget)
    const frontendUrl       = process.env.FRONTEND_URL ?? 'https://www.envolvepharm.com.ng';
    const verificationUrl   = `${frontendUrl}/staff/verify?token=${verifyToken}`;

    void sendStaffVerificationEmail({
      to:              email,
      name:            first_name,
      verificationUrl,
    }).catch((e) => console.error('[staff/create] verification email failed:', e));

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'CREATE_STAFF',
      entityType:  'User',
      entityId:    String(user.id),
      description: `Invited ${role.toLowerCase()} ${first_name} ${last_name} (${email}) — verification email sent`,
      req,
    });

    return apiSuccess(
      { user: { id: user.id, email: user.email, employee_code } },
      201,
      'Staff member invited. A verification email has been sent.',
    );
  } catch (err) {
    console.error('[POST /api/staff]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
