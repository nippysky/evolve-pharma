/**
 * POST /api/auth/customer/login
 *
 * Customer sign-in (CUSTOMER role only).
 * - Verifies email + password
 * - Enforces account status gates (must be email-verified, not rejected)
 * - Issues JWT access + refresh tokens (httpOnly cookies + JSON body)
 * - Writes login history
 *
 * No auth required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z }                          from 'zod';
import bcrypt                         from 'bcryptjs';
import { db }                         from '@/lib/db';
import { setAuthCookies }             from '@/lib/auth';
import { writeLoginHistory }          from '@/lib/audit';
import {
  apiError,
  apiInternalError,
  handlePrismaError,
} from '@/lib/api/response';
import { issueTokensForUser } from '@/lib/api/issue-tokens';

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  email:    z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip        = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? undefined;
  const userAgent = req.headers.get('user-agent') ?? undefined;

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

    // Find user with customer sub-profile
    const user = await db.user.findUnique({
      where:   { email },
      include: { customer: { select: { status: true } } },
    });

    // Generic error to avoid user enumeration
    if (!user || user.role !== 'CUSTOMER') {
      void writeLoginHistory({
        userType: 'CUSTOMER',
        email,
        event: 'LOGIN_FAILED',
        req,
      });
      return apiError('Invalid email or password.', 401);
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      void writeLoginHistory({
        userId:   user.id,
        userType: 'CUSTOMER',
        userName: `${user.first_name} ${user.last_name}`,
        email,
        event:    'LOGIN_FAILED',
        req,
      });
      return apiError('Invalid email or password.', 401);
    }

    // Gate: email must be verified
    if (user.status === 'INACTIVE') {
      return apiError('Please verify your email before signing in. Check your inbox for the code.', 403);
    }

    if (user.status === 'SUSPENDED') {
      return apiError('Your account has been suspended. Please contact support.', 403);
    }

    // Gate: customer-specific status
    const customerStatus = user.customer?.status;
    if (customerStatus === 'PENDING_REVIEW' || customerStatus === 'OTP_CONFIRMED' || customerStatus === 'REGISTERED') {
      return apiError('Your account is pending review by our team. You will receive an email once approved.', 403);
    }
    if (customerStatus === 'REJECTED') {
      return apiError('Your account application has been rejected. Contact support for more information.', 403);
    }

    // Issue tokens
    const { accessToken, refreshToken, authResponse } = await issueTokensForUser(user, req);

    // Write login history (fire-and-forget)
    void writeLoginHistory({
      userId:   user.id,
      userType: 'CUSTOMER',
      userName: `${user.first_name} ${user.last_name}`,
      email,
      event:    'LOGIN_SUCCESS',
      req,
    });

    // Set cookies + return JSON body (JSON body for mobile clients)
    const res = NextResponse.json({
      status:  'success',
      message: 'Signed in successfully.',
      data:    authResponse,
    });

    setAuthCookies(res, accessToken, refreshToken);
    return res;
  } catch (err) {
    console.error('[POST /api/auth/customer/login]', err);
    return handlePrismaError(err) ?? apiInternalError();
    // Log the failed attempt
    void writeLoginHistory({
      userType: 'CUSTOMER',
      event:    'LOGIN_FAILED',
      req: { headers: { get: (h: string) => h === 'x-forwarded-for' ? (ip ?? null) : h === 'user-agent' ? (userAgent ?? null) : null } } as unknown as import('next/server').NextRequest,
    });
    return apiInternalError();
  }
}
