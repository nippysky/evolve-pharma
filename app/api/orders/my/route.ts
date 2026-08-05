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

    const where = { customer_id: customer.id };

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
