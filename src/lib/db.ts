import { PrismaClient } from '../generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    throw new Error(
      `[db] Missing required env var: ${key}\n` +
      `Check .env.local and ensure $ signs are escaped as \\$`,
    );
  }
  return v;
}

const IS_DEV        = process.env.NODE_ENV !== 'production';
// Vercel injects VERCEL=1 in all environments (preview + production).
// Serverless functions handle exactly one request per instance, so a pool
// larger than 1 just wastes TCP connections and causes pool-timeout errors
// when many instances start simultaneously against a DB with a limited
// max_connections.
const IS_SERVERLESS = Boolean(process.env.VERCEL);

const POOL_CONFIG = {
  host:     requireEnv('DB_HOST'),
  port:     Number(process.env.DB_PORT ?? 3306),
  user:     requireEnv('DB_USER'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_NAME'),

  // 1 connection per serverless invocation — prevents pool exhaustion.
  // 2 in dev, 8 for a long-running server (non-Vercel prod).
  connectionLimit: IS_SERVERLESS ? 1 : IS_DEV ? 2 : 8,

  // Fail fast on TCP connect.
  connectTimeout: 8000,

  // Fail fast in serverless so the user gets an error quickly rather than
  // a 30-second white screen.  Long-running servers keep the generous limit.
  acquireTimeout: IS_SERVERLESS ? 10_000 : 30_000,

  // Release idle connections after 60 s — prevents stale connection errors
  // on the first request after a quiet period.
  idleTimeout: 60_000,

  // Hostinger's MySQL enforces SSL for remote connections from outside their
  // network.  rejectUnauthorized: false accepts their self-signed cert so
  // Vercel can connect without needing to bundle the CA certificate.
  ssl: IS_SERVERLESS ? { rejectUnauthorized: false } : undefined,

  // Fix: MariaDB driver sends LIKE parameters as utf8mb4_bin (binary), but
  // column definitions use utf8mb4_unicode_ci.  Without this, any `contains`
  // (LIKE '%…%') query throws MySQL error 1267 "Illegal mix of collations".
  // Setting the connection collation explicitly forces all string parameters
  // to match the column collation — fixes search and any future LIKE usage.
  collation: 'utf8mb4_unicode_ci',
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaMariaDb(POOL_CONFIG);
  return new PrismaClient({
    adapter,
    log: IS_DEV ? ['warn', 'error'] : ['error'],
  });
}

// Persist the instance across Turbopack hot-reloads in dev.
// In production the module is evaluated once, so globalThis is irrelevant —
// we just create a fresh client and export it.
declare global {
   
  var __prisma: PrismaClient | undefined;
}

export const db: PrismaClient =
  globalThis.__prisma ?? (globalThis.__prisma = createPrismaClient());

// Re-export generated types so callers can `import type { Prisma } from '@/lib/db'`
export type { PrismaClient };
