'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth';

/**
 * No-op — customer auth cookies are now set by the API route
 * (POST /api/auth/customer/login). Kept for backward-compat.
 */
export async function setCustomerSessionAction(): Promise<void> {
  // New auth: cookies are set by the API route handler, not a server action.
}

/**
 * Customer sign out — clears both JWT cookies and redirects to /sign-in.
 */
export async function signOutAction(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  redirect('/sign-in');
}

/**
 * Staff / admin sign out — clears both JWT cookies and redirects to /staff/sign-in.
 * Use this in admin and staff-side components instead of signOutAction.
 */
export async function staffSignOutAction(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  redirect('/staff/sign-in');
}
