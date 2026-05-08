/**
 * ENVOLVE PHARMACEUTICALS — Mock Auth
 *
 * Stand-in for session resolution while the PHP backend is under
 * construction. The functions resolve a `SessionUser` from a (fake)
 * cookie. Replace with real JWT/session validation when ready.
 */

import { cookies } from 'next/headers';
import {
  MOCK_SESSION,
  MOCK_ADMIN_SESSION,
  MOCK_AGENT_SESSION,
} from '@/lib/data/operational';
import type { Role, SessionUser } from '@/types';

const ROLE_COOKIE = 'envolve_demo_role';

/**
 * Read the current session.
 * In dev, role is selected via the `envolve_demo_role` cookie which can be
 * toggled by the role switcher widget. Defaults to `customer`.
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const role = (store.get(ROLE_COOKIE)?.value ?? 'customer') as Role;
  switch (role) {
    case 'admin':
      return MOCK_ADMIN_SESSION;
    case 'sales_agent':
      return MOCK_AGENT_SESSION;
    case 'customer':
    default:
      return MOCK_SESSION;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  return session;
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    throw new Error('Forbidden');
  }
  return session;
}

export const ROLE_COOKIE_NAME = ROLE_COOKIE;
