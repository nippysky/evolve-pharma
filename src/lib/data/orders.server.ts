import { unstable_cache } from 'next/cache';
import { db }            from '@/lib/db';
import type { Order, OrderItem } from '@/types';

function mapOrderItem(i: any): OrderItem {
  return {
    id:           i.id,
    uuid:         i.id.toString(),
    order_id:     i.order_id,
    product_id:   i.product_id,
    product_name: i.product?.brand_name ?? 'Unknown product',
    product_sku:  i.product?.sku ?? '—',
    product_image: i.product?.images?.[0]?.url,
    quantity:      i.quantity,
    price:         Number(i.unit_price),
    subtotal:      Number(i.subtotal),
    created_at:    i.order?.created_at?.toISOString() ?? new Date().toISOString(),
  };
}

function mapOrder(o: any): Order {
  return {
    id:             o.id,
    uuid:           o.uuid,
    order_number:   o.order_number,
    customer_id:    o.customer_id,
    customer_company: o.customer?.company_name ?? undefined,
    status:         o.status.toLowerCase() as Order['status'],
    payment_status: o.payment_status.toLowerCase() as Order['payment_status'],
    total_amount:   Number(o.total),
    notes:          o.notes ?? o.delivery_address ?? null,
    created_at:     o.created_at.toISOString(),
    updated_at:     o.updated_at?.toISOString(),
    items:          (o.items ?? []).map((i: any) => mapOrderItem({ ...i, order: o })),
  };
}

const ORDER_INCLUDE = {
  customer: { select: { company_name: true } },
  items: {
    include: {
      product: {
        select: {
          brand_name: true,
          sku:        true,
          images: { select: { url: true }, orderBy: { is_primary: 'desc' as const }, take: 1 },
        },
      },
    },
  },
} as const;

async function _fetchPortalOrders(userId: number): Promise<Order[]> {
  try {
    const rows = await db.order.findMany({
      where:   { customer: { user_id: userId } },
      include: ORDER_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
    return (rows as any[]).map(mapOrder);
  } catch (err) {
    console.error('[orders.server] fetchPortalOrders error:', err);
    return [];
  }
}

async function _fetchAdminOrders(limit: number, status?: string): Promise<Order[]> {
  try {
    const rows = await db.order.findMany({
      where:   status ? { status: status.toUpperCase() as any } : undefined,
      include: ORDER_INCLUDE,
      orderBy: { created_at: 'desc' },
      take:    limit,
    });
    return (rows as any[]).map(mapOrder);
  } catch (err) {
    console.error('[orders.server] fetchAdminOrders error:', err);
    return [];
  }
}

async function _fetchOrderById(orderId: number, userId?: number): Promise<Order | null> {
  try {
    const o = await db.order.findFirst({
      where: {
        id: orderId,
        ...(userId ? { customer: { user_id: userId } } : {}),
      },
      include: ORDER_INCLUDE,
    });
    if (!o) return null;
    return mapOrder(o as any);
  } catch (err) {
    console.error('[orders.server] fetchOrderById error:', err);
    return null;
  }
}

/**
 * Orders for the logged-in customer portal user.
 * Cached per-user for 30 seconds — short TTL so status updates feel live.
 */
export const getPortalOrders = (userId: number) =>
  unstable_cache(
    () => _fetchPortalOrders(userId),
    [`orders-user-${userId}`],
    { tags: ['orders', `orders-user-${userId}`], revalidate: 30 },
  )();

/**
 * Admin order list (all orders or filtered by status).
 * Cached 60 seconds.
 */
export const getAdminOrders = (limit = 50, status?: string) =>
  unstable_cache(
    () => _fetchAdminOrders(limit, status),
    [`admin-orders-${limit}-${status ?? 'all'}`],
    { tags: ['orders', 'dashboard'], revalidate: 60 },
  )();

/**
 * Single order by ID — optionally scoped to a userId for portal use.
 */
export const getOrderById = (orderId: number, userId?: number) =>
  unstable_cache(
    () => _fetchOrderById(orderId, userId),
    [`order-${orderId}`],
    { tags: ['orders', `order-${orderId}`], revalidate: 30 },
  )();
//
// A single findFirst with nested includes causes Prisma to fan out into
// We break it into 4 sequential awaits — one connection at a time.

export async function getOrderDetail(orderId: number, userId?: number) {
  try {
    // 1. Order row (with customer_id for subsequent queries)
    const o = await db.order.findFirst({
      where: {
        id: orderId,
        ...(userId ? { customer: { user_id: userId } } : {}),
      },
      select: {
        id: true, order_number: true, status: true, payment_status: true,
        payment_reference: true, subtotal: true, delivery_fee: true, total: true,
        delivery_address: true, delivery_city: true, delivery_state: true,
        notes: true, created_at: true, customer_id: true,
      },
    });
    if (!o) return null;

    // 2. Customer + user profile
    const cust = await db.customer.findUnique({
      where:  { id: o.customer_id },
      select: {
        company_name: true,
        user: { select: { first_name: true, last_name: true, email: true, phone: true } },
      },
    });

    // 3. Order items + product snapshots (including pharma fields)
    const rawItems = await db.orderItem.findMany({
      where:   { order_id: o.id },
      orderBy: { id: 'asc' },
      select: {
        id: true, quantity: true, unit_price: true, subtotal: true,
        product: {
          select: {
            sku: true, brand_name: true, generic_name: true, pack_size: true,
            product_strength: true,
            manufacturer: { select: { name: true } },
            images: { where: { is_primary: true }, take: 1, select: { url: true } },
            inventoryBatches: {
              orderBy: { expiry_date: 'asc' },
              take:    1,
              select:  { batch_number: true, expiry_date: true },
            },
          },
        },
      },
    });

    // 4. Delivery record (if any)
    const delivery = await db.delivery.findFirst({
      where:  { order_id: o.id },
      select: { status: true, tracking_code: true, dispatched_at: true, delivered_at: true },
    });

    // Parse notes JSON (stores contact_phone, po_number, delivery_notes, vat)
    let parsedNotes: { contact_phone?: string; po_number?: string; delivery_notes?: string; vat?: number } = {};
    try { parsedNotes = o.notes ? JSON.parse(o.notes as string) : {}; } catch { /* noop */ }

    // Who placed this order, if it wasn't the customer. Shown to the customer
    // so an order they didn't create themselves doesn't look like fraud.
    let placedByName: string | null = null;
    try {
      const pbRows = await db.$queryRaw<Array<{ placed_by_user_id: number | null }>>`
        SELECT placed_by_user_id FROM orders WHERE id = ${o.id}
      `;
      const pbId = pbRows[0]?.placed_by_user_id;
      if (pbId) {
        const u = await db.user.findUnique({
          where:  { id: pbId },
          select: { first_name: true, last_name: true },
        });
        if (u) placedByName = `${u.first_name} ${u.last_name}`;
      }
    } catch { /* column may not exist yet — degrade quietly */ }

    return {
      id:                o.id,
      order_number:      o.order_number,
      placed_by_name:    placedByName,
      status:            o.status.toLowerCase() as Order['status'],
      payment_status:    o.payment_status.toLowerCase() as Order['payment_status'],
      payment_reference: (o.payment_reference as string | null) ?? null,
      subtotal:          Number(o.subtotal),
      delivery_fee:      Number(o.delivery_fee),
      vat:               parsedNotes.vat ?? 0,
      total:             Number(o.total),
      delivery_address:  o.delivery_address ?? '',
      delivery_city:     o.delivery_city    ?? '',
      delivery_state:    o.delivery_state   ?? '',
      contact_phone:     parsedNotes.contact_phone  ?? '',
      po_number:         parsedNotes.po_number       ?? null,
      delivery_notes:    parsedNotes.delivery_notes  ?? null,
      created_at:        o.created_at.toISOString(),
      customer: {
        company_name: cust?.company_name                   ?? '',
        first_name:   cust?.user?.first_name               ?? '',
        last_name:    cust?.user?.last_name                ?? '',
        email:        cust?.user?.email                    ?? '',
        phone:        (cust?.user?.phone as string | null) ?? '',
      },
      items: rawItems.map((i: any) => ({
        id:               i.id,
        quantity:         i.quantity,
        unit_price:       Number(i.unit_price),
        subtotal:         Number(i.subtotal),
        brand_name:       i.product.brand_name,
        generic_name:     i.product.generic_name,
        sku:              i.product.sku,
        pack_size:        i.product.pack_size        ?? null,
        product_strength: i.product.product_strength ?? null,
        manufacturer:     i.product.manufacturer?.name ?? null,
        image:            i.product.images[0]?.url      ?? null,
        batch_number:     i.product.inventoryBatches[0]?.batch_number ?? null,
        expiry_date:      i.product.inventoryBatches[0]?.expiry_date  ?? null,
      })),
      delivery: delivery ? {
        status:        delivery.status,
        tracking_code: delivery.tracking_code,
        dispatched_at: delivery.dispatched_at?.toISOString() ?? null,
        delivered_at:  delivery.delivered_at?.toISOString()  ?? null,
      } : null,
    };
  } catch (err) {
    console.error('[orders.server] getOrderDetail error:', err);
    return null;
  }
}
