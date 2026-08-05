import { SignJWT, jwtVerify } from 'jose';
import { v4 as uuidv4 }      from 'uuid';

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

export interface SignTokenParams {
  userId:     number;
  role:       TokenPayload['role'];
  first_name: string;
  last_name:  string;
  email:      string;
}

function getSecret(key: string): Uint8Array {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return new TextEncoder().encode(value);
}

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
