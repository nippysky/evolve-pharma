/**
 * POST /api/auth/customer/register
 *
 * Step 1 of customer sign-up:
 *   1. Validate input
 *   2. Check email not already in use
 *   3. Hash password + create User (CUSTOMER, INACTIVE) + Customer (REGISTERED)
 *   4. Generate 6-digit OTP → store in otp_tokens (10 min expiry)
 *   5. Send OTP email via Nodemailer
 *   6. Return { email } so the client can proceed to /verify-otp
 *
 * No auth required.
 */

import { NextRequest }   from 'next/server';
import { z }             from 'zod';
import bcrypt            from 'bcryptjs';
import { db }            from '@/lib/db';
import { sendOtpEmail }  from '@/lib/mail';
import {
  apiSuccess,
  apiError,
  apiInternalError,
} from '@/lib/api/response';
import { generateOtp, otpExpiresAt } from '@/lib/api/issue-tokens';

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  first_name:    z.string().min(1, 'First name is required').max(100),
  last_name:     z.string().min(1, 'Last name is required').max(100),
  email:         z.email('Invalid email address'),
  phone:         z.string().max(20).optional(),
  company_name:  z.string().max(255).optional(),
  password:      z.string().min(8, 'Password must be at least 8 characters').max(128),
  referral_code: z.string().max(50).optional(),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Parse + validate
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

    const { first_name, last_name, email, phone, company_name, password, referral_code } = parsed.data;

    // 2. Check email uniqueness
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return apiError('An account with this email already exists.', 409);
    }

    // 3. Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // 4. Generate referral code for the new customer
    const newReferralCode = 'ENV' + Math.random().toString(36).substring(2, 10).toUpperCase();

    // 5. Create User + Customer in a transaction
    const user = await db.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          first_name,
          last_name,
          email,
          phone,
          password_hash,
          role:   'CUSTOMER',
          status: 'INACTIVE', // activated after OTP verification
        },
      });

      await tx.customer.create({
        data: {
          user_id:       newUser.id,
          company_name,
          referral_code: newReferralCode,
          referred_by:   referral_code ?? undefined,
          status:        'REGISTERED',
        },
      });

      return newUser;
    });

    // 6. Generate + store OTP
    const otp       = generateOtp();
    const expiresAt = otpExpiresAt();

    await db.otpToken.create({
      data: {
        user_id:    user.id,
        token:      otp,
        type:       'EMAIL_VERIFICATION',
        expires_at: expiresAt,
      },
    });

    // 7. Send OTP email (non-blocking — log error but don't fail registration)
    try {
      await sendOtpEmail({
        to:   email,
        name: first_name,
        otp,
        type: 'EMAIL_VERIFICATION',
      });
    } catch (mailErr) {
      console.error('[register] Failed to send OTP email:', mailErr);
      // Still return success — user can request a resend
    }

    return apiSuccess(
      { email },
      201,
      'Account created. Check your email for a verification code.',
    );
  } catch (err) {
    console.error('[POST /api/auth/customer/register]', err);
    return apiInternalError();
  }
}
