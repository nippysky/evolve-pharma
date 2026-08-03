/**
 * GET /api/orders — paginated order list (Admin/Staff)
 *
 * Query params:
 *   page, limit
 *   status      — PENDING | CONFIRMED | PROCESSING | DISPATCHED | DELIVERED | CANCELLED
 *   payment     — UNPAID | PAID | PARTIAL | REFUNDED | FAILED
 *   customer_id — filter by customer
 *   search      — order_number or customer email
 *   from, to    — date range (ISO)
 */

import { NextRequest } from 'next/server';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiPaginated,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
  handlePrismaError,
  parsePagination,
} from '@/lib/api/response';
import type { OrderStatus, PaymentStatus } from '@db/enums';

const VALID_STATUSES:  OrderStatus[]  = ['PENDING','CONFIRMED','PROCESSING','DISPATCHED','DELIVERED','CANCELLED'];
const VALID_PAYMENTS:  PaymentStatus[] = ['UNPAID','PAID','PARTIAL','REFUNDED','FAILED'];

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp, { limit: 20 });

    const statusRaw  = sp.get('status');
    const paymentRaw = sp.get('payment');
    const customerId = sp.get('customer_id') ? parseInt(sp.get('customer_id')!, 10) : undefined;
    const search     = sp.get('search') ?? '';
    const from       = sp.get('from');
    const to         = sp.get('to');

    const status  = (statusRaw  && VALID_STATUSES.includes(statusRaw  as OrderStatus))  ? statusRaw  as OrderStatus  : undefined;
    const payment = (paymentRaw && VALID_PAYMENTS.includes(paymentRaw as PaymentStatus)) ? paymentRaw as PaymentStatus : undefined;

    const where = {
      ...(status     ? { status }                  : {}),
      ...(payment    ? { payment_status: payment }  : {}),
      ...(customerId ? { customer_id: customerId }  : {}),
      ...(from || to ? {
        created_at: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to)   } : {}),
        },
      } : {}),
      ...(search ? {
        OR: [
          { order_number: { contains: search } },
          { customer: { user: { email: { contains: search } } } },
        ],
      } : {}),
    };

    const [records, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take:    limit,
        include: {
          customer: {
            include: {
              user: { select: { first_name: true, last_name: true, email: true, phone: true } },
            },
          },
          items:    { include: { product: { select: { sku: true, brand_name: true } } } },
          delivery: { select: { status: true, tracking_code: true, driver_id: true } },
        },
      }),
      db.order.count({ where }),
    ]);

    // Cast to any[] — Prisma includes are typed at the query level; map accesses are safe
    const orders = (records as any[]).map((o) => ({
      id:               o.id,
      uuid:             o.uuid,
      order_number:     o.order_number,
      status:           o.status,
      payment_status:   o.payment_status,
      payment_reference:o.payment_reference,
      delivery_address: o.delivery_address,
      delivery_city:    o.delivery_city,
      delivery_state:   o.delivery_state,
      subtotal:         Number(o.subtotal),
      discount:         Number(o.discount),
      delivery_fee:     Number(o.delivery_fee),
      total:            Number(o.total),
      notes:            o.notes,
      created_at:       o.created_at,
      updated_at:       o.updated_at,
      customer: {
        id:           o.customer.id,
        company_name: o.customer.company_name,
        first_name:   o.customer.user.first_name,
        last_name:    o.customer.user.last_name,
        email:        o.customer.user.email,
        phone:        o.customer.user.phone,
      },
      item_count:  o.items.length,
      delivery:    o.delivery,
    }));

    return apiPaginated(orders, { page, limit, total }, 'Orders retrieved successfully');
  } catch (err) {
    console.error('[GET /api/orders]', err);
    return handlePrismaError(err) ?? apiInternalError();
    return apiInternalError();
  }
}
