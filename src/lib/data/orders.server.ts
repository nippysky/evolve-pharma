/**
 * Order data fetchers — server-side only.
 *
 * Portal orders (per-user) are cached with a user-specific key and a short
 * 30-second TTL — orders change frequently so we don't cache long.
 * Admin order lists are cached 60 seconds.
 *
 * Call revalidateTag('orders') after any write that creates/updates orders.
 * Call revalidateTag(`orders-user-${userId}`) to clear one user's order cache.
 */

import { unstable_cache } from 'next/cache';
import { db }            from '@/lib/db';
import type { Order, OrderItem } from '@/types';

// ─── Mapper ───────────────────────────────────────────────────────────────────

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

// ─── Raw fetchers ─────────────────────────────────────────────────────────────

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

// ─── Cached public API ────────────────────────────────────────────────────────

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
