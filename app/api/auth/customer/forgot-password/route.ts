/**
 * POST /api/auth/customer/forgot-password
 *
 * Sends a 6-digit password-reset OTP to the customer's email.
 * Always returns 200 regardless of whether the email exists — prevents
 * user enumeration attacks.
 *
 * No auth required.
 */

import { NextRequest } from 'next/server';
import { z }           from 'zod';
import { db }          from '@/lib/db';
import { sendOtpEmail } from '@/lib/mail';
import {
  apiSuccess,
  apiError,
  apiInternalError,
} from '@/lib/api/response';
import { generateOtp, otpExpiresAt } from '@/lib/api/issue-tokens';

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  email: z.email('Invalid email address'),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError('Please provide a valid email address.', 422);
    }

    const { email } = parsed.data;

    // Always return 200 — prevents email enumeration
    const user = await db.user.findUnique({
      where:  { email },
      select: { id: true, first_name: true, role: true, status: true },
    });

    if (user && user.role === 'CUSTOMER' && user.status === 'ACTIVE') {
      const otp       = generateOtp();
      const expiresAt = otpExpiresAt();

      // Invalidate any existing unused PASSWORD_RESET OTPs for this user
      await db.otpToken.updateMany({
        where: {
          user_id: user.id,
          type:    'PASSWORD_RESET',
          used_at: null,
        },
        data: { used_at: new Date() }, // mark as used to invalidate
      });

      // Create new OTP
      await db.otpToken.create({
        data: {
          user_id:    user.id,
          token:      otp,
          type:       'PASSWORD_RESET',
          expires_at: expiresAt,
        },
      });

      // Send email (fire-and-forget — don't expose mail errors to client)
      sendOtpEmail({
        to:   email,
        name: user.first_name,
        otp,
        type: 'PASSWORD_RESET',
      }).catch((err: unknown) => {
        console.error('[forgot-password] Failed to send OTP email:', err);
      });
    }

    return apiSuccess(
      { email },
      200,
      'If an account with that email exists, a reset code has been sent.',
    );
  } catch (err) {
    console.error('[POST /api/auth/customer/forgot-password]', err);
    return apiInternalError();
  }
}
