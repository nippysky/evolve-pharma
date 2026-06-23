'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROLE_COOKIE_NAME, USER_COOKIE_NAME } from '@/lib/auth';

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
  store.delete(USER_COOKIE_NAME); // clear real user data
  redirect(target);
}