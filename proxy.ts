/**
 * Next.js 16 Proxy (formerly middleware.ts)
 *
 * Runs on the NODE.JS runtime (not Edge) — required for jose JWT verification.
 * Protects /admin, /staff, /driver, and /portal routes based on the JWT
 * stored in the ep_access httpOnly cookie or the Authorization: Bearer header.
 *
 * Route → Required role:
 *   /admin/*   → ADMIN
 *   /staff/*   → ADMIN | STAFF
 *   /driver/*  → DRIVER
 *   /portal/*  → CUSTOMER
 *
 * Unauthenticated or wrong-role requests are redirected to the appropriate
 * sign-in page. Mobile clients will receive a 401 JSON response instead
 * (detected via Accept: application/json or X-Requested-With: XMLHttpRequest).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { jwtVerify }                      from 'jose';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCESS_COOKIE = 'ep_access';

type UserRole = 'ADMIN' | 'STAFF' | 'DRIVER' | 'CUSTOMER';

interface TokenPayload {
  userId: number;
  role:   UserRole;
  type:   'access' | 'refresh';
}

// ─── Route protection map ─────────────────────────────────────────────────────

const PROTECTED_ROUTES: Array<{
  prefix:      string;
  roles:       UserRole[];
  loginPath:   string;
}> = [
  { prefix: '/admin',   roles: ['ADMIN'],                     loginPath: '/sign-in'        },
  { prefix: '/staff',   roles: ['ADMIN', 'STAFF'],             loginPath: '/staff/sign-in'  },
  { prefix: '/driver',  roles: ['DRIVER'],                    loginPath: '/driver/sign-in' },
  { prefix: '/portal',  roles: ['CUSTOMER'],                  loginPath: '/sign-in'        },
];

// ─── JWT verification ─────────────────────────────────────────────────────────

async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const secret  = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
    const { payload } = await jwtVerify(token, secret, {
      issuer:   'envolvepharm',
      audience: 'envolvepharm-client',
    });
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

// ─── Helper: detect mobile / API clients ─────────────────────────────────────

function isMobileRequest(req: NextRequest): boolean {
  const accept = req.headers.get('Accept') ?? '';
  const xrw    = req.headers.get('X-Requested-With') ?? '';
  return accept.includes('application/json') || xrw === 'XMLHttpRequest';
}

// ─── Proxy function ───────────────────────────────────────────────────────────

export default async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Find the matching protected route prefix
  const route = PROTECTED_ROUTES.find(r => pathname.startsWith(r.prefix));

  // Unprotected path — pass through
  if (!route) return NextResponse.next();

  // Read token from cookie or Authorization header
  const token =
    req.cookies.get(ACCESS_COOKIE)?.value ??
    req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return isMobileRequest(req)
      ? NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL(`${route.loginPath}?redirect=${encodeURIComponent(pathname)}`, req.url));
  }

  const payload = await verifyToken(token);

  if (!payload) {
    // Token invalid or expired
    const res = isMobileRequest(req)
      ? NextResponse.json({ status: 'error', message: 'Token expired or invalid' }, { status: 401 })
      : NextResponse.redirect(new URL(`${route.loginPath}?redirect=${encodeURIComponent(pathname)}`, req.url));

    // Clear stale cookie on redirect
    if (!isMobileRequest(req)) {
      res.cookies.set(ACCESS_COOKIE, '', { maxAge: 0, path: '/' });
    }
    return res;
  }

  if (!route.roles.includes(payload.role)) {
    // Authenticated but wrong role — send to their own dashboard
    const roleHome: Record<UserRole, string> = {
      ADMIN:    '/admin',
      STAFF:    '/staff',
      DRIVER:   '/driver',
      CUSTOMER: '/portal',
    };
    return isMobileRequest(req)
      ? NextResponse.json({ status: 'error', message: 'Forbidden' }, { status: 403 })
      : NextResponse.redirect(new URL(roleHome[payload.role], req.url));
  }

  // ✅ Authorised — inject user info as headers so route handlers can read it
  // without verifying the JWT a second time (minor perf win)
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-user-id',   String(payload.userId));
  reqHeaders.set('x-user-role', payload.role);

  return NextResponse.next({ request: { headers: reqHeaders } });
}

// ─── Matcher — only run on protected route prefixes ───────────────────────────

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*', '/driver/:path*', '/portal/:path*'],
};
