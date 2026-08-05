import { NextRequest }       from 'next/server';
import { db }                from '@/lib/db';
import {
  apiSuccess,
  apiNotFound,
  apiError,
  apiInternalError,
} from '@/lib/api/response';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    if (!code || code.trim().length < 4) {
      return apiError('Please enter a valid tracking code.', 400);
    }
    const delivery = await db.delivery.findUnique({
      where: { tracking_code: code.trim().toUpperCase() },
      select: {
        tracking_code: true,
        status:        true,
        dispatched_at: true,
        delivered_at:  true,
        order_id:      true,
      },
    });

    if (!delivery) return apiNotFound('Tracking code');

    // 2. Fetch the linked order (sequential)
    const order = await db.order.findUnique({
      where:  { id: delivery.order_id },
      select: {
        order_number:    true,
        status:          true,
        delivery_city:   true,
        delivery_state:  true,
        created_at:      true,
      },
    });

    return apiSuccess({
      tracking_code:  delivery.tracking_code,
      delivery_status: delivery.status,
      order_number:    order?.order_number ?? null,
      order_status:    order?.status       ?? null,
      delivery_city:   order?.delivery_city  ?? null,
      delivery_state:  order?.delivery_state ?? null,
      dispatched_at:   delivery.dispatched_at?.toISOString() ?? null,
      delivered_at:    delivery.delivered_at?.toISOString()  ?? null,
      order_placed_at: order?.created_at.toISOString() ?? null,
    });
  } catch (err) {
    console.error('[GET /api/track/[code]]', err);
    return apiInternalError();
  }
}
