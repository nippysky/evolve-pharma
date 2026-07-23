/**
 * ENVOLVE PHARMACEUTICALS — Session Auth
 *
 * Role is stored in the `envolve_demo_role` cookie (set by setStaffSessionAction).
 * Real user data (email, full_name) is stored in the `envolve_user` cookie
 * set at staff login. Customer pcn fields are also stored there when available.
 *
 * All real user data comes from auth/me via UserContext — the session is only
 * used for server-side routing guards.
 */

import { cookies } from 'next/headers';
import type { Role, SessionUser, StaffPermissionKey } from '@/types';

export const ROLE_COOKIE_NAME = 'envolve_demo_role';
export const USER_COOKIE_NAME = 'envolve_user';

interface StoredUser {
  email?: string;
  full_name?: string;
  pcn_uploaded?: boolean;
  pcn_verified?: boolean;
}

/**
 * Read the current session from cookies.
 * Defaults to 'customer' when no role cookie is set (preserves portal access
 * for customers who logged in before the cookie was introduced).
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const roleCookieValue = store.get(ROLE_COOKIE_NAME)?.value;

  // No role cookie = not signed in — return null so auth guards and
  // session-aware UI correctly treat the visitor as logged out.
  if (!roleCookieValue) return null;

  const role = roleCookieValue as Role;

  let email = '';
  let full_name = '';
  let pcn_uploaded: boolean | undefined;
  let pcn_verified: boolean | undefined;

  try {
    const raw = store.get(USER_COOKIE_NAME)?.value;
    if (raw) {
      const stored: StoredUser = JSON.parse(raw);
      email      = stored.email     ?? '';
      full_name  = stored.full_name ?? '';
      if (typeof stored.pcn_uploaded === 'boolean') pcn_uploaded = stored.pcn_uploaded;
      if (typeof stored.pcn_verified === 'boolean') pcn_verified = stored.pcn_verified;
    }
  } catch {
    // Malformed cookie — ignore
  }

  return { role, email, full_name, pcn_uploaded, pcn_verified };
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');
  return session;
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const session = await requireSession();
  if (!roles.includes(session.role)) throw new Error('Forbidden');
  return session;
}

/**
 * Server-side permission check.
 * Admin always passes; sales_agent needs the specific key in session.permissions.
 */
export function hasPermission(session: SessionUser | null, key: StaffPermissionKey): boolean {
  if (!session) return false;
  if (session.role === 'admin') return true;
  return session.permissions?.includes(key) ?? false;
}
