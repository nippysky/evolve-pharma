/**
 * POST /api/auth/customer/reset-password
 *
 * Final step of the forgot-password flow.
 * Verifies the 6-digit PASSWORD_RESET OTP and sets the new password.
 *
 * Body: { email, otp_code, new_password }
 *
 * Returns 200 on success — client redirects to /sign-in.
 * No auth required.
 */

import { NextRequest }       from 'next/server';
import { z }                 from 'zod';
import bcrypt                from 'bcryptjs';
import { db }                from '@/lib/db';
import {
  apiSuccess,
  apiError,
  apiInternalError,
  handlePrismaError,
} from '@/lib/api/response';

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  email: z.email('Please enter a valid email address.'),
  otp_code: z
    .string()
    .length(6, 'The code must be exactly 6 digits.')
    .regex(/^\d+$/, 'The code must contain digits only.'),
  new_password: z
    .string()
    .min(8,  'Password must be at least 8 characters.')
    .max(128, 'Password must not exceed 128 characters.'),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid request body. Please try again.', 400); }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const [f, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        errors[f] = msgs as string[];
      }
      return apiError('Please review the fields below.', 422, errors);
    }

    const { email, otp_code, new_password } = parsed.data;

    // Find user with a valid, unused PASSWORD_RESET OTP
    const user = await db.user.findUnique({
      where:  { email },
      select: {
        id:     true,
        role:   true,
        status: true,
        otpTokens: {
          where: {
            type:       'PASSWORD_RESET',
            used_at:    null,
            expires_at: { gt: new Date() },
          },
          orderBy: { created_at: 'desc' },
          take:    1,
          select:  { id: true, token: true },
        },
      },
    });

    // Generic error — prevents email enumeration
    if (!user || user.role !== 'CUSTOMER') {
      return apiError(
        'No active reset request was found for this email. Please request a new reset code.',
        400,
      );
    }

    if (user.status === 'SUSPENDED') {
      return apiError(
        'Your account has been suspended. Please contact support for assistance.',
        403,
      );
    }

    const otp = user.otpTokens[0];

    if (!otp) {
      return apiError(
        'Your reset code has expired or was already used. Please request a new one.',
        400,
      );
    }

    if (otp.token !== otp_code) {
      return apiError(
        'Incorrect reset code. Please double-check the code in your email and try again.',
        400,
      );
    }

    // Hash + save new password, mark OTP as used
    const password_hash = await bcrypt.hash(new_password, 12);

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data:  { password_hash },
      }),
      db.otpToken.update({
        where: { id: otp.id },
        data:  { used_at: new Date() },
      }),
      // Invalidate all other unused PASSWORD_RESET OTPs for this user
      db.otpToken.updateMany({
        where: {
          user_id: user.id,
          type:    'PASSWORD_RESET',
          used_at: null,
        },
        data: { used_at: new Date() },
      }),
    ]);

    return apiSuccess(
      { email },
      200,
      'Password reset successfully. You can now sign in with your new password.',
    );
  } catch (err) {
    console.error('[POST /api/auth/customer/reset-password]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
