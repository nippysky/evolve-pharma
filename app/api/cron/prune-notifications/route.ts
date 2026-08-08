/**
 * GET /api/cron/prune-notifications
 *
 * Retention job for the notifications table.
 *
 * Notifications are append-only and every order produces several rows across
 * the customer and the internal team. Without pruning the table grows without
 * bound, which eventually slows the unread COUNT the badge depends on and
 * bloats the indexes.
 *
 * Policy:
 *   - read notifications older than READ_RETENTION_DAYS are removed
 *   - anything older than HARD_RETENTION_DAYS is removed regardless of state,
 *     so notifications nobody ever opened don't accumulate forever
 *
 * Deletes run in bounded batches so the job never holds a long lock on a table
 * the app is actively reading.
 *
 * Scheduled by vercel.json. Protected by CRON_SECRET — Vercel Cron sends it as
 * a bearer token, and without a matching secret the route refuses to run.
 */

import { NextRequest } from 'next/server';
import { db }          from '@/lib/db';
import { apiSuccess, apiForbidden, apiInternalError } from '@/lib/api/response';

const READ_RETENTION_DAYS = 60;
const HARD_RETENTION_DAYS = 180;
const BATCH_SIZE          = 1_000;
const MAX_BATCHES         = 20;   // ceiling per run — the next run picks up the rest

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;

    // Fail closed: if no secret is configured the endpoint stays disabled
    // rather than becoming an unauthenticated delete.
    if (!secret) {
      console.warn('[cron/prune-notifications] CRON_SECRET not set — refusing to run');
      return apiForbidden('Cron secret not configured.');
    }
    if (req.headers.get('authorization') !== `Bearer ${secret}`) {
      return apiForbidden('Invalid cron credentials.');
    }

    let deletedRead = 0;
    let deletedOld  = 0;

    // 1. Read notifications past the soft window
    for (let i = 0; i < MAX_BATCHES; i++) {
      const n = await db.$executeRawUnsafe(
        `DELETE FROM notifications
         WHERE is_read = 1
           AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
         LIMIT ?`,
        READ_RETENTION_DAYS,
        BATCH_SIZE,
      );
      deletedRead += n;
      if (n < BATCH_SIZE) break;
    }

    // 2. Anything past the hard window, read or not
    for (let i = 0; i < MAX_BATCHES; i++) {
      const n = await db.$executeRawUnsafe(
        `DELETE FROM notifications
         WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
         LIMIT ?`,
        HARD_RETENTION_DAYS,
        BATCH_SIZE,
      );
      deletedOld += n;
      if (n < BATCH_SIZE) break;
    }

    const total = deletedRead + deletedOld;
    console.log(
      `[cron/prune-notifications] removed ${total} row(s) ` +
      `(${deletedRead} read >${READ_RETENTION_DAYS}d, ${deletedOld} any >${HARD_RETENTION_DAYS}d)`,
    );

    return apiSuccess(
      {
        deleted_read: deletedRead,
        deleted_old:  deletedOld,
        total,
        read_retention_days: READ_RETENTION_DAYS,
        hard_retention_days: HARD_RETENTION_DAYS,
      },
      200,
      `Pruned ${total} notification(s).`,
    );
  } catch (err) {
    console.error('[GET /api/cron/prune-notifications]', err);
    return apiInternalError();
  }
}
