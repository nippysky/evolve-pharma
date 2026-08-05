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

  // Read token from cookie or Authorization header
  const token =
    req.cookies.get(ACCESS_COOKIE)?.value ??
    req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) {
    // Preserve the full URL (path + query string) so redirected users land
    // back on the right page after signing in.
    const fullPath = req.nextUrl.pathname + (req.nextUrl.search ?? '');
    return isMobileRequest(req)
      ? NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL(`${route.loginPath}?redirect=${encodeURIComponent(fullPath)}`, req.url));
  }

  const payload = await verifyToken(token);

  if (!payload) {
    // Access token expired/invalid — try a silent refresh before kicking the user out.
    // This covers the case where the 15-min access token expired during normal navigation
    // but the 7-day refresh token is still valid (the common "logout after 15 min" bug).
    if (!isMobileRequest(req)) {
      const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
      if (refreshToken) {
        const refreshPayload = await verifyRefreshJwt(refreshToken);
        if (refreshPayload?.type === 'refresh') {
          // Issue a new access token inline — no DB lookup needed here.
          // (The explicit /api/auth/refresh endpoint handles jti rotation for API clients.)
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
      }
    }

    // No valid refresh token — redirect to sign-in
    const fullPath = req.nextUrl.pathname + (req.nextUrl.search ?? '');
    const res = isMobileRequest(req)
      ? NextResponse.json({ status: 'error', message: 'Token expired or invalid' }, { status: 401 })
      : NextResponse.redirect(new URL(`${route.loginPath}?redirect=${encodeURIComponent(fullPath)}`, req.url));

    // Clear stale cookies on redirect
    res.cookies.set(ACCESS_COOKIE,  '', { maxAge: 0, path: '/' });
    res.cookies.set(REFRESH_COOKIE, '', { maxAge: 0, path: '/' });
    return res;
  }

  if (!route.roles.includes(payload.role)) {
    // Authenticated but wrong role — send to their own dashboard
    const roleHome: Record<UserRole, string> = {
      ADMIN:    '/admin/overview',
      STAFF:    '/admin/overview',  // STAFF uses the same console as ADMIN
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

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*', '/driver/:path*', '/portal/:path*'],
};
