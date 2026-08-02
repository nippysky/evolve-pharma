/**
 * POST /api/auth/staff/login
 *
 * Login for internal users: ADMIN, STAFF, DRIVER.
 * - Verifies email + password
 * - Role must be ADMIN | STAFF | DRIVER (customers are rejected here)
 * - User must be ACTIVE (not suspended)
 * - Issues JWT access + refresh tokens (httpOnly cookies + JSON body)
 * - Writes login history + audit log
 *
 * No auth required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z }                          from 'zod';
import bcrypt                         from 'bcryptjs';
import { db }                         from '@/lib/db';
import { setAuthCookies }             from '@/lib/auth';
import { writeLoginHistory, writeAuditLog } from '@/lib/audit';
import {
  apiError,
  apiInternalError,
} from '@/lib/api/response';
import { issueTokensForUser } from '@/lib/api/issue-tokens';

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  email:    z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Allowed roles for this endpoint ─────────────────────────────────────────

const STAFF_ROLES = new Set(['ADMIN', 'STAFF', 'DRIVER'] as const);

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const [field, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        errors[field] = msgs as string[];
      }
      return apiError('Please review the fields below.', 422, errors);
    }

    const { email, password } = parsed.data;

    // Find user
    const user = await db.user.findUnique({ where: { email } });

    // Generic error prevents user enumeration
    if (!user || !STAFF_ROLES.has(user.role as 'ADMIN' | 'STAFF' | 'DRIVER')) {
      void writeLoginHistory({ userType: 'STAFF', email, event: 'LOGIN_FAILED', req });
      return apiError('Invalid email or password.', 401);
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      void writeLoginHistory({
        userId:   user.id,
        userType: user.role,
        userName: `${user.first_name} ${user.last_name}`,
        email,
        event:    'LOGIN_FAILED',
        req,
      });
      return apiError('Invalid email or password.', 401);
    }

    // Gate: account status
    if (user.status === 'INACTIVE') {
      return apiError('Your account has not been activated. Contact your administrator.', 403);
    }

    if (user.status === 'SUSPENDED') {
      return apiError('Your account has been suspended. Contact your administrator.', 403);
    }

    // Issue tokens
    const { accessToken, refreshToken, authResponse } = await issueTokensForUser(user, req);

    // Write audit trail (fire-and-forget)
    void writeLoginHistory({
      userId:   user.id,
      userType: user.role,
      userName: `${user.first_name} ${user.last_name}`,
      email,
      event:    'LOGIN_SUCCESS',
      req,
    });
    void writeAuditLog({
      userId:      user.id,
      userType:    user.role,
      userName:    `${user.first_name} ${user.last_name}`,
      email,
      action:      'STAFF_LOGIN',
      description: `${user.role} signed in`,
      req,
    });

    // Build response with cookies
    const res = NextResponse.json({
      status:  'success',
      message: 'Signed in successfully.',
      data:    authResponse,
    });

    setAuthCookies(res, accessToken, refreshToken);
    return res;
  } catch (err) {
    console.error('[POST /api/auth/staff/login]', err);
    return apiInternalError();
  }
}
