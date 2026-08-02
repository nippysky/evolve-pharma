'use server';

/**
 * Session actions — thin wrappers used by portal/console logout flows.
 *
 * In the new JWT-cookie system (Module 2) these will be replaced by
 * direct calls to POST /api/auth/logout. Kept here as stubs so the
 * existing UI components still compile without changes.
 */

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
 * Sign out — clears both JWT cookies and redirects to /sign-in.
 * Works for all roles (customer, staff, admin).
 */
export async function signOutAction(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  redirect('/sign-in');
}
