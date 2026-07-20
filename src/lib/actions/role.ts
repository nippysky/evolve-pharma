'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROLE_COOKIE_NAME, USER_COOKIE_NAME } from '@/lib/auth';

const COOKIE_OPTS = {
  path:     '/',
  httpOnly: false,
  sameSite: 'lax' as const,
  maxAge:   60 * 60 * 24 * 30,
};

/**
 * Called immediately after a successful CUSTOMER login.
 * Explicitly stamps role=customer so any stale admin/staff cookie
 * left over from a previous session (common on Vercel previews) is
 * overwritten before the layout's getSession() runs.
 */
export async function setCustomerSessionAction(): Promise<void> {
  const store = await cookies();
  store.set(ROLE_COOKIE_NAME, 'customer', COOKIE_OPTS);
  // Remove any leftover staff user-info cookie
  store.delete(USER_COOKIE_NAME);
}

/**
 * Sign out — clears the session role cookie and routes back to the right
 * door: staff (admin / sales_agent) land on /staff/sign-in, customers on
 * /sign-in. The role is read before the cookie is cleared, since getSession
 * defaults to `customer` once it's gone. Works for both shells, so the same
 * action can back every logout button.
 */
export async function signOutAction() {
  const store = await cookies();
  const role = store.get(ROLE_COOKIE_NAME)?.value;
  const staffRoles = ['admin', 'sales_agent', 'driver'];
  const target = staffRoles.includes(role ?? '') ? '/staff/sign-in' : '/sign-in';
  store.delete(ROLE_COOKIE_NAME);
  store.delete(USER_COOKIE_NAME);
  redirect(target);
}