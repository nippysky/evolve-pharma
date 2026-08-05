import { NextRequest, NextResponse } from 'next/server';
import { db }                         from '@/lib/db';
import { verifyRefreshToken }         from '@/lib/jwt';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
}                                     from '@/lib/auth';
import { writeAuditLog }              from '@/lib/audit';
import { apiInternalError }           from '@/lib/api/response';

export async function POST(req: NextRequest) {
  try {
    const rawToken =
      req.cookies.get(REFRESH_COOKIE)?.value ??
      req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');

    // Build the response (always clear cookies, regardless of token state)
    const res = NextResponse.json({
      status:  'success',
      message: 'Signed out successfully.',
      data:    null,
    });
    clearAuthCookies(res);

    if (!rawToken) return res;

    // Verify to get the jti — ignore expiry errors (just revoke if possible)
    const payload = await verifyRefreshToken(rawToken);

    if (payload?.jti) {
      // Revoke this session (best-effort — don't fail if already revoked)
      await db.refreshToken
        .delete({ where: { jti: payload.jti } })
        .catch(() => {
          // Token was already rotated or never in DB — safe to ignore
        });

      void writeAuditLog({
        userId:      payload.userId,
        userType:    payload.role,
        email:       payload.email,
        action:      'LOGOUT',
        description: `${payload.role} signed out`,
        req,
      });
    }

    return res;
  } catch (err) {
    console.error('[POST /api/auth/logout]', err);
    return apiInternalError();
  }
}
