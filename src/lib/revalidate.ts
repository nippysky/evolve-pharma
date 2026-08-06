import { revalidateTag } from 'next/cache';

/**
 * Central cache-revalidation helpers.
 *
 * Every mutation API route must call the appropriate helper(s) here
 * so that portal/catalog/marketing pages reflect changes on the next
 * page load without a hard refresh.
 *
 * Tags mirror those used in unstable_cache across src/lib/data/*.server.ts.
 * Next.js 16 requires revalidateTag(tag, profile) — we use 'default' throughout.
 */

const P = 'default' as const;

/** Bust every product-related cache (list, individual SKU, featured, catalog). */
export function revalidateProducts(sku?: string) {
  revalidateTag('products',          P);
  revalidateTag('products-list',     P);
  revalidateTag('catalog',           P);
  revalidateTag('products-featured', P);
  revalidateTag('dashboard',         P);
  if (sku) revalidateTag(`product-sku-${sku}`, P);
}

/** Bust inventory caches (stock counts displayed on catalog/product pages). */
export function revalidateInventory() {
  revalidateTag('inventory', P);
  revalidateTag('products',  P);
  revalidateTag('catalog',   P);
  revalidateTag('dashboard', P);
}

/** Bust order caches — pass orderId and/or userId for fine-grained invalidation. */
export function revalidateOrders(opts?: { orderId?: number; userId?: number }) {
  revalidateTag('orders',    P);
  revalidateTag('dashboard', P);
  if (opts?.orderId) revalidateTag(`order-${opts.orderId}`,       P);
  if (opts?.userId)  revalidateTag(`orders-user-${opts.userId}`,  P);
}

/** Bust customer list + dashboard aggregate caches. */
export function revalidateCustomers() {
  revalidateTag('customers', P);
  revalidateTag('dashboard', P);
}

/** Bust delivery-related caches and the linked order cache. */
export function revalidateDeliveries(orderId?: number) {
  revalidateTag('deliveries', P);
  revalidateTag('orders',     P);
  revalidateTag('dashboard',  P);
  if (orderId) revalidateTag(`order-${orderId}`, P);
}

/** Bust admin settings cache. */
export function revalidateSettings() {
  revalidateTag('settings', P);
}

/** Bust staff list cache. */
export function revalidateStaff() {
  revalidateTag('staff', P);
}

/** Bust user profile cache. */
export function revalidateProfile(userId?: number) {
  revalidateTag('profile', P);
  if (userId) revalidateTag(`profile-user-${userId}`, P);
}
