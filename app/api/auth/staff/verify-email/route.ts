/**
 * GET /api/auth/staff/verify-email?token=UUID
 *
 * Staff email verification — called when a staff member clicks
 * the verification link in their invitation email.
 *
 * Flow:
 *   1. Find valid, unused EMAIL_VERIFICATION OTP matching the UUID token
 *   2. Mark token used + set user.email_verified_at
 *   3. Issue a short-lived setup_token (30 min, audience: envolvepharm-setup)
 *   4. Return the setup token → client shows the create-password form
 *
 * The account stays INACTIVE until the staff sets their password
 * via POST /api/auth/staff/create-password.
 *
 * No auth required.
 */

import { NextRequest }    from 'next/server';
import { db }             from '@/lib/db';
import { signSetupToken } from '@/lib/jwt';
import {
  apiSuccess,
  apiError,
  apiInternalError,
  handlePrismaError,
} from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')?.trim();

    if (!token) {
      return apiError('Verification token is missing.', 400);
    }

    // Find user via the OTP token
    const otpRecord = await db.otpToken.findFirst({
      where: {
        token,
        type:       'EMAIL_VERIFICATION',
        used_at:    null,
        expires_at: { gt: new Date() },
      },
      include: {
        user: {
          select: { id: true, email: true, first_name: true, role: true, status: true },
        },
      },
    });

    if (!otpRecord) {
      return apiError(
        'This verification link is invalid or has expired. Please ask your administrator to resend the invitation.',
        400,
      );
    }

    const { user } = otpRecord;

    // Only staff/driver roles can use this endpoint
    if (!['STAFF', 'DRIVER', 'ADMIN'].includes(user.role)) {
      return apiError('This link is not valid for this account type.', 403);
    }

    // Mark token used + record email verified at
    await db.$transaction([
      db.otpToken.update({
        where: { id: otpRecord.id },
        data:  { used_at: new Date() },
      }),
      db.user.update({
        where: { id: user.id },
        data:  { email_verified_at: new Date() },
      }),
    ]);

    // Issue a 30-min setup token for the password-creation step
    const setupToken = await signSetupToken(user.id, user.email);

    return apiSuccess(
      { token: setupToken, email: user.email, name: user.first_name },
      200,
      'Email verified. Please set your password to continue.',
    );
  } catch (err) {
    console.error('[GET /api/auth/staff/verify-email]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
