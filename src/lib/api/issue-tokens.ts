import { db }                               from '@/lib/db';
import { signAccessToken, signRefreshToken } from '@/lib/jwt';
import type { UserRole }                     from '@/lib/api/types';
import type { AuthResponse, SessionUser }    from '@/lib/api/types';

interface UserForToken {
  id:         number;
  first_name: string;
  last_name:  string;
  email:      string;
  role:       UserRole;
  status:     string;
  avatar_url?: string | null;
}

interface IssuedTokens {
  accessToken:  string;
  refreshToken: string;
  authResponse: AuthResponse;
}

export async function issueTokensForUser(
  user: UserForToken,
  req:  Request | { headers: { get(name: string): string | null } },
): Promise<IssuedTokens> {
  const params = {
    userId:     user.id,
    role:       user.role,
    first_name: user.first_name,
    last_name:  user.last_name,
    email:      user.email,
  };

  const accessToken                          = await signAccessToken(params);
  const { token: refreshToken, jti, expiresAt } = await signRefreshToken(params);

  // Persist refresh token for revocation support
  const ip        = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim())
    ?? req.headers.get('x-real-ip')
    ?? undefined;
  const userAgent = req.headers.get('user-agent') ?? undefined;

  await db.refreshToken.create({
    data: {
      jti,
      user_id:    user.id,
      user_role:  user.role,
      ip_address: ip,
      user_agent: userAgent?.substring(0, 500),
      expires_at: expiresAt,
    },
  });

  const sessionUser: SessionUser = {
    id:          user.id,
    uuid:        '',            // not in token — caller can pass if needed
    first_name:  user.first_name,
    last_name:   user.last_name,
    email:       user.email,
    role:        user.role,
    status:      user.status as SessionUser['status'],
    avatar_url:  user.avatar_url,
  };

  const authResponse: AuthResponse = {
    user:   sessionUser,
    tokens: {
      access_token:  accessToken,
      refresh_token: refreshToken,
      expires_in:    900, // 15 minutes in seconds
    },
  };

  return { accessToken, refreshToken, authResponse };
}

/** Pull ip + user-agent from a NextRequest or plain Request */
export function requestMeta(req: { headers: { get(name: string): string | null } }) {
  return {
    ip:        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
               ?? req.headers.get('x-real-ip')
               ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  };
}

/** Lightweight OTP generator — 6-digit numeric string */
export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** 10-minute OTP expiry from now */
export function otpExpiresAt(): Date {
  return new Date(Date.now() + 10 * 60 * 1000);
}
