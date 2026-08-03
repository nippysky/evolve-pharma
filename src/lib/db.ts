/**
 * Prisma 7 Client — MySQL via @prisma/adapter-mariadb
 *
 * Architecture
 * ────────────
 * • One PrismaClient per process.  Turbopack/Next hot-reload re-evaluates
 *   modules on every change, which would normally create a new pool on each
 *   reload and exhaust Hostinger's tiny connection cap within seconds.
 *   The `globalThis.__prisma` singleton prevents that: the first module
 *   evaluation creates the client; every subsequent hot-reload re-export
 *   the same instance.
 *
 * • Pool sizing vs. Hostinger limits.
 *   Hostinger shared MySQL allows ~25 total connections across ALL clients
 *   (web server, phpMyAdmin, cron, etc.).  Budget:
 *     dev:  2  — enough for local dev; Turbopack runs 1–2 concurrent routes.
 *     prod: 8  — safe under load; leaves ~17 for other MySQL clients.
 *              8 connections × typical 20 ms hold time → ~400 req/s throughput
 *              before queuing, which far exceeds expected admin traffic.
 *
 * • Why a small pool is fine here.
 *   All bulk-import routes use batch queries (createMany/findMany IN) — they
 *   consume ONE connection at a time for ~50 ms regardless of file size.
 *   The old per-row approach fired N concurrent queries; that's been removed.
 *
 * • Timeout strategy.
 *   connectTimeout: fail fast if the TCP handshake stalls (network issue).
 *   acquireTimeout: how long a caller waits for a free slot in the pool.
 *                   30 s is generous for bulk operations; most acquire in <1 ms.
 *   idleTimeout:    release idle connections back to MySQL after 60 s so the
 *                   server's connection table doesn't fill up between requests.
 *
 * • Env-var validation at startup.  Missing vars crash with a clear message
 *   instead of a cryptic "pool timeout" 10 seconds later.
 *
 * Special character note
 * ─────────────────────
 * Next.js uses dotenv-expand, which processes $ in .env.local values as
 * variable references.  The literal password "Acce$$DB2026" must be written
 * as "Acce\$\$DB2026" in .env.local so dotenv-expand emits the two $ signs
 * correctly.  Prisma CLI tools (which use DATABASE_URL) are not affected
 * because the URL already percent-encodes $ as %24.
 */

import { PrismaClient } from '../generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// ─── Environment validation ───────────────────────────────────────────────────

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

// ─── Pool tuning ──────────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV !== 'production';

const POOL_CONFIG = {
  host:     requireEnv('DB_HOST'),
  port:     Number(process.env.DB_PORT ?? 3306),
  user:     requireEnv('DB_USER'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_NAME'),

  // dev=2 keeps hot-reload from touching Hostinger's cap.
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

// ─── Singleton factory ────────────────────────────────────────────────────────

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
