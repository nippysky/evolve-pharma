import { NextRequest }      from 'next/server';
import { z }                from 'zod';
import { db }               from '@/lib/db';
import { signSetupToken }   from '@/lib/jwt';
import {
  apiSuccess,
  apiError,
  apiInternalError,
  handlePrismaError,
} from '@/lib/api/response';

const schema = z.object({
  email:    z.email('Invalid email address'),
  otp_code: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const [f, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        errors[f] = msgs as string[];
      }
      return apiError('Invalid request.', 422, errors);
    }

    const { email, otp_code } = parsed.data;

    // Find user + their valid OTP
    const user = await db.user.findUnique({
      where:  { email },
      select: {
        id: true,
        otpTokens: {
          where: {
            type:       'EMAIL_VERIFICATION',
            used_at:    null,
            expires_at: { gt: new Date() },
          },
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { id: true, token: true },
        },
      },
    });

    if (!user) return apiError('No account found with this email.', 404);

    const otp = user.otpTokens[0];
    if (!otp || otp.token !== otp_code) {
      return apiError('Invalid or expired code. Please check and try again.', 400);
    }

    // Mark OTP used + activate user + update customer status
    await db.$transaction([
      db.otpToken.update({ where: { id: otp.id }, data: { used_at: new Date() } }),
      db.user.update({
        where: { id: user.id },
        data:  { email_verified_at: new Date(), status: 'ACTIVE' },
      }),
      db.customer.updateMany({
        where: { user_id: user.id },
        data:  { status: 'OTP_CONFIRMED' },
      }),
    ]);

    // Issue setup token
    const token = await signSetupToken(user.id, email);

    return apiSuccess({ token, email }, 200, 'Email verified successfully.');
  } catch (err) {
    console.error('[POST /api/auth/customer/verify-otp]', err);
    return handlePrismaError(err) ?? apiInternalError();
    return apiInternalError();
  }
}
