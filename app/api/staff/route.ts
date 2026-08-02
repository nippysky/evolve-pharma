/**
 * GET  /api/staff — paginated staff list (Admin only)
 * POST /api/staff — create a single staff member (Admin only)
 */

import { NextRequest }   from 'next/server';
import { z }             from 'zod';
import bcrypt            from 'bcryptjs';
import { db }            from '@/lib/db';
import { getSession }    from '@/lib/auth';
import {
  apiSuccess,
  apiPaginated,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
  parsePagination,
} from '@/lib/api/response';
import { writeAuditLog } from '@/lib/audit';
import type { UserRole, StaffVerificationStatus } from '@db/enums';

// ─── Validation ───────────────────────────────────────────────────────────────

const createSchema = z.object({
  first_name:    z.string().min(1).max(100),
  last_name:     z.string().min(1).max(100),
  email:         z.email('Invalid email address'),
  phone:         z.string().max(20).optional(),
  department:    z.string().max(100).optional(),
  job_title:     z.string().max(100).optional(),
  employee_code: z.string().min(1).max(50),
  role:          z.enum(['STAFF', 'DRIVER']).default('STAFF'),
  password:      z.string().min(8, 'Password must be at least 8 characters'),
});

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'ADMIN') return apiForbidden();

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

    // Cast to any[] — Prisma includes are typed at the query level; map accesses are safe
    const records = (users as any[]).map((u) => ({
      id:           u.id,
      uuid:         u.uuid,
      first_name:   u.first_name,
      last_name:    u.last_name,
      email:        u.email,
      phone:        u.phone,
      role:         u.role,
      status:       u.status,
      avatar_url:   u.avatar_url,
      created_at:   u.created_at,
      employee_code:      u.staff?.employee_code ?? u.driver?.employee_code ?? null,
      department:         u.staff?.department   ?? null,
      job_title:          u.staff?.job_title    ?? null,
      verification_status:u.staff?.verification_status ?? null,
      driver_status:      u.driver?.driver_status ?? null,
    }));

    return apiPaginated(records, { page, limit, total }, 'Staff retrieved successfully');
  } catch (err) {
    console.error('[GET /api/staff]', err);
    return apiInternalError();
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'ADMIN') return apiForbidden();

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

    const { first_name, last_name, email, phone, department, job_title, employee_code, role, password } = parsed.data;

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) return apiError('An account with this email already exists.', 409);

    const password_hash = await bcrypt.hash(password, 12);

    const user = await db.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          first_name,
          last_name,
          email,
          phone,
          password_hash,
          role,
          status: 'ACTIVE',
          email_verified_at: new Date(),
        },
      });

      if (role === 'STAFF') {
        await tx.staff.create({
          data: {
            user_id:             newUser.id,
            employee_code,
            department,
            job_title,
            verification_status: 'VERIFIED',
          },
        });
      } else if (role === 'DRIVER') {
        await tx.driver.create({
          data: {
            user_id:       newUser.id,
            employee_code,
            driver_status: 'AVAILABLE',
          },
        });
      }

      return newUser;
    });

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'CREATE_STAFF',
      entityType:  'User',
      entityId:    String(user.id),
      description: `Created ${role.toLowerCase()} account for ${first_name} ${last_name} (${email})`,
      req,
    });

    return apiSuccess({ user: { id: user.id, email: user.email } }, 201, 'Staff member created successfully');
  } catch (err) {
    console.error('[POST /api/staff]', err);
    return apiInternalError();
  }
}
