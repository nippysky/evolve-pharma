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

const IS_DEV = process.env.NODE_ENV !== 'production';

const POOL_CONFIG = {
  host:     requireEnv('DB_HOST'),
  port:     Number(process.env.DB_PORT ?? 3306),
  user:     requireEnv('DB_USER'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_NAME'),

  // cap at 2 in dev to match prod connection limit
  // prod=8 is safe: ~17 connections remain for other MySQL clients.
  // Bulk imports only ever use 1 connection at a time (batch queries).
  connectionLimit: IS_DEV ? 2 : 8,

  // Fail fast on TCP connect — 5 s is plenty for an in-region DB.
  connectTimeout: 5000,

  // How long to wait for a free connection from the pool.
  // 30 s is generous and covers bulk-import hold times.
  acquireTimeout: 30_000,

  // Release idle connections after 60 s — prevents stale connection errors
  // on the first request after a quiet period.
  idleTimeout: 60_000,

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
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const db: PrismaClient =
  globalThis.__prisma ?? (globalThis.__prisma = createPrismaClient());

// Re-export generated types so callers can `import type { Prisma } from '@/lib/db'`
export type { PrismaClient };
