import { NextRequest }               from 'next/server';
import { db }                        from '@/lib/db';
import { sendOtpEmail }              from '@/lib/mail';
import { uploadToCloudinary }        from '@/lib/cloudinary';
import {
  apiSuccess,
  apiError,
  apiInternalError,
  handlePrismaError,
} from '@/lib/api/response';
import { generateOtp, otpExpiresAt } from '@/lib/api/issue-tokens';
import {
  DEFAULT_REFERRAL_CODE,
  REFERRAL_POINTS_PER_SIGNUP,
}                                    from '@/lib/constants';

export async function POST(req: NextRequest) {
  try {
    let formData: FormData;
    try { formData = await req.formData(); }
    catch { return apiError('Multipart form data required', 400); }

    const str  = (k: string) => (formData.get(k) as string | null)?.trim() || null;
    const file  = formData.get('file') as File | null;

    const first_name    = str('first_name');
    const last_name     = str('last_name');
    const middle_name   = str('middle_name');
    const email         = str('email')?.toLowerCase() ?? null;
    const phone         = str('phone');
    const company_name  = str('company_name');
    const address       = str('address');
    const city          = str('city');
    const state         = str('state');
    const gender        = str('gender');
    const referral_code = str('referral_code');

    // Validation
    const errs: Record<string, string[]> = {};
    if (!first_name)                  errs.first_name    = ['First name is required'];
    if (!last_name)                   errs.last_name     = ['Last name is required'];
    if (!email || !email.includes('@')) errs.email       = ['Valid email is required'];
    if (!company_name)                errs.company_name  = ['Pharmacy / company name is required'];
    if (!phone)                       errs.phone         = ['Phone number is required'];
    if (!address)                     errs.address       = ['Address is required'];
    if (!city)                        errs.city          = ['City is required'];
    if (!state)                       errs.state         = ['State is required'];
    if (!file)                        errs.pcn_certificate = ['PCN certificate is required'];
    if (Object.keys(errs).length) return apiError('Please review the fields below.', 422, errs);

    // Email uniqueness
    const existing = await db.user.findUnique({ where: { email: email! }, select: { id: true } });
    if (existing) return apiError('An account with this email already exists.', 409);

    // Upload PCN to Cloudinary — REQUIRED. Registration is blocked if this fails.
    let pcnUrl: string;
    {
      const buffer = Buffer.from(await file!.arrayBuffer());

      try {
        const result = await uploadToCloudinary(buffer, 'evolve/pcn', {
          resourceType: 'auto', // Cloudinary detects image vs PDF automatically
        });
        pcnUrl = result.url;
        console.log('[register] PCN uploaded:', pcnUrl);
      } catch (uploadErr: unknown) {
        // Log the full error detail so the server terminal shows exactly what Cloudinary returned
        const detail =
          uploadErr && typeof uploadErr === 'object' && 'message' in uploadErr
            ? (uploadErr as { message: string; http_code?: number }).message
            : String(uploadErr);
        const code =
          uploadErr && typeof uploadErr === 'object' && 'http_code' in uploadErr
            ? (uploadErr as { http_code?: number }).http_code
            : undefined;

        console.error(
          `[register] Cloudinary upload failed (http_code=${code ?? 'n/a'}): ${detail}`,
        );

        // Always block — a missing PCN URL breaks the compliance review flow
        return apiError(
          'We could not upload your PCN certificate. Please check your file and try again. ' +
          'If the problem persists, contact support.',
          502,
        );
      }
    }

    // Create User + Customer
    const newReferralCode = 'ENV' + Math.random().toString(36).substring(2, 10).toUpperCase();

    // Resolve referral: validate supplied code is a real customer's code (not the platform default)
    const referrerCode = referral_code && referral_code !== DEFAULT_REFERRAL_CODE
      ? referral_code
      : null;
    let referrerExists = false;
    if (referrerCode) {
      const referrer = await db.customer.findUnique({
        where:  { referral_code: referrerCode },
        select: { id: true },
      });
      referrerExists = !!referrer;
    }

    const user = await db.$transaction(async (tx: any) => {
      const u = await tx.user.create({
        data: {
          first_name,
          middle_name,
          last_name,
          email,
          phone,
          gender,
          password_hash: 'UNSET',
          role:          'CUSTOMER',
          status:        'INACTIVE',
        },
      });
      await tx.customer.create({
        data: {
          user_id:             u.id,
          company_name,
          address,
          city,
          state,
          pcn_certificate_url: pcnUrl,
          referral_code:       newReferralCode,
          // Store the real referrer code if valid, otherwise the platform sentinel
          referred_by:         referrerExists ? referrerCode! : DEFAULT_REFERRAL_CODE,
          status:              'REGISTERED',
        },
      });
      return u;
    });
    // referral_points: added in schema — run `npx prisma generate` if types lag
    if (referrerExists && referrerCode) {
      void (db.customer.update as any)({
        where: { referral_code: referrerCode },
        data:  { referral_points: { increment: REFERRAL_POINTS_PER_SIGNUP } },
      }).catch((err: unknown) => console.error('[register] referral points update failed:', err));
    }

    // Generate + store OTP
    const otp       = generateOtp();
    const expiresAt = otpExpiresAt();
    await db.otpToken.create({
      data: { user_id: user.id, token: otp, type: 'EMAIL_VERIFICATION', expires_at: expiresAt },
    });

    // Send OTP email (non-blocking)
    try {
      await sendOtpEmail({ to: email!, name: first_name!, otp, type: 'EMAIL_VERIFICATION' });
    } catch (e) {
      console.error('[register] OTP email failed:', e);
    }

    return apiSuccess({ email }, 201, 'Account created. Check your email for a verification code.');
  } catch (err) {
    console.error('[POST /api/auth/customer/register]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
