/**
 * @deprecated — Old server-side PHP fetch wrapper. Replaced by Prisma 7 + db.ts.
 *
 * Server components and route handlers now query the DB directly via:
 *   import { db } from '@/lib/db';
 *   const users = await db.user.findMany();
 *
 * This stub exists only to prevent import errors during migration.
 */

export {};
