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
import { DEFAULT_REFERRAL_CODE }      from '@/lib/constants';
import { awardSignupBonus }           from '@/lib/referral';

export async function POST(req: NextRequest) {
  try {
    let formData: FormData;
    try { formData = await req.formData(); }
    catch { return apiError('Multipart form data required', 400); }

    const str  = (k: string) => (formData.get(k) as string | null)?.trim() || null;

    // The PCN certificate.
    //
    // `file` is the canonical field name and matches every other multipart
    // route in this API (bulk imports, upload-pcn, invited-pcn). `pcn_certificate`
    // is accepted as an alias because that is the key this endpoint reports
    // validation errors under, and clients reasonably infer the field name from
    // the error response.
    const file = (formData.get('file') ?? formData.get('pcn_certificate')) as File | null;

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
    // Keyed to match the field name so the error is actionable, with the alias
    // named explicitly rather than leaving the client to guess.
    if (!file) errs.file = ['PCN certificate is required. Send it as the `file` field (alias: `pcn_certificate`).'];
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
    // Resolve the code to an actual customer row. The id is what gets stored —
    // a code string alone can't survive the referrer changing theirs, and can't
    // be joined on to answer "who did I refer?".
    let referrer: { id: number } | null = null;
    if (referrerCode) {
      referrer = await db.customer.findUnique({
        where:  { referral_code: referrerCode },
        select: { id: true },
      });
    }
    const referrerExists = !!referrer;

    const created = await db.$transaction(async (tx: any) => {
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
      const c = await tx.customer.create({
        data: {
          user_id:             u.id,
          company_name,
          address,
          city,
          state,
          pcn_certificate_url: pcnUrl,
          referral_code:       newReferralCode,
          // `referred_by` records the code that was typed (the receipt);
          // `referred_by_customer_id` is the resolved link everything queries.
          // The platform sentinel is stored when nobody referred them so the
          // provenance is explicit, but the FK stays null — the platform is not
          // a referrer and must never appear in anyone's referral list.
          referred_by:             referrerExists ? referrerCode! : DEFAULT_REFERRAL_CODE,
          referred_by_customer_id: referrer?.id ?? null,
          status:                  'REGISTERED',
        },
      });
      return { user: u, customerId: c.id };
    });
    // Credit the referrer. Goes through the ledger so the balance is always
    // explainable, and is idempotent on (referrer, referee) so a retried
    // registration can't pay twice.
    if (referrer) {
      void awardSignupBonus({
        referrerCustomerId: referrer.id,
        refereeCustomerId:  created.customerId,
        refereeName:        company_name || `${first_name} ${last_name}`.trim(),
      });
    }

    // Generate + store OTP
    const otp       = generateOtp();
    const expiresAt = otpExpiresAt();
    await db.otpToken.create({
      data: { user_id: created.user.id, token: otp, type: 'EMAIL_VERIFICATION', expires_at: expiresAt },
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
