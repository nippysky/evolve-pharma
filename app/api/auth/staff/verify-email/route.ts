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

    // Find OTP token (select only — no includes)
    const otpRecord = await db.otpToken.findFirst({
      where: {
        token,
        type:       'EMAIL_VERIFICATION',
        used_at:    null,
        expires_at: { gt: new Date() },
      },
      select: { id: true, user_id: true },
    });

    if (!otpRecord) {
      return apiError(
        'This verification link is invalid or has expired. Please ask your administrator to resend the invitation.',
        400,
      );
    }
    const user = await db.user.findUnique({
      where:  { id: otpRecord.user_id },
      select: { id: true, email: true, first_name: true, role: true, status: true },
    });

    if (!user) {
      return apiError('Account not found.', 400);
    }

    // Only staff/driver roles can use this endpoint
    if (!['STAFF', 'DRIVER', 'ADMIN'].includes(user.role)) {
      return apiError('This link is not valid for this account type.', 403);
    }
    await db.otpToken.update({
      where: { id: otpRecord.id },
      data:  { used_at: new Date() },
    });

    // Record email_verified_at
    void db.user.update({
      where: { id: user.id },
      data:  { email_verified_at: new Date() },
    }).catch(err =>
      console.error('[verify-email] email_verified_at update failed:', err)
    );

    // Issue 30-min setup token for the password-creation step
    const setupToken = await signSetupToken(user.id, user.email);

    return apiSuccess(
      { token: setupToken, email: user.email, name: user.first_name },
      200,
      'Email verified. Please set your password to continue.',
    );
  } catch (err) {
    console.error('[GET /api/auth/staff/verify-email] FULL ERROR:', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
