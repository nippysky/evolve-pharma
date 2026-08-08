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
import type { DeliveryStatus } from '@db/enums';

const VALID_STATUSES: DeliveryStatus[] = [
  'AWAITING_DISPATCH','ASSIGNED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','FAILED','RETURNED',
];

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF', 'DRIVER'].includes(session.role)) return apiForbidden();

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = parsePagination(sp, { limit: 20 });

    const statusRaw     = sp.get('status');
    const driverIdParam = sp.get('driver_id') ? parseInt(sp.get('driver_id')!, 10) : undefined;
    const searchRaw     = sp.get('search')?.trim() ?? '';

    const status = (statusRaw && VALID_STATUSES.includes(statusRaw as DeliveryStatus))
      ? statusRaw as DeliveryStatus
      : undefined;

    // Resolve driver filter
    // Drivers see only their own deliveries; Admin/Staff can filter by driver_id
    let driverFilter: number | undefined = driverIdParam;
    if (session.role === 'DRIVER') {
      const driver = await db.driver.findFirst({
        where:  { user_id: session.userId },
        select: { id: true },
      });
      if (!driver) return apiPaginated([], { page, limit, total: 0 }, 'No driver record found');
      driverFilter = driver.id;
    }

    // If search provided, resolve matching order IDs
    // We search tracking_code directly + order_number via a sequential order lookup.
    let searchOrderIds: number[] | undefined;
    if (searchRaw) {
      const matchedOrders = await db.order.findMany({
        where:  { order_number: { contains: searchRaw } },
        select: { id: true },
      });
      searchOrderIds = matchedOrders.map(o => o.id);
    }

    const where = {
      ...(status       ? { status }                   : {}),
      ...(driverFilter ? { driver_id: driverFilter }  : {}),
      ...(searchRaw
        ? {
            OR: [
              { tracking_code: { contains: searchRaw } },
              ...(searchOrderIds && searchOrderIds.length > 0
                ? [{ order_id: { in: searchOrderIds } }]
                : []),
            ],
          }
        : {}),
    };

    // Delivery rows — select only (no includes)
    const rawDeliveries = await db.delivery.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take:    limit,
      select: {
        id: true, uuid: true, tracking_code: true, status: true,
        driver_id: true, order_id: true,
        dispatched_at: true, delivered_at: true, notes: true,
        created_at: true, updated_at: true,
      },
    });

    // Count
    const total = await db.delivery.count({ where });

    if (rawDeliveries.length === 0) {
      return apiPaginated([], { page, limit, total }, 'Deliveries retrieved successfully');
    }

    const orderIds  = rawDeliveries.map(d => d.order_id);
    const driverIds = [...new Set(
      rawDeliveries.map(d => d.driver_id).filter((id): id is number => id !== null)
    )];

    // Order rows (batch)
    const orders = await db.order.findMany({
      where:  { id: { in: orderIds } },
      select: {
        id: true, order_number: true, status: true, payment_status: true,
        delivery_address: true, delivery_city: true, delivery_state: true,
        total: true, customer_id: true,
      },
    });

    const custIds = [...new Set(orders.map(o => o.customer_id))];

    // Customer rows (batch)
    const customers = await db.customer.findMany({
      where:  { id: { in: custIds } },
      select: { id: true, company_name: true, user_id: true },
    });

    // Driver rows (batch)
    const driverRecords = driverIds.length > 0
      ? await db.driver.findMany({
          where:  { id: { in: driverIds } },
          select: { id: true, user_id: true },
        })
      : [];

    // User rows — one batch covering customer users + driver users
    const custUserIds   = customers.map(c => c.user_id);
    const driverUserIds = driverRecords.map(d => d.user_id);
    const allUserIds    = [...new Set([...custUserIds, ...driverUserIds])];

    const users = await db.user.findMany({
      where:  { id: { in: allUserIds } },
      select: { id: true, first_name: true, last_name: true, email: true, phone: true },
    });

    // ── Merge in JavaScript ───────────────────────────────────────────────────
    const orderMap     = new Map(orders.map(o => [o.id, o]));
    const custMap      = new Map(customers.map(c => [c.id, c]));
    const userMap      = new Map(users.map(u => [u.id, u]));
    const driverRecMap = new Map(driverRecords.map(d => [d.id, d]));

    const deliveries = rawDeliveries.map(d => {
      const order      = orderMap.get(d.order_id);
      const customer   = order    ? custMap.get(order.customer_id)     : undefined;
      const custUser   = customer ? userMap.get(customer.user_id)      : undefined;
      const driverRec  = d.driver_id ? driverRecMap.get(d.driver_id)   : undefined;
      const driverUser = driverRec   ? userMap.get(driverRec.user_id)  : undefined;

      return {
        id:            d.id,
        uuid:          d.uuid,
        tracking_code: d.tracking_code,
        status:        d.status,
        dispatched_at: d.dispatched_at,
        delivered_at:  d.delivered_at,
        notes:         d.notes,
        created_at:    d.created_at,
        updated_at:    d.updated_at,
        order: order ? {
          id:               order.id,
          order_number:     order.order_number,
          order_status:     order.status,
          payment_status:   order.payment_status,
          delivery_address: order.delivery_address,
          delivery_city:    order.delivery_city,
          delivery_state:   order.delivery_state,
          total:            Number(order.total),
          customer: custUser ? {
            company_name: customer?.company_name ?? null,
            first_name:   custUser.first_name,
            last_name:    custUser.last_name,
            email:        custUser.email,
            phone:        custUser.phone,
          } : null,
        } : null,
        driver: driverUser ? {
          id:         driverRec!.id,
          first_name: driverUser.first_name,
          last_name:  driverUser.last_name,
          phone:      driverUser.phone,
        } : null,
      };
    });

    return apiPaginated(deliveries, { page, limit, total }, 'Deliveries retrieved successfully');
  } catch (err) {
    console.error('[GET /api/deliveries]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
