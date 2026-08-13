import { NextRequest } from 'next/server';
import { z }           from 'zod';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import { writeAuditLog }       from '@/lib/audit';
import { revalidateProfile }   from '@/lib/revalidate';
import { getReferralSettings } from '@/lib/data/settings.server';
import {
  getReferralWallet, getReferralLedger, getReferredCustomers, getReferrer,
} from '@/lib/referral';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
  handlePrismaError,
} from '@/lib/api/response';

/**
 * The signed-in customer's own profile.
 *
 * Why this route exists
 * ─────────────────────
 * The web portal reads profile and referral data through server components
 * (`getCustomerProfile` / `getReferralData`), which works fine in the browser
 * but is unreachable from a native client. This is the HTTP equivalent, and it
 * returns profile *and* referral together because every screen that shows one
 * shows the other.
 *
 * It also closes a live bug: the portal's profile form was PATCHing
 * `/api/auth/customer/profile`, a route that was never built. Saving your
 * details from the web silently 404'd. The form now points here.
 *
 * GET   → { profile, referral }
 * PATCH → { profile }   (first_name, last_name, phone, gender)
 *
 * The `referral` block carries the programme terms alongside the customer's
 * standing, because a balance with no stated earning rule is not something a
 * client can render honestly. Both of the platform's earning events are
 * described: the signup award, and the spend-threshold award. See the note on
 * `referral.programme` below for the unit caveat.
 *
 * Editable fields are deliberately narrow. Email is the login identifier and
 * changing it needs a verification round-trip; company name, address and PCN
 * details are what staff approved the account against, so they move through
 * the review flow rather than a self-service form.
 */

const patchSchema = z.object({
  first_name: z.string().trim().min(2, 'First name must be at least 2 characters.').max(100).optional(),
  last_name:  z.string().trim().min(2, 'Last name must be at least 2 characters.').max(100).optional(),
  phone:      z.string().trim().min(8, 'Enter a valid phone number.').max(20).optional(),
  gender:     z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
}).refine(
  obj => Object.keys(obj).length > 0,
  { message: 'Send at least one field to update.' },
);

/* ── GET ──────────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'CUSTOMER') {
      return apiForbidden('This endpoint is for customer accounts.');
    }

    // One query for user + customer + the order rows the totals are built from.
    // Selecting only `total` and `payment_status` keeps the row payload small
    // even for a customer with a long order history.
    const user = await db.user.findUnique({
      where:  { id: session.userId },
      select: {
        id: true, uuid: true, first_name: true, last_name: true,
        email: true, phone: true, gender: true, avatar_url: true,
        created_at: true,
        customer: {
          select: {
            id: true, company_name: true, address: true, city: true, state: true,
            pcn_certificate_url: true, pcn_verified: true,
            status: true, referral_code: true, referral_points: true,
            orders: { select: { total: true, payment_status: true } },
          },
        },
      },
    });

    if (!user)          return apiError('Account not found.', 404);
    if (!user.customer) return apiError('No customer record is linked to this account.', 404);

    const c          = user.customer;
    const paidOrders = c.orders.filter(o => o.payment_status === 'PAID');
    const totalSpent = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);

    // Referral data is only meaningful once a code exists, so it's skipped
    // entirely for customers without one rather than costing several round
    // trips to return zeroes and terms nobody can act on.
    //
    // Sequential by design: serverless runs a connection pool of one, so
    // Promise.all here would queue anyway while adding acquire contention.
    const terms     = c.referral_code ? await getReferralSettings()      : null;
    const wallet    = c.referral_code ? await getReferralWallet(c.id)    : null;
    const referrer  = c.referral_code ? await getReferrer(c.id)          : null;
    const referrals = c.referral_code ? await getReferredCustomers(c.id) : [];
    const ledger    = c.referral_code ? await getReferralLedger(c.id, 30) : [];

    return apiSuccess({
      profile: {
        user_id:      user.id,
        uuid:         user.uuid,
        first_name:   user.first_name,
        last_name:    user.last_name,
        email:        user.email,
        phone:        user.phone,
        gender:       user.gender,
        avatar_url:   user.avatar_url,
        member_since: user.created_at,

        customer_id:         c.id,
        company_name:        c.company_name,
        address:             c.address,
        city:                c.city,
        state:               c.state,
        pcn_certificate_url: c.pcn_certificate_url,
        pcn_verified:        c.pcn_verified,
        status:              c.status,

        total_orders: c.orders.length,
        total_paid_orders: paidOrders.length,
        total_spent:  totalSpent,
      },
      referral: {
        referral_code:   c.referral_code,
        /** Naira balance. Not dimensionless points, despite the column name. */
        referral_points: wallet?.balance ?? 0,
        referral_count:  referrals.length,
        /** Naira the customer can apply to an order right now. */
        redeemable:      wallet?.redeemable ?? 0,

        /** Who referred them. Null when nobody did. */
        referred_by: referrer,
        /** Pharmacies they referred, newest first. */
        referrals,
        /** Credit history — every award and redemption, newest first. */
        ledger,

        /**
         * Programme terms, read live from admin settings so no client ever
         * hardcodes them. Every value is naira, matching the wallet.
         *
         * `redemption_enabled` is the business switch: earning runs from day
         * one, spending opens when the business decides. A client should hide
         * the "apply credit" affordance entirely while it's false rather than
         * showing something that will be refused.
         */
        programme: terms ? {
          signup_bonus:       Math.round(terms.signupBonus),
          spend_threshold:    terms.threshold,
          spend_reward:       Math.round(terms.reward),
          redemption_enabled: terms.redemptionEnabled,
          min_redemption:     terms.minRedemption,
        } : null,
      },
    }, 200, 'Profile retrieved successfully.');
  } catch (err) {
    console.error('[GET /api/customers/me]', err);
    return apiInternalError();
  }
}

/* ── PATCH ────────────────────────────────────────────────────────────── */

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'CUSTOMER') {
      return apiForbidden('This endpoint is for customer accounts.');
    }

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body.', 400); }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid request.', 400);
    }

    const before = await db.user.findUnique({
      where:  { id: session.userId },
      select: { first_name: true, last_name: true, phone: true, gender: true },
    });
    if (!before) return apiError('Account not found.', 404);

    const updated = await db.user.update({
      where: { id: session.userId },
      data:  parsed.data,
      select: {
        id: true, first_name: true, last_name: true,
        email: true, phone: true, gender: true, avatar_url: true,
      },
    });

    // Audit only what actually moved — a form that submits every field on save
    // would otherwise write a log entry listing unchanged values.
    const changes = (Object.keys(parsed.data) as (keyof typeof parsed.data)[])
      .filter(k => before[k] !== parsed.data[k])
      .map(k => `${k}: "${before[k] ?? '—'}" → "${parsed.data[k]}"`);

    if (changes.length) {
      writeAuditLog({
        userId:      session.userId,
        userType:    session.role,
        userName:    `${session.first_name} ${session.last_name}`,
        email:       session.email,
        action:      'PROFILE_UPDATED',
        entityType:  'User',
        entityId:    String(session.userId),
        description: `Customer updated their own profile. ${changes.join('; ')}.`,
        req,
      });
    }

    revalidateProfile(session.userId);

    return apiSuccess({ profile: updated }, 200, 'Profile updated successfully.');
  } catch (err) {
    const known = handlePrismaError(err);
    if (known) return known;
    console.error('[PATCH /api/customers/me]', err);
    return apiInternalError();
  }
}
