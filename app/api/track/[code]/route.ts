import { NextRequest }       from 'next/server';
import { db }                from '@/lib/db';
import {
  apiSuccess,
  apiNotFound,
  apiError,
  apiInternalError,
} from '@/lib/api/response';

/**
 * GET /api/track/[code]
 *
 * Accepts either:
 *   • A delivery tracking code  (e.g. EP-1234567890-ABCD)
 *   • An order number            (e.g. ENV-2026-000001)
 *
 * Returns unified tracking data covering the full order lifecycle —
 * from PENDING all the way to DELIVERED — so customers can track
 * from the moment they place an order, not just after dispatch.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const raw = code.trim().toUpperCase();
    if (!raw || raw.length < 4) {
      return apiError('Please enter a valid tracking code or order number.', 400);
    }

    // ── 1. Try delivery tracking code first ─────────────────────────────────
    const delivery = await db.delivery.findUnique({
      where: { tracking_code: raw },
      select: {
        tracking_code: true,
        status:        true,
        dispatched_at: true,
        delivered_at:  true,
        order: {
          select: {
            order_number:   true,
            status:         true,
            delivery_city:  true,
            delivery_state: true,
            created_at:     true,
          },
        },
      },
    });

    if (delivery) {
      return apiSuccess({
        tracking_code:   delivery.tracking_code,
        delivery_status: delivery.status,
        order_number:    delivery.order?.order_number    ?? null,
        order_status:    delivery.order?.status          ?? null,
        delivery_city:   delivery.order?.delivery_city   ?? null,
        delivery_state:  delivery.order?.delivery_state  ?? null,
        dispatched_at:   delivery.dispatched_at?.toISOString() ?? null,
        delivered_at:    delivery.delivered_at?.toISOString()  ?? null,
        order_placed_at: delivery.order?.created_at.toISOString() ?? null,
      });
    }

    // ── 2. Fall back to order number lookup ──────────────────────────────────
    const order = await db.order.findUnique({
      where: { order_number: raw },
      select: {
        order_number:   true,
        status:         true,
        delivery_city:  true,
        delivery_state: true,
        created_at:     true,
        delivery: {
          select: {
            tracking_code: true,
            status:        true,
            dispatched_at: true,
            delivered_at:  true,
          },
        },
      },
    });

    if (!order) {
      return apiNotFound('No order or delivery found for this code.');
    }

    return apiSuccess({
      tracking_code:   order.delivery?.tracking_code ?? raw,
      delivery_status: order.delivery?.status        ?? null,
      order_number:    order.order_number,
      order_status:    order.status,
      delivery_city:   order.delivery_city           ?? null,
      delivery_state:  order.delivery_state          ?? null,
      dispatched_at:   order.delivery?.dispatched_at?.toISOString() ?? null,
      delivered_at:    order.delivery?.delivered_at?.toISOString()  ?? null,
      order_placed_at: order.created_at.toISOString(),
    });

  } catch (err) {
    console.error('[GET /api/track/[code]]', err);
    return apiInternalError();
  }
}
