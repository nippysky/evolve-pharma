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
import { writeAuditLog }              from '@/lib/audit';
import { sendStaffVerificationEmail } from '@/lib/mail';
import { revalidateStaff }            from '@/lib/revalidate';
import type { UserRole, StaffVerificationStatus } from '@db/enums';

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
  // Driver-specific
  vehicle_plate: z.string().max(30).optional(),
  vehicle_type:  z.string().max(100).optional(),
  region:        z.string().max(100).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp, { limit: 20 });

    const search    = sp.get('search') ?? '';
    const roleRaw   = sp.get('role');
    const verifyRaw = sp.get('verification');

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

    // User rows (no includes)
    const rawUsers = await db.user.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
      select: {
        id: true, uuid: true, first_name: true, last_name: true,
        email: true, phone: true, role: true, status: true,
        avatar_url: true, created_at: true,
      },
    });

    // Total count
    const total = await db.user.count({ where });

    if (rawUsers.length === 0) {
      return apiPaginated([], { page, limit, total }, 'Staff retrieved successfully');
    }

    const userIds = rawUsers.map(u => u.id);

    // Staff records (batch)
    const staffRecords = await db.staff.findMany({
      where:  { user_id: { in: userIds } },
      select: {
        user_id: true, employee_code: true, department: true,
        job_title: true, verification_status: true,
      },
    });

    // Driver records (batch)
    const driverRecords = await db.driver.findMany({
      where:  { user_id: { in: userIds } },
      select: {
        id: true, user_id: true, employee_code: true, driver_status: true,
        vehicle_plate: true, vehicle_type: true,
      },
    });

    // ── Merge in JS ───────────────────────────────────────────────────────────
    const staffMap  = new Map(staffRecords.map(s  => [s.user_id,  s]));
    const driverMap = new Map(driverRecords.map(d => [d.user_id, d]));

    const records = rawUsers.map(u => {
      const staff  = staffMap.get(u.id);
      const driver = driverMap.get(u.id);
      return {
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
        employee_code:       staff?.employee_code  ?? driver?.employee_code  ?? null,
        department:          staff?.department     ?? null,
        job_title:           staff?.job_title      ?? null,
        verification_status: staff?.verification_status ?? null,
        driver_status:       driver?.driver_status  ?? null,
        vehicle_plate:       driver?.vehicle_plate  ?? null,
        vehicle_type:        driver?.vehicle_type   ?? null,
        // driver_record_id is the driver TABLE primary key (needed for delivery assignment)
        // distinct from user.id which is the user TABLE id
        driver_record_id:    driver?.id ?? null,
      };
    });

    return apiPaginated(records, { page, limit, total }, 'Staff retrieved successfully');
  } catch (err) {
    console.error('[GET /api/staff]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}

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

    const {
      first_name, middle_name, last_name, email, phone, gender,
      department, job_title, role, vehicle_plate, vehicle_type,
    } = parsed.data;

    // Email uniqueness check
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return apiError('An account with this email already exists.', 409);

    // Auto-generate employee code: ROLE_PREFIX-TIMESTAMP-RANDOM
    const timestamp     = Date.now().toString(36).toUpperCase();
    const random        = Math.random().toString(36).substring(2, 5).toUpperCase();
    const employee_code = `${role.slice(0, 2)}-${timestamp}-${random}`;

    // Verification token (24-hour expiry)
    const verifyToken = uuidv4();
    const expiresAt   = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const newUser = await db.user.create({
      data: {
        first_name, middle_name, last_name, email, phone, gender,
        password_hash: 'UNSET',
        role,
        status: 'INACTIVE',
      },
    });

    // Create staff/driver record + OTP token (sequential, manual rollback)
    // Can't use batch transaction here because user.id is only known after step 2.
    try {
      if (role === 'STAFF') {
        await db.staff.create({
          data: {
            user_id:             newUser.id,
            employee_code,
            department,
            job_title,
            verification_status: 'UNVERIFIED',
          },
        });
      } else {
        await db.driver.create({
          data: {
            user_id:       newUser.id,
            employee_code,
            vehicle_plate: vehicle_plate ?? null,
            vehicle_type:  vehicle_type  ?? null,
            driver_status: 'AVAILABLE',
          },
        });
      }

      await db.otpToken.create({
        data: {
          user_id:    newUser.id,
          token:      verifyToken,
          type:       'EMAIL_VERIFICATION',
          expires_at: expiresAt,
        },
      });
    } catch (innerErr) {
      // Rollback: delete the user so no orphan records are left
      await db.user.delete({ where: { id: newUser.id } }).catch(() => {});
      throw innerErr;
    }

    // Send verification email — must be awaited before returning.
    // Vercel freezes the Lambda the moment the response is sent; fire-and-forget
    // promises are killed before the SMTP handshake completes.
    const frontendUrl     = process.env.FRONTEND_URL ?? 'https://www.envolvepharm.com.ng';
    const verificationUrl = `${frontendUrl}/staff/verify?token=${verifyToken}`;

    try {
      await sendStaffVerificationEmail({
        to:   email,
        name: first_name,
        verificationUrl,
      });
    } catch (mailErr) {
      // Log but don't fail the request — the staff record is created and the
      // admin can resend the invite manually if needed.
      console.error('[staff/create] verification email failed:', mailErr);
    }

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'CREATE_STAFF',
      entityType:  'User',
      entityId:    String(newUser.id),
      description: `Invited ${role.toLowerCase()} ${first_name} ${last_name} (${email}) — verification email sent`,
      req,
    });

    revalidateStaff();
    return apiSuccess(
      { user: { id: newUser.id, email: newUser.email, employee_code } },
      201,
      'Staff member invited. A verification email has been sent.',
    );
  } catch (err) {
    console.error('[POST /api/staff]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
