/**
 * GET /api/notifications/unread-count
 *
 * Dedicated endpoint for the notification badge.
 *
 * The badge polls on an interval for every signed-in user, so this is one of
 * the highest-frequency routes in the app. Hitting the full list endpoint just
 * to read `unread_count` cost three queries per poll (page of records, total
 * count, unread count). On serverless with a connection pool of 1 those are
 * three serialised round trips for a single number.
 *
 * This does exactly one indexed COUNT against (user_id, is_read).
 */

import { NextRequest }  from 'next/server';
import { db }           from '@/lib/db';
import { getSession }   from '@/lib/auth';
import { apiSuccess, apiUnauthorized, apiInternalError } from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();

    const unread = await db.notification.count({
      where: { user_id: session.userId, is_read: false },
    });

    return apiSuccess({ unread_count: unread }, 200, 'Unread count retrieved');
  } catch (err) {
    console.error('[GET /api/notifications/unread-count]', err);
    return apiInternalError();
  }
}
