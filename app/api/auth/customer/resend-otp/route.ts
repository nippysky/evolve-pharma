/**
 * POST /api/auth/customer/resend-otp
 *
 * Re-sends the EMAIL_VERIFICATION OTP for a given email.
 * Rate-limited implicitly: marks old tokens used before generating a new one.
 * No auth required.
 */

import { NextRequest }               from 'next/server';
import { z }                         from 'zod';
import { db }                        from '@/lib/db';
import { sendOtpEmail }              from '@/lib/mail';
import { apiSuccess, apiError, apiInternalError, handlePrismaError } from '@/lib/api/response';
import { generateOtp, otpExpiresAt } from '@/lib/api/issue-tokens';

const schema = z.object({
  email: z.email('Invalid email address'),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError('Valid email is required', 422);

    const { email } = parsed.data;

    const user = await db.user.findUnique({
      where:  { email },
      select: { id: true, first_name: true },
    });

    // Always return 200 to prevent user enumeration
    if (!user) return apiSuccess({ email }, 200, 'If this email exists, a new code was sent.');

    // Invalidate any pending OTPs
    await db.otpToken.updateMany({
      where: { user_id: user.id, type: 'EMAIL_VERIFICATION', used_at: null },
      data:  { used_at: new Date() },
    });

    // Issue new OTP
    const otp       = generateOtp();
    const expiresAt = otpExpiresAt();
    await db.otpToken.create({
      data: { user_id: user.id, token: otp, type: 'EMAIL_VERIFICATION', expires_at: expiresAt },
    });

    try {
      await sendOtpEmail({ to: email, name: user.first_name, otp, type: 'EMAIL_VERIFICATION' });
    } catch (e) {
      console.error('[resend-otp] email failed:', e);
    }

    return apiSuccess({ email }, 200, 'A new verification code has been sent.');
  } catch (err) {
    console.error('[POST /api/auth/customer/resend-otp]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
