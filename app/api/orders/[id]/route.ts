import { NextRequest } from 'next/server';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();

    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) return apiNotFound('Order');

    // 1. Order row only
    const o = await db.order.findUnique({
      where:  { id: orderId },
      select: {
        id: true, uuid: true, order_number: true,
        status: true, payment_status: true, payment_reference: true,
        delivery_address: true, delivery_city: true, delivery_state: true,
        subtotal: true, discount: true, delivery_fee: true, total: true,
        notes: true, created_at: true, updated_at: true, customer_id: true,
      },
    });
    if (!o) return apiNotFound('Order');

    // 2. Customer + user
    const cust = await db.customer.findUnique({
      where:  { id: o.customer_id },
      select: {
        id: true, company_name: true,
        user: { select: { id: true, first_name: true, last_name: true, email: true, phone: true } },
      },
    });
    if (!cust) return apiNotFound('Order');

    // Auth check: customers can only view their own orders
    if (session.role === 'CUSTOMER' && cust.user.id !== session.userId) {
      return apiForbidden();
    }

    // 3. Order items + product snapshots (including pharma fields)
    const rawItems = await db.orderItem.findMany({
      where:   { order_id: o.id },
      orderBy: { id: 'asc' },
      select: {
        id: true, quantity: true, unit_price: true, subtotal: true,
        product: {
          select: {
            sku: true, brand_name: true, generic_name: true,
            product_strength: true, pack_size: true,
            shelf_location: true,
            manufacturer: { select: { name: true } },
            images: { where: { is_primary: true }, take: 1, select: { url: true } },
            inventoryBatches: {
              orderBy: { expiry_date: 'asc' },
              take:    1,
              select:  { batch_number: true, expiry_date: true, quantity: true },
            },
          },
        },
      },
    });

    // 4. Delivery (if any)
    const delivery = await db.delivery.findFirst({
      where:  { order_id: o.id },
      select: {
        id: true, uuid: true, tracking_code: true, status: true,
        dispatched_at: true, delivered_at: true, notes: true,
        driver_id: true,
      },
    });

    // 5. Driver user (if delivery has a driver)
    let driver: { id: number; first_name: string; last_name: string; phone: string | null } | null = null;
    if (delivery?.driver_id) {
      const driverRecord = await db.driver.findUnique({
        where:  { id: delivery.driver_id },
        select: {
          id: true,
          user: { select: { first_name: true, last_name: true, phone: true } },
        },
      });
      if (driverRecord) {
        driver = {
          id:         driverRecord.id,
          first_name: driverRecord.user.first_name,
          last_name:  driverRecord.user.last_name,
          phone:      driverRecord.user.phone,
        };
      }
    }

    // On-behalf attribution. Raw SQL because placed_by_user_id comes from a
    // manual migration and isn't in the generated Prisma types.
    let placedBy: { id: number; name: string; role: string } | null = null;
    try {
      const pbRows = await db.$queryRaw<Array<{ placed_by_user_id: number | null }>>`
        SELECT placed_by_user_id FROM orders WHERE id = ${orderId}
      `;
      const pbId = pbRows[0]?.placed_by_user_id;
      if (pbId) {
        const u = await db.user.findUnique({
          where:  { id: pbId },
          select: { id: true, first_name: true, last_name: true, role: true },
        });
        if (u) {
          placedBy = { id: u.id, name: `${u.first_name} ${u.last_name}`, role: u.role };
        }
      }
    } catch { /* column may not exist yet — degrade quietly */ }

    return apiSuccess({
      order: {
        id:                o.id,
        uuid:              o.uuid,
        order_number:      o.order_number,
        placed_by:         placedBy,
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
        customer: {
          id:           cust.id,
          company_name: cust.company_name,
          first_name:   cust.user.first_name,
          last_name:    cust.user.last_name,
          email:        cust.user.email,
          phone:        cust.user.phone,
        },
        items: rawItems.map(item => ({
          id:          item.id,
          quantity:    item.quantity,
          unit_price:  Number(item.unit_price),
          subtotal:    Number(item.subtotal),
          product: {
            sku:              item.product.sku,
            brand_name:       item.product.brand_name,
            generic_name:     item.product.generic_name,
            product_strength: item.product.product_strength,
            pack_size:        item.product.pack_size,
            shelf_location:   item.product.shelf_location,
            manufacturer:     item.product.manufacturer?.name ?? null,
            primary_image:    (item.product.images as { url: string }[])[0]?.url ?? null,
            batch_number:     item.product.inventoryBatches[0]?.batch_number ?? null,
            expiry_date:      item.product.inventoryBatches[0]?.expiry_date ?? null,
          },
        })),
        delivery: delivery ? {
          id:            delivery.id,
          uuid:          delivery.uuid,
          tracking_code: delivery.tracking_code,
          status:        delivery.status,
          dispatched_at: delivery.dispatched_at,
          delivered_at:  delivery.delivered_at,
          notes:         delivery.notes,
          driver,
        } : null,
      },
    });
  } catch (err) {
    console.error('[GET /api/orders/[id]]', err);
    return apiInternalError();
  }
}
