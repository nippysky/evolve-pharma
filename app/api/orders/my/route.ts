import { NextRequest }  from 'next/server';
import { db }           from '@/lib/db';
import { getSession }   from '@/lib/auth';
import {
  apiPaginated,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
  parsePagination,
} from '@/lib/api/response';
import type { OrderStatus } from '@db/enums';

/** Mirrors the Prisma enum. Never invent members — the API filters on these. */
const VALID_STATUSES: OrderStatus[] = [
  'PENDING', 'CONFIRMED', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED',
];

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'CUSTOMER') return apiForbidden();

    const customer = await db.customer.findUnique({
      where:  { user_id: session.userId },
      select: { id: true },
    });
    if (!customer) return apiError('Customer account not found.', 404);

    const sp    = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp, { limit: 10 });

    // ── Status filter ───────────────────────────────────────────────────────
    // Accepts a concrete OrderStatus, or the shorthand `active` for "not
    // finished" — the state a customer actually thinks in ("what's still
    // coming?"). Defining `active` here rather than in the client keeps the
    // meaning in one place if a status is ever added to the enum.
    //
    // An unrecognised value is rejected rather than ignored. Silently dropping
    // an unknown filter returns the full list, which reads as "the filter did
    // nothing" and hides the mistake — a bug this codebase has already had.
    const statusParam = sp.get('status')?.trim().toUpperCase();

    let statusWhere: Record<string, unknown> = {};
    if (statusParam) {
      if (statusParam === 'ACTIVE') {
        statusWhere = { status: { notIn: ['DELIVERED', 'CANCELLED'] } };
      } else if (VALID_STATUSES.includes(statusParam as OrderStatus)) {
        statusWhere = { status: statusParam as OrderStatus };
      } else {
        return apiError(
          `Unknown status "${sp.get('status')}". Use one of: ${VALID_STATUSES.join(', ')}, or "active".`,
          400,
        );
      }
    }

    const where = { customer_id: customer.id, ...statusWhere };

    const total = await db.order.count({ where });

    const orders = await db.order.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
      include: {
        items: {
          take: 3,
          include: {
            product: {
              select: {
                brand_name:   true,
                sku:          true,
                images: { where: { is_primary: true }, take: 1, select: { url: true } },
              },
            },
          },
        },
        delivery: { select: { status: true, tracking_code: true } },
      },
    });

    const records = orders.map(o => ({
      id:             o.id,
      order_number:   o.order_number,
      status:         o.status,
      payment_status: o.payment_status,
      subtotal:       Number(o.subtotal),
      delivery_fee:   Number(o.delivery_fee),
      total:          Number(o.total),
      created_at:     o.created_at,
      preview_items: o.items.map(i => ({
        brand_name:    i.product.brand_name,
        sku:           i.product.sku,
        quantity:      i.quantity,
        unit_price:    Number(i.unit_price),
        primary_image: i.product.images[0]?.url ?? null,
      })),
      delivery_status: o.delivery?.status ?? null,
      tracking_code:   o.delivery?.tracking_code ?? null,
    }));

    return apiPaginated(records, { page, limit, total }, 'Your orders retrieved successfully.');
  } catch (err) {
    console.error('[GET /api/orders/my]', err);
    return apiInternalError();
  }
}
