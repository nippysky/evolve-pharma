/**
 * GET /api/settings/app
 *
 * The handful of settings the mobile apps display to their users — the
 * dispatch number a driver taps to call in, the support address shown for
 * account-change requests, the company name.
 *
 * Exists because `/api/admin/settings` is ADMIN-only, and the users who need
 * these values are drivers and sales reps. Rather than widen that endpoint —
 * which would expose VAT rates, referral economics and staff-scope policy to
 * every signed-in account — this returns a deliberately small, fixed set.
 *
 * Any authenticated role may read it. Nothing here is sensitive: all three
 * values are already printed on the app's own screens.
 */

import { NextRequest }  from 'next/server';
import { getSession }   from '@/lib/auth';
import { apiSuccess, apiUnauthorized, apiInternalError } from '@/lib/api/response';
import { getAppContactSettings } from '@/lib/data/settings.server';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();

    const contact = await getAppContactSettings();

    return apiSuccess(
      {
        dispatch_phone: contact.dispatchPhone,
        support_phone:  contact.supportPhone,
        support_email:  contact.supportEmail,
        company_name:   contact.companyName,
      },
      200,
      'App settings retrieved',
    );
  } catch (err) {
    console.error('[GET /api/settings/app]', err);
    return apiInternalError();
  }
}
