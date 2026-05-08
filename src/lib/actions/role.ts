'use server';

import { cookies } from 'next/headers';
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
