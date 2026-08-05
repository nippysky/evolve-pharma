import { NextRequest }       from 'next/server';
import { z }                 from 'zod';
import { db }                from '@/lib/db';
import { sendOtpEmail }      from '@/lib/mail';
import {
  apiSuccess,
  apiError,
  apiInternalError,
  handlePrismaError,
} from '@/lib/api/response';
import { generateOtp, otpExpiresAt } from '@/lib/api/issue-tokens';

const STAFF_ROLES = new Set(['ADMIN', 'STAFF', 'DRIVER']);

const schema = z.object({
  email: z.email('Please enter a valid email address.'),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid request body.', 400); }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError('Please provide a valid email address.', 422);
    }

    const { email } = parsed.data;

    // Lookup — only send OTP for known, active internal accounts
    const user = await db.user.findUnique({
      where:  { email },
      select: { id: true, first_name: true, role: true, status: true },
    });

    if (
      user &&
      STAFF_ROLES.has(user.role) &&
      user.status === 'ACTIVE'
    ) {
      const otp       = generateOtp();
      const expiresAt = otpExpiresAt();

      // Invalidate any existing unused PASSWORD_RESET OTPs for this user
      await db.otpToken.updateMany({
        where: { user_id: user.id, type: 'PASSWORD_RESET', used_at: null },
        data:  { used_at: new Date() },
      });

      // Store new OTP
      await db.otpToken.create({
        data: {
          user_id:    user.id,
          token:      otp,
          type:       'PASSWORD_RESET',
          expires_at: expiresAt,
        },
      });

      sendOtpEmail({
        to:   email,
        name: user.first_name,
        otp,
        type: 'PASSWORD_RESET',
      }).catch((err: unknown) => {
        console.error('[staff/forgot-password] Failed to send OTP email:', err);
      });
    }

    // Always return 200 — same message whether email exists or not
    return apiSuccess(
      { email },
      200,
      'If that email matches a staff account, a reset code has been sent.',
    );
  } catch (err) {
    console.error('[POST /api/auth/staff/forgot-password]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
