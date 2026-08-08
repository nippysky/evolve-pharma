'use server';

/**
 * Admin server actions.
 *
 * Only actions invoked directly from a client component live here. Everything
 * else — staff/customer/product/inventory CRUD and bulk imports — is handled
 * by the /api routes, which own validation, auditing and cache revalidation.
 */

import { revalidatePath }  from 'next/cache';
import { cookies, headers } from 'next/headers';
import { getSession }      from '@/lib/auth';
import type { ActionResult }      from '@/lib/actions';
import type { Role, SessionUser } from '@/types';

const NOT_AUTHORIZED: ActionResult = { ok: false, message: 'You are not authorized to do this.' };

async function guard(roles: Role[]): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session || !roles.includes(session.role)) return null;
  return session;
}

/**
 * Fire a fetch to an internal Next.js API route, forwarding the session cookies.
 * Uses request headers to derive the correct protocol + host (works on Vercel too).
 */
async function internalFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const h     = await headers();
  const proto = h.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const host  = h.get('host') ?? 'localhost:3000';

  const jar          = await cookies();
  const cookieHeader = jar.toString();

  const res = await fetch(`${proto}://${host}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Cookie: cookieHeader,
    },
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

function fromApiResult(result: Awaited<ReturnType<typeof internalFetch>>): ActionResult {
  if (result.ok) return { ok: true };
  const message     = (result.json?.message as string | undefined)
    ?? 'Something went wrong. Please try again.';
  const fieldErrors = result.json?.errors as Record<string, string[]> | undefined;
  return { ok: false, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

/** Invite a driver — delegates to POST /api/staff with role DRIVER. */
export async function inviteDriverAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard(['ADMIN', 'STAFF']))) return NOT_AUTHORIZED;

  const firstName    = (formData.get('first_name')    as string | null)?.trim();
  const lastName     = (formData.get('last_name')     as string | null)?.trim();
  const email        = (formData.get('email')         as string | null)?.trim().toLowerCase();
  const phone        = (formData.get('phone')         as string | null)?.trim();
  const vehiclePlate = (formData.get('vehicle_plate') as string | null)?.trim();
  const vehicleType  = (formData.get('vehicle_type')  as string | null)?.trim();
  const region       = (formData.get('region')        as string | null)?.trim();

  if (!firstName || !lastName || !email || !phone) {
    return { ok: false, message: 'First name, last name, email, and phone are required.' };
  }

  const result = await internalFetch('/api/staff', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      first_name:    firstName,
      last_name:     lastName,
      email,
      phone,
      role:          'DRIVER',
      vehicle_plate: vehiclePlate,
      vehicle_type:  vehicleType,
      region,
    }),
  });

  if (!result.ok) return fromApiResult(result);

  revalidatePath('/admin/drivers');
  return { ok: true };
}
