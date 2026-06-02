'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ROLE_COOKIE_NAME } from '@/lib/auth';
import type { Role } from '@/types';

export async function setDemoRole(role: Role) {
  const store = await cookies();
  store.set(ROLE_COOKIE_NAME, role, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath('/', 'layout');
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
  const target = role === 'admin' || role === 'sales_agent' ? '/staff/sign-in' : '/sign-in';
  store.delete(ROLE_COOKIE_NAME);
  redirect(target);
}