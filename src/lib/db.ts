/**
 * Prisma 7 Client singleton — MySQL via @prisma/adapter-mariadb
 *
 * Prisma 7 requires a driver adapter; it NO LONGER works without one.
 * We use PrismaMariaDb which wraps the `mariadb` Node.js driver (MySQL-compatible).
 *
 * Next.js hot-reload creates new module instances in development.
 * Without the globalThis singleton, each reload opens a new connection pool
 * and Hostinger MySQL (which has a tight connection cap) will error fast.
 *
 * Connection pool: limited to 5 in dev, 10 in prod to stay within Hostinger limits.
 *
 * Required env vars (individual fields — NOT a connection URL):
 *   DB_HOST      e.g. srv1429.hstgr.io
 *   DB_PORT      e.g. 3306
 *   DB_USER      e.g. u143295213_envolve_dbuser
 *   DB_PASSWORD  (your DB password)
 *   DB_NAME      e.g. u143295213_envolve_db
 *
 * Keep DATABASE_URL in .env.local too — Prisma CLI tools use it via prisma.config.ts.
 */

import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const IS_DEV = process.env.NODE_ENV === 'development';

function createClient(): PrismaClient {
  const adapter = new PrismaMariaDb({
    host:            process.env.DB_HOST!,
    port:            Number(process.env.DB_PORT) || 3306,
    user:            process.env.DB_USER!,
    password:        process.env.DB_PASSWORD!,
    database:        process.env.DB_NAME!,
    connectionLimit: IS_DEV ? 5 : 10,
  });

  return new PrismaClient({
    adapter,
    log: IS_DEV ? ['query', 'warn', 'error'] : ['error'],
  });
}

// ─── Singleton ────────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (!IS_DEV) {
  // In production the module is loaded once — no need to cache on globalThis
} else {
  globalForPrisma.prisma = db;
}

// Re-export the generated types so other modules can import from @/lib/db
export type { PrismaClient };
