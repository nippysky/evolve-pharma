import { NextRequest } from 'next/server';
import { z }           from 'zod';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {apiSuccess, apiError, apiUnauthorized, apiInternalError, parsePagination} from '@/lib/api/response';

interface NotificationRow {
  id:         number;
  title:      string;
  body:       string;
  type:       string;
  link:       string | null;
  is_read:    number | boolean;
  created_at: Date;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp, { limit: 20 });
    const unreadOnly = sp.get('unread') === 'true';

    // ── Two sequential queries, never parallel ──────────────────────────────
    // Serverless runs connectionLimit: 1. Promise.all over DB calls buys no
    // parallelism there — the pool queues them anyway — while adding acquire
    // contention and a real risk of hitting acquireTimeout under load. The two
    // counts are also folded into a single aggregate rather than two COUNTs.
    //
    // Raw SQL keeps `link` present regardless of whether the Prisma client has
    // been regenerated since that column was added.
    const records = unreadOnly
      ? await db.$queryRaw<NotificationRow[]>`
          SELECT id, title, body, type, link, is_read, created_at
          FROM notifications
          WHERE user_id = ${session.userId} AND is_read = 0
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${skip}
        `
      : await db.$queryRaw<NotificationRow[]>`
          SELECT id, title, body, type, link, is_read, created_at
          FROM notifications
          WHERE user_id = ${session.userId}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${skip}
        `;

    // One pass over the user's rows yields both the filtered total and the
    // unread count, instead of two separate COUNT round trips.
    const counts = await db.$queryRaw<Array<{ all_count: bigint | number; unread_count: bigint | number }>>`
      SELECT COUNT(*) AS all_count,
             SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread_count
      FROM notifications
      WHERE user_id = ${session.userId}
    `;

    const allCount    = Number(counts[0]?.all_count    ?? 0);
    const unreadCount = Number(counts[0]?.unread_count ?? 0);
    const total       = unreadOnly ? unreadCount : allCount;

    return apiSuccess({
      // MySQL returns TINYINT for booleans — normalise so the client gets real booleans.
      records: records.map(r => ({ ...r, is_read: Boolean(r.is_read) })),
      pagination: {
        current_page: page,
        per_page:     limit,
        total,
        total_pages:  Math.ceil(total / limit),
      },
      unread_count: unreadCount,
    }, 200, 'Notifications retrieved');
  } catch (err) {
    console.error('[GET /api/notifications]', err);
    return apiInternalError();
  }
}

const patchSchema = z.object({
  ids: z.array(z.number().int().positive()).optional(), // if omitted, mark all
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return apiError('Invalid request body', 400);

    const { ids } = parsed.data;

    await db.notification.updateMany({
      where: {
        user_id: session.userId,
        is_read: false,
        ...(ids?.length ? { id: { in: ids } } : {}),
      },
      data: { is_read: true },
    });

    return apiSuccess({ marked_read: true }, 200, 'Notifications marked as read');
  } catch (err) {
    console.error('[PATCH /api/notifications]', err);
    return apiInternalError();
  }
}
