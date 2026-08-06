import { type NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT }             from 'jose';

const ACCESS_COOKIE  = 'ep_access';
const REFRESH_COOKIE = 'ep_refresh';

const IS_PROD = process.env.NODE_ENV === 'production';

type UserRole = 'ADMIN' | 'STAFF' | 'DRIVER' | 'CUSTOMER';

interface TokenPayload {
  userId:      number;
  role:        UserRole;
  type:        'access' | 'refresh';
  // Display fields embedded so we can re-mint an access token from the refresh token
  first_name?: string;
  last_name?:  string;
  email?:      string;
  jti?:        string;
}

const PROTECTED_ROUTES: Array<{
  prefix:      string;
  roles:       UserRole[];
  loginPath:   string;
}> = [
  { prefix: '/admin',   roles: ['ADMIN', 'STAFF'],              loginPath: '/staff/sign-in'  },
  { prefix: '/staff',   roles: ['ADMIN', 'STAFF'],             loginPath: '/staff/sign-in'  },
  { prefix: '/driver',  roles: ['DRIVER'],                    loginPath: '/driver/sign-in' },
  { prefix: '/portal',  roles: ['CUSTOMER'],                  loginPath: '/sign-in'        },
];

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

async function verifyRefreshJwt(token: string): Promise<TokenPayload | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET!);
    const { payload } = await jwtVerify(token, secret, {
      issuer:   'envolvepharm',
      audience: 'envolvepharm-client',
    });
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

async function mintAccessToken(p: TokenPayload): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
  return new SignJWT({
    userId:     p.userId,
    role:       p.role,
    type:       'access',
    first_name: p.first_name ?? '',
    last_name:  p.last_name  ?? '',
    email:      p.email      ?? '',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setIssuer('envolvepharm')
    .setAudience('envolvepharm-client')
    .sign(secret);
}

function isMobileRequest(req: NextRequest): boolean {
  const accept = req.headers.get('Accept') ?? '';
  const xrw    = req.headers.get('X-Requested-With') ?? '';
  return accept.includes('application/json') || xrw === 'XMLHttpRequest';
}
//
// /staff/sign-in and /driver/sign-in share the /staff/* and /driver/* prefixes
// that the matcher covers, which would cause an infinite redirect loop:
//   visit /staff/sign-in → no token → redirect to /staff/sign-in?redirect=...
//   → middleware fires again → loop → ERR_TOO_MANY_REDIRECTS
//
// Pass these through unconditionally before any token check.

const BYPASS_PATHS = [
  '/staff/sign-in',
  '/staff/forgot-password',
  '/staff/reset-password',
  '/staff/verify',          // invitation link — unauthenticated user sets their password here
  '/driver/sign-in',
  '/driver/forgot-password',
  '/driver/reset-password',
];

/**
 * Attempt a silent token refresh using the refresh cookie.
 * Returns a NextResponse with the new access token set, or null if recovery
 * is not possible (refresh token missing, invalid, or wrong role for route).
 */
async function trySilentRefresh(
  req:   NextRequest,
  route: typeof PROTECTED_ROUTES[number],
): Promise<NextResponse | null> {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const refreshPayload = await verifyRefreshJwt(refreshToken);
  if (!refreshPayload || refreshPayload.type !== 'refresh') return null;

  // Ensure the role in the refresh token is actually allowed on this route
  if (!route.roles.includes(refreshPayload.role)) return null;

  // Mint a fresh access token inline — no DB round-trip needed here.
  // (jti rotation is handled by the explicit /api/auth/refresh endpoint.)
  const newAccessToken = await mintAccessToken(refreshPayload);

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-user-id',   String(refreshPayload.userId));
  reqHeaders.set('x-user-role', refreshPayload.role);

  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.cookies.set(ACCESS_COOKIE, newAccessToken, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 15,
  });
  return res;
}

function loginRedirect(req: NextRequest, route: typeof PROTECTED_ROUTES[number]): NextResponse {
  const fullPath = req.nextUrl.pathname + (req.nextUrl.search ?? '');
  const res = NextResponse.redirect(
    new URL(`${route.loginPath}?redirect=${encodeURIComponent(fullPath)}`, req.url),
  );
  // Clear stale cookies so the browser doesn't send them on the next request
  res.cookies.set(ACCESS_COOKIE,  '', { maxAge: 0, path: '/' });
  res.cookies.set(REFRESH_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}

export default async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Auth pages are always public — never run the token check on them
  if (BYPASS_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Find the matching protected route prefix
  const route = PROTECTED_ROUTES.find(r => pathname.startsWith(r.prefix));

  // Unprotected path — pass through
  if (!route) return NextResponse.next();

  // Read access token from cookie or Authorization header
  const token =
    req.cookies.get(ACCESS_COOKIE)?.value ??
    req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');

  // ── Case 1: No access token at all ──────────────────────────────────────────
  // The browser deletes the cookie when its maxAge (15 min) elapses, so an
  // absent cookie is the most common "logged out during inactivity" symptom.
  // Try to recover from the refresh token before redirecting to login.
  if (!token) {
    if (!isMobileRequest(req)) {
      const recovered = await trySilentRefresh(req, route);
      if (recovered) return recovered;
    }
    return isMobileRequest(req)
      ? NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 })
      : loginRedirect(req, route);
  }

  // ── Case 2: Access token present but invalid/expired ────────────────────────
  const payload = await verifyToken(token);

  if (!payload) {
    if (!isMobileRequest(req)) {
      const recovered = await trySilentRefresh(req, route);
      if (recovered) return recovered;
    }
    return isMobileRequest(req)
      ? NextResponse.json({ status: 'error', message: 'Token expired or invalid' }, { status: 401 })
      : loginRedirect(req, route);
  }

  // ── Case 3: Valid token but wrong role ───────────────────────────────────────
  if (!route.roles.includes(payload.role)) {
    const roleHome: Record<UserRole, string> = {
      ADMIN:    '/admin/overview',
      STAFF:    '/admin/overview',
      DRIVER:   '/driver',
      CUSTOMER: '/portal',
    };
    return isMobileRequest(req)
      ? NextResponse.json({ status: 'error', message: 'Forbidden' }, { status: 403 })
      : NextResponse.redirect(new URL(roleHome[payload.role], req.url));
  }

  // ── ✅ Authorised ────────────────────────────────────────────────────────────
  // Inject user info as request headers so route handlers don't need to
  // re-verify the JWT (minor perf win).
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-user-id',   String(payload.userId));
  reqHeaders.set('x-user-role', payload.role);

  return NextResponse.next({ request: { headers: reqHeaders } });
}

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*', '/driver/:path*', '/portal/:path*'],
};
