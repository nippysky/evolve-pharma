/**
 * JWT utilities — powered by `jose` v6 (pure ESM, Web-crypto compatible)
 *
 * Two-token strategy:
 *   access_token  — 15 min, contains userId + role + display fields.
 *                   Used on every request — avoids DB lookup for basic session data.
 *   refresh_token — 7 days, contains userId + role + jti (UUID).
 *                   jti is stored in DB (refresh_tokens table).
 *                   On logout or force-revoke, the DB row is deleted —
 *                   the token becomes permanently invalid even before expiry.
 *
 * Web clients  → tokens stored as httpOnly cookies (set by API routes).
 * Mobile clients → tokens returned in JSON body, sent as Authorization: Bearer.
 *
 * Why embed display fields in the JWT?
 * ─────────────────────────────────────
 * Layouts need to render the user's name and email in the sidebar / topbar.
 * Fetching from DB on every server component render adds latency and connection
 * overhead. Embedding them in the JWT means zero extra queries — they are
 * verified for authenticity with every token validation.
 * Downside: if a user changes their name, they need to log out and back in.
 * This is acceptable for a pharma ERP where profile changes are rare.
 */

import { SignJWT, jwtVerify } from 'jose';
import { v4 as uuidv4 }      from 'uuid';

// ─── Payload shape ────────────────────────────────────────────────────────────

export interface TokenPayload {
  // Identity
  userId:     number;
  role:       'ADMIN' | 'STAFF' | 'DRIVER' | 'CUSTOMER';
  type:       'access' | 'refresh';

  // Display fields (embedded so layouts need zero DB queries)
  first_name: string;
  last_name:  string;
  email:      string;

  // Only present on refresh tokens
  jti?: string;

  // Standard JWT registered claims (auto-populated by jose)
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
}

// ─── Sign params ──────────────────────────────────────────────────────────────

export interface SignTokenParams {
  userId:     number;
  role:       TokenPayload['role'];
  first_name: string;
  last_name:  string;
  email:      string;
}

// ─── Secrets ──────────────────────────────────────────────────────────────────

function getSecret(key: string): Uint8Array {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return new TextEncoder().encode(value);
}

// ─── Sign ─────────────────────────────────────────────────────────────────────

export async function signAccessToken(params: SignTokenParams): Promise<string> {
  return new SignJWT({
    userId:     params.userId,
    role:       params.role,
    type:       'access',
    first_name: params.first_name,
    last_name:  params.last_name,
    email:      params.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setIssuer('envolvepharm')
    .setAudience('envolvepharm-client')
    .sign(getSecret('JWT_ACCESS_SECRET'));
}

export async function signRefreshToken(
  params: SignTokenParams,
): Promise<{ token: string; jti: string; expiresAt: Date }> {
  const jti       = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const token = await new SignJWT({
    userId:     params.userId,
    role:       params.role,
    type:       'refresh',
    first_name: params.first_name,
    last_name:  params.last_name,
    email:      params.email,
    jti,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .setJti(jti)
    .setIssuer('envolvepharm')
    .setAudience('envolvepharm-client')
    .sign(getSecret('JWT_REFRESH_SECRET'));

  return { token, jti, expiresAt };
}

// ─── Verify ───────────────────────────────────────────────────────────────────

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret('JWT_ACCESS_SECRET'), {
      issuer:   'envolvepharm',
      audience: 'envolvepharm-client',
    });
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret('JWT_REFRESH_SECRET'), {
      issuer:   'envolvepharm',
      audience: 'envolvepharm-client',
    });
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

// ─── Setup token (used between verify-OTP and create-password steps) ──────────

export interface SetupTokenPayload {
  userId: number;
  email:  string;
  type:   'setup';
}

/**
 * Short-lived (30 min) token issued after OTP verification.
 * Authorises the create-password step without issuing full session tokens yet.
 */
export async function signSetupToken(userId: number, email: string): Promise<string> {
  return new SignJWT({ userId, email, type: 'setup' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30m')
    .setIssuer('envolvepharm')
    .setAudience('envolvepharm-setup')
    .sign(getSecret('JWT_ACCESS_SECRET'));
}

export async function verifySetupToken(token: string): Promise<SetupTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret('JWT_ACCESS_SECRET'), {
      issuer:   'envolvepharm',
      audience: 'envolvepharm-setup',
    });
    const p = payload as unknown as SetupTokenPayload;
    if (p.type !== 'setup') return null;
    return p;
  } catch {
    return null;
  }
}
