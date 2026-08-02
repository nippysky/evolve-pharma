/**
 * GET /api/deliveries — paginated delivery list (Admin/Staff/Driver)
 *
 * Drivers only see their own deliveries.
 * Admin/Staff see all.
 *
 * Query params:
 *   page, limit
 *   status     — AWAITING_DISPATCH | ASSIGNED | IN_TRANSIT | OUT_FOR_DELIVERY | DELIVERED | FAILED | RETURNED
 *   driver_id  — filter by driver (Admin/Staff only)
 */

import { NextRequest } from 'next/server';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiPaginated,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
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

    const statusRaw = sp.get('status');
    const driverIdParam = sp.get('driver_id') ? parseInt(sp.get('driver_id')!, 10) : undefined;

    const status = (statusRaw && VALID_STATUSES.includes(statusRaw as DeliveryStatus))
      ? statusRaw as DeliveryStatus
      : undefined;

    // Drivers see only their deliveries
    let driverFilter: number | undefined = driverIdParam;
    if (session.role === 'DRIVER') {
      const driver = await db.driver.findFirst({ where: { user_id: session.userId } });
      if (!driver) return apiPaginated([], { page, limit, total: 0 });
      driverFilter = driver.id;
    }

    const where = {
      ...(status       ? { status }                   : {}),
      ...(driverFilter ? { driver_id: driverFilter }  : {}),
    };

    const [records, total] = await Promise.all([
      db.delivery.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take:    limit,
        include: {
          order: {
            select: {
              id:              true,
              order_number:    true,
              status:          true,
              delivery_address:true,
              delivery_city:   true,
              delivery_state:  true,
              total:           true,
              customer: {
                include: {
                  user: { select: { first_name: true, last_name: true, email: true, phone: true } },
                },
              },
            },
          },
          driver: {
            include: {
              user: { select: { first_name: true, last_name: true, phone: true } },
            },
          },
        },
      }),
      db.delivery.count({ where }),
    ]);

    // Cast to any[] — Prisma includes are typed at the query level; map accesses are safe
    const deliveries = (records as any[]).map((d) => ({
      id:            d.id,
      uuid:          d.uuid,
      tracking_code: d.tracking_code,
      status:        d.status,
      dispatched_at: d.dispatched_at,
      delivered_at:  d.delivered_at,
      notes:         d.notes,
      created_at:    d.created_at,
      updated_at:    d.updated_at,
      order: {
        id:              d.order.id,
        order_number:    d.order.order_number,
        order_status:    d.order.status,
        delivery_address:d.order.delivery_address,
        delivery_city:   d.order.delivery_city,
        delivery_state:  d.order.delivery_state,
        total:           Number(d.order.total),
        customer: {
          company_name: d.order.customer.company_name,
          first_name:   d.order.customer.user.first_name,
          last_name:    d.order.customer.user.last_name,
          email:        d.order.customer.user.email,
          phone:        d.order.customer.user.phone,
        },
      },
      driver: d.driver ? {
        id:         d.driver.id,
        first_name: d.driver.user.first_name,
        last_name:  d.driver.user.last_name,
        phone:      d.driver.user.phone,
      } : null,
    }));

    return apiPaginated(deliveries, { page, limit, total }, 'Deliveries retrieved successfully');
  } catch (err) {
    console.error('[GET /api/deliveries]', err);
    return apiInternalError();
  }
}
