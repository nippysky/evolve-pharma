/**
 * Auth helpers — cookie management + session reading
 *
 * Cookie names:
 *   ep_access   — httpOnly, Secure, SameSite=Lax, 15 min
 *   ep_refresh  — httpOnly, Secure, SameSite=Lax, 7 days
 *
 * Web clients: cookies are set automatically by the browser on every request.
 * Mobile clients: tokens returned in JSON body, sent as Authorization: Bearer.
 *
 * getSession() returns SessionUser (with display fields) so layouts/sidebars
 * can render the user's name and email without an extra DB query — the data
 * is verified via JWT signature on every token validation.
 */

import { cookies }                              from 'next/headers';
import { type NextRequest, NextResponse }        from 'next/server';
import { verifyAccessToken, type TokenPayload }  from './jwt.js';
import type { SessionUser }                      from '@/types';

// ─── Cookie names ──────────────────────────────────────────────────────────────

export const ACCESS_COOKIE  = 'ep_access';
export const REFRESH_COOKIE = 'ep_refresh';

// ─── Cookie options ────────────────────────────────────────────────────────────

const IS_PROD = process.env.NODE_ENV === 'production';

export function accessCookieOptions() {
  return {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: 'lax' as const,
    path:     '/',
    maxAge:   60 * 15, // 15 minutes
  };
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: 'lax' as const,
    path:     '/',
    maxAge:   60 * 60 * 24 * 7, // 7 days
  };
}

// ─── Set / clear tokens on a NextResponse ─────────────────────────────────────

export function setAuthCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookies.set(ACCESS_COOKIE,  accessToken,  accessCookieOptions());
  res.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE,  '', { ...accessCookieOptions(),  maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { ...refreshCookieOptions(), maxAge: 0 });
}

// ─── Map TokenPayload → SessionUser ──────────────────────────────────────────

function toSessionUser(payload: TokenPayload): SessionUser {
  return {
    userId:     payload.userId,
    role:       payload.role,
    email:      payload.email,
    first_name: payload.first_name,
    last_name:  payload.last_name,
    full_name:  `${payload.first_name} ${payload.last_name}`.trim(),
  };
}

// ─── Read session ─────────────────────────────────────────────────────────────

/**
 * Returns the authenticated user's SessionUser from either:
 *   1. ep_access httpOnly cookie  (web browser)
 *   2. Authorization: Bearer ...  (mobile app)
 *
 * Pass a NextRequest when calling from a route handler or proxy.ts.
 * Omit it to use next/headers (server components / server actions).
 */
export async function getSession(req?: NextRequest): Promise<SessionUser | null> {
  let token: string | undefined;

  if (req) {
    token =
      req.cookies.get(ACCESS_COOKIE)?.value ??
      req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ??
      undefined;
  } else {
    const store = await cookies();
    token = store.get(ACCESS_COOKIE)?.value;
  }

  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  return toSessionUser(payload);
}

/**
 * Low-level version that returns the raw TokenPayload.
 * Use getSession() for layouts/components; use this in API route handlers
 * where you only need userId + role (no DB query, no display fields).
 */
export async function getTokenPayload(req?: NextRequest): Promise<TokenPayload | null> {
  let token: string | undefined;

  if (req) {
    token =
      req.cookies.get(ACCESS_COOKIE)?.value ??
      req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ??
      undefined;
  } else {
    const store = await cookies();
    token = store.get(ACCESS_COOKIE)?.value;
  }

  if (!token) return null;
  return verifyAccessToken(token);
}

// ─── Role guard ───────────────────────────────────────────────────────────────

export function requireRole(
  session: SessionUser | null,
  ...roles: SessionUser['role'][]
): session is SessionUser {
  return session !== null && roles.includes(session.role);
}
