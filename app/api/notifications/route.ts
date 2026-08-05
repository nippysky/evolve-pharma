import { NextRequest } from 'next/server';
import { z }           from 'zod';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiSuccess,
  apiPaginated,
  apiError,
  apiUnauthorized,
  apiInternalError,
  parsePagination,
} from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp, { limit: 20 });
    const unreadOnly = sp.get('unread') === 'true';

    const where = {
      user_id:  session.userId,
      ...(unreadOnly ? { is_read: false } : {}),
    };

    const [records, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take:    limit,
      }),
      db.notification.count({ where }),
      db.notification.count({ where: { user_id: session.userId, is_read: false } }),
    ]);

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
