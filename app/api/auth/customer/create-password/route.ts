/**
 * POST /api/auth/customer/create-password
 *
 * Final step of password-reset flow:
 *   1. Verify the PASSWORD_RESET OTP for the given email
 *   2. Hash + store the new password
 *   3. Mark OTP as used
 *   4. Revoke all existing refresh tokens for this user (security hygiene)
 *
 * Also used when a customer first sets their password after being bulk-imported
 * without a password (admin-created accounts).
 *
 * No auth required.
 */

import { NextRequest } from 'next/server';
import { z }           from 'zod';
import bcrypt          from 'bcryptjs';
import { db }          from '@/lib/db';
import {
  apiSuccess,
  apiError,
  apiInternalError,
} from '@/lib/api/response';

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  email:    z.email('Invalid email address'),
  otp:      z.string().length(6).regex(/^\d+$/),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

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

    const { email, otp, password } = parsed.data;

    // Find user + their valid PASSWORD_RESET OTP
    const user = await db.user.findUnique({
      where:  { email },
      select: {
        id:        true,
        role:      true,
        otpTokens: {
          where: {
            type:       'PASSWORD_RESET',
            used_at:    null,
            expires_at: { gt: new Date() },
          },
          orderBy: { created_at: 'desc' },
          take:    1,
        },
      },
    });

    if (!user || user.role !== 'CUSTOMER') {
      return apiError('Invalid or expired reset code.', 400);
    }

    const otpRecord = user.otpTokens[0];
    if (!otpRecord || otpRecord.token !== otp) {
      return apiError('Invalid or expired reset code.', 400);
    }

    // Hash new password
    const password_hash = await bcrypt.hash(password, 12);

    await db.$transaction(async (tx: any) => {
      // Update password
      await tx.user.update({
        where: { id: user.id },
        data:  { password_hash },
      });

      // Mark OTP as used
      await tx.otpToken.update({
        where: { id: otpRecord.id },
        data:  { used_at: new Date() },
      });

      // Revoke all refresh tokens — force re-login on all devices
      await tx.refreshToken.deleteMany({ where: { user_id: user.id } });
    });

    return apiSuccess(
      { email },
      200,
      'Password updated successfully. You can now sign in.',
    );
  } catch (err) {
    console.error('[POST /api/auth/customer/create-password]', err);
    return apiInternalError();
  }
}
