import { NextRequest }  from 'next/server';
import { z }            from 'zod';
import { db }           from '@/lib/db';
import { getSession }   from '@/lib/auth';
import { createOrder }  from '@/lib/orders';
import { verifyPaystackPayment } from '@/lib/paystack';
import {
  apiSuccess,
  apiPaginated,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
  handlePrismaError,
  parsePagination,
} from '@/lib/api/response';
import type { OrderStatus, PaymentStatus } from '@db/enums';

const VALID_STATUSES:  OrderStatus[]  = ['PENDING','CONFIRMED','PROCESSING','DISPATCHED','DELIVERED','CANCELLED'];
const VALID_PAYMENTS:  PaymentStatus[] = ['UNPAID','PAID','PARTIAL','REFUNDED','FAILED'];

const orderSchema = z.object({
  items: z
    .array(z.object({
      product_id: z.number().int().positive(),
      quantity:   z.number().int().positive(),
    }))
    .min(1, 'Order must contain at least one item.')
    .max(50, 'Maximum 50 line items per order.'),
  state:              z.string().min(2),
  city:               z.string().min(2),
  street_address:     z.string().min(8),
  contact_phone:      z.string().min(8),
  delivery_notes:     z.string().optional(),
  po_number:          z.string().optional(),
  payment_method:     z.enum(['paystack', 'bank_transfer', 'cash_on_delivery']),
  paystack_reference: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (session.role !== 'CUSTOMER') return apiForbidden('Only customer accounts can place orders.');

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body.', 400); }

    const parsed = orderSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid request.', 422);
    }

    const {
      items, state, city, street_address,
      contact_phone, delivery_notes, po_number,
      payment_method, paystack_reference,
    } = parsed.data;

    // Verify Paystack payment before touching inventory
    if (payment_method === 'paystack') {
      if (!paystack_reference) {
        return apiError('paystack_reference is required for Paystack payments.', 400);
      }
      const verification = await verifyPaystackPayment(paystack_reference);
      if (!verification.paid) {
        return apiError(
          `Payment verification failed: ${verification.message}`,
          402,
        );
      }
    }

    const customer = await db.customer.findUnique({
      where:  { user_id: session.userId },
      select: { id: true, status: true },
    });
    if (!customer) return apiError('Customer account not found.', 404);

    const result = await createOrder({
      customerId:       customer.id,
      userId:           session.userId,
      items,
      deliveryState:    state,
      deliveryCity:     city,
      deliveryAddress:  street_address,
      contactPhone:     contact_phone,
      deliveryNotes:    delivery_notes,
      poNumber:         po_number,
      paymentMethod:    payment_method,
      paystackReference: paystack_reference,
    });

    if (!result.ok) return apiError(result.message, 400);

    return apiSuccess(
      { order_number: result.orderNumber, order_id: result.orderId, total: result.total },
      201,
      'Order placed successfully.',
    );
  } catch (err) {
    console.error('[POST /api/orders]', err);
    return apiInternalError();
  }
}

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
    const rawOrders = await db.order.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
      select: {
        id: true, uuid: true, order_number: true,
        status: true, payment_status: true, payment_reference: true,
        delivery_address: true, delivery_city: true, delivery_state: true,
        subtotal: true, discount: true, delivery_fee: true, total: true,
        notes: true, created_at: true, updated_at: true,
        customer_id: true,
      },
    });

    // Total count
    const total = await db.order.count({ where });

    if (rawOrders.length === 0) {
      return apiPaginated([], { page, limit, total }, 'Orders retrieved successfully');
    }

    const orderIds = rawOrders.map(o => o.id);
    const custIds  = [...new Set(rawOrders.map(o => o.customer_id))];

    // Customers (single batch query)
    const customers = await db.customer.findMany({
      where:  { id: { in: custIds } },
      select: {
        id: true, company_name: true,
        user: { select: { first_name: true, last_name: true, email: true, phone: true } },
      },
    });

    // Order items (single batch query)
    const allItems = await db.orderItem.findMany({
      where:  { order_id: { in: orderIds } },
      select: {
        order_id: true, id: true,
        product: { select: { sku: true, brand_name: true } },
      },
    });

    // Deliveries (single batch query)
    const deliveries = await db.delivery.findMany({
      where:  { order_id: { in: orderIds } },
      select: { order_id: true, status: true, tracking_code: true, driver_id: true },
    });

    // ── Merge in JavaScript ───────────────────────────────────────────────────
    const custMap  = new Map(customers.map(c => [c.id, c]));
    const itemsMap = new Map<number, number>();   // order_id → item count
    for (const item of allItems) {
      itemsMap.set(item.order_id, (itemsMap.get(item.order_id) ?? 0) + 1);
    }
    const delivMap = new Map(deliveries.map(d => [d.order_id, d]));

    const orders = rawOrders.map(o => {
      const cust = custMap.get(o.customer_id);
      return {
        id:                o.id,
        uuid:              o.uuid,
        order_number:      o.order_number,
        status:            o.status,
        payment_status:    o.payment_status,
        payment_reference: o.payment_reference,
        delivery_address:  o.delivery_address,
        delivery_city:     o.delivery_city,
        delivery_state:    o.delivery_state,
        subtotal:          Number(o.subtotal),
        discount:          Number(o.discount),
        delivery_fee:      Number(o.delivery_fee),
        total:             Number(o.total),
        notes:             o.notes,
        created_at:        o.created_at,
        updated_at:        o.updated_at,
        customer: cust ? {
          id:           cust.id,
          company_name: cust.company_name,
          first_name:   cust.user.first_name,
          last_name:    cust.user.last_name,
          email:        cust.user.email,
          phone:        cust.user.phone,
        } : null,
        item_count: itemsMap.get(o.id) ?? 0,
        delivery:   delivMap.get(o.id) ?? null,
      };
    });

    return apiPaginated(orders, { page, limit, total }, 'Orders retrieved successfully');
  } catch (err) {
    console.error('[GET /api/orders]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
