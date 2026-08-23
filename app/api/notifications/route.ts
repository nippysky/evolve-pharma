import { NextRequest } from 'next/server';
import { z }           from 'zod';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {apiSuccess, apiError, apiUnauthorized, apiInternalError, parsePagination} from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp, { limit: 20 });
    const unreadOnly = sp.get('unread') === 'true';

    // ── Sequential queries, never parallel ──────────────────────────────────
    // Serverless runs connectionLimit: 1. Promise.all over DB calls buys no
    // parallelism there — the pool queues them anyway — while adding acquire
    // contention and a real risk of hitting acquireTimeout under load.
    const records = await db.notification.findMany({
      where: {
        user_id: session.userId,
        ...(unreadOnly ? { is_read: false } : {}),
      },
      select: {
        id: true, title: true, body: true, type: true,
        link: true, is_read: true, created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip,
    });

    // groupBy over is_read yields both the all-rows total and the unread count
    // in one round trip, instead of two separate COUNTs.
    const grouped = await db.notification.groupBy({
      by:    ['is_read'],
      where: { user_id: session.userId },
      _count: { _all: true },
    });

    const unreadCount = grouped.find(g => !g.is_read)?._count._all ?? 0;
    const allCount    = grouped.reduce((sum, g) => sum + g._count._all, 0);
    const total       = unreadOnly ? unreadCount : allCount;

    return apiSuccess({
      records,
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
