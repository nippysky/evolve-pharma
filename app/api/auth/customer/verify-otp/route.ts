/**
 * POST /api/auth/customer/verify-otp
 *
 * Step 2 of customer sign-up (or resend-OTP flow):
 *   1. Find valid, unused OTP for the given email + type
 *   2. Mark OTP as used
 *   3. Set user.email_verified_at, user.status → ACTIVE
 *   4. Set customer.status → OTP_CONFIRMED
 *   5. Return success — client proceeds to portal sign-in
 *
 * No auth required.
 */

import { NextRequest } from 'next/server';
import { z }           from 'zod';
import { db }          from '@/lib/db';
import {
  apiSuccess,
  apiError,
  apiInternalError,
} from '@/lib/api/response';

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  email: z.email('Invalid email address'),
  otp:   z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
  type:  z.enum(['EMAIL_VERIFICATION', 'PASSWORD_RESET']).default('EMAIL_VERIFICATION'),
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
      return apiError('Invalid request.', 422, errors);
    }

    const { email, otp, type } = parsed.data;

    // Find the user
    const user = await db.user.findUnique({
      where:  { email },
      select: {
        id:         true,
        first_name: true,
        otpTokens:  {
          where: {
            type,
            used_at:    null,
            expires_at: { gt: new Date() },
          },
          orderBy: { created_at: 'desc' },
          take:    1,
        },
      },
    });

    if (!user) {
      return apiError('Invalid or expired verification code.', 400);
    }

    const otpRecord = user.otpTokens[0];
    if (!otpRecord || otpRecord.token !== otp) {
      return apiError('Invalid or expired verification code.', 400);
    }

    // Mark OTP used + update user/customer in transaction
    await db.$transaction(async (tx: any) => {
      // Mark OTP as used
      await tx.otpToken.update({
        where: { id: otpRecord.id },
        data:  { used_at: new Date() },
      });

      if (type === 'EMAIL_VERIFICATION') {
        // Activate user account
        await tx.user.update({
          where: { id: user.id },
          data:  {
            status:            'ACTIVE',
            email_verified_at: new Date(),
          },
        });

        // Advance customer status
        await tx.customer.updateMany({
          where: { user_id: user.id, status: 'REGISTERED' },
          data:  { status: 'OTP_CONFIRMED' },
        });
      }
    });

    const message = type === 'EMAIL_VERIFICATION'
      ? 'Email verified successfully. You can now sign in.'
      : 'Code verified. You may now set your new password.';

    return apiSuccess({ email, verified: true }, 200, message);
  } catch (err) {
    console.error('[POST /api/auth/customer/verify-otp]', err);
    return apiInternalError();
  }
}
