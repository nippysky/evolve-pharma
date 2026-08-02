/**
 * POST /api/auth/refresh
 *
 * Rotates the refresh token and issues a new access token.
 *
 * Security model (refresh token rotation):
 *   1. Read ep_refresh cookie (or Authorization: Bearer)
 *   2. Verify JWT signature + expiry
 *   3. Check jti exists in DB (not revoked)
 *   4. Delete old jti from DB (single-use token)
 *   5. Issue brand-new access token + refresh token
 *   6. Store new jti in DB
 *   7. Set both new tokens as httpOnly cookies
 *
 * This prevents refresh token replay attacks — a stolen refresh token
 * becomes invalid the moment the legitimate client rotates it.
 *
 * No auth (access token) required — this route is used precisely when
 * the access token has expired.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db }                         from '@/lib/db';
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
}                                     from '@/lib/jwt';
import {
  REFRESH_COOKIE,
  setAuthCookies,
  clearAuthCookies,
}                                     from '@/lib/auth';
import {
  apiSuccess,
  apiUnauthorized,
  apiInternalError,
}                                     from '@/lib/api/response';
import type { UserRole }              from '@/lib/api/types';

export async function POST(req: NextRequest) {
  try {
    // ── 1. Extract refresh token ──────────────────────────────────────────
    const tokenFromCookie = req.cookies.get(REFRESH_COOKIE)?.value;
    const tokenFromHeader = req.headers
      .get('Authorization')
      ?.replace(/^Bearer\s+/i, '');
    const rawToken = tokenFromCookie ?? tokenFromHeader;

    if (!rawToken) {
      return apiUnauthorized('No refresh token provided.');
    }

    // ── 2. Verify JWT signature + expiry ───────────────────────────────────
    const payload = await verifyRefreshToken(rawToken);

    if (!payload || payload.type !== 'refresh' || !payload.jti) {
      return apiUnauthorized('Invalid or expired refresh token.');
    }

    // ── 3. Verify jti exists in DB (revocation check) ─────────────────────
    const storedToken = await db.refreshToken.findUnique({
      where:  { jti: payload.jti },
      select: { jti: true, user_id: true, expires_at: true },
    });

    if (!storedToken) {
      // Token was already rotated or explicitly revoked — clear cookies to
      // force a full sign-in (this may indicate a replay attack).
      const res = NextResponse.json(
        { status: 'error', message: 'Session expired. Please sign in again.' },
        { status: 401 },
      );
      clearAuthCookies(res);
      return res;
    }

    // ── 4. Delete old jti (single-use rotation) ───────────────────────────
    await db.refreshToken.delete({ where: { jti: payload.jti } });

    // ── 5-6. Issue new token pair + store new jti ─────────────────────────
    const params = {
      userId:     payload.userId,
      role:       payload.role as UserRole,
      first_name: payload.first_name,
      last_name:  payload.last_name,
      email:      payload.email,
    };

    const accessToken                             = await signAccessToken(params);
    const { token: refreshToken, jti: newJti, expiresAt } = await signRefreshToken(params);

    const ip        = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? undefined;
    const userAgent = req.headers.get('user-agent') ?? undefined;

    await db.refreshToken.create({
      data: {
        jti:        newJti,
        user_id:    payload.userId,
        user_role:  payload.role,
        ip_address: ip,
        user_agent: userAgent?.substring(0, 500),
        expires_at: expiresAt,
      },
    });

    // ── 7. Return new tokens ───────────────────────────────────────────────
    const res = NextResponse.json({
      status:  'success',
      message: 'Token refreshed.',
      data: {
        tokens: {
          access_token:  accessToken,
          refresh_token: refreshToken,
          expires_in:    900,
        },
      },
    });

    setAuthCookies(res, accessToken, refreshToken);
    return res;
  } catch (err) {
    console.error('[POST /api/auth/refresh]', err);
    return apiInternalError();
  }
}
