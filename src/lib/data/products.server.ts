/**
 * Server-side product fetch helpers.
 *
 * All queries are wrapped in Next.js `unstable_cache` so:
 *   • First request: hits Prisma → MySQL → returns data (+ fills cache)
 *   • Subsequent requests within TTL: returns in < 1 ms from the in-memory
 *     data cache — zero DB round-trips, zero network latency.
 *
 * Cache tags let you surgically revalidate:
 *   revalidateTag('products')           → clears all product caches
 *   revalidateTag('products-list')      → clears the list view only
 *   revalidateTag('product-sku-EP-001') → clears one product's detail page
 *
 * TTLs:
 *   product list  → 5 min  (products change occasionally, not per-second)
 *   product detail → 10 min (even more stable)
 *   homepage hero → 10 min
 *
 * Import only in Server Components / Route Handlers — NEVER in 'use client' code.
 */

import { unstable_cache } from 'next/cache';
import { db }            from '@/lib/db';
import type { ProductDTO } from '@/lib/api/types';

// ─── Shape mapper ─────────────────────────────────────────────────────────────

function mapProduct(p: any): ProductDTO {
  return {
    ...p,
    selling_price:   String(p.selling_price),
    last_cost_price: p.last_cost_price ? String(p.last_cost_price) : null,
    total_stock:     (p.inventoryBatches ?? []).reduce(
      (s: number, b: any) => s + (b.quantity ?? 0), 0,
    ),
  };
}

// ─── DB fetch (raw, uncached — used internally by the cached wrappers) ────────

async function _fetchActiveProducts(limit: number): Promise<ProductDTO[]> {
  try {
    const rows = await db.product.findMany({
      where:   { status: 'ACTIVE', deleted_at: null },
      take:    limit,
      orderBy: { created_at: 'desc' },
      include: {
        category:         { select: { name: true } },
        manufacturer:     { select: { name: true } },
        images:           { orderBy: { is_primary: 'desc' }, take: 1 },
        inventoryBatches: { select: { quantity: true } },
      },
    });
    return (rows as any[]).map(mapProduct);
  } catch (err) {
    console.error('[products.server] fetchActiveProducts error:', err);
    return [];
  }
}

async function _fetchProductBySku(sku: string): Promise<ProductDTO | null> {
  try {
    const p = await db.product.findFirst({
      where:   { sku, status: 'ACTIVE', deleted_at: null },
      include: {
        category:         { select: { name: true } },
        manufacturer:     { select: { name: true } },
        images:           { orderBy: { is_primary: 'desc' } },
        inventoryBatches: { select: { quantity: true } },
      },
    });
    if (!p) return null;
    return mapProduct(p as any);
  } catch (err) {
    console.error('[products.server] fetchProductBySku error:', err);
    return null;
  }
}

async function _fetchFeaturedProducts(limit: number): Promise<ProductDTO[]> {
  try {
    const rows = await db.product.findMany({
      where:   { status: 'ACTIVE', deleted_at: null },
      take:    limit,
      orderBy: { created_at: 'desc' },
      include: {
        category:     { select: { name: true } },
        manufacturer: { select: { name: true } },
        images:       { orderBy: { is_primary: 'desc' }, take: 1 },
      },
    });
    return (rows as any[]).map((p) => ({
      ...mapProduct(p),
      total_stock: 0,  // not needed on homepage hero
    }));
  } catch (err) {
    console.error('[products.server] fetchFeaturedProducts error:', err);
    return [];
  }
}

// ─── Cached public API ────────────────────────────────────────────────────────

/**
 * Paginated list of active products.
 * Cached for 5 minutes, tagged 'products' and 'products-list'.
 *
 * Usage: const products = await getActiveProducts(48);
 */
export const getActiveProducts = (limit = 48) =>
  unstable_cache(
    () => _fetchActiveProducts(limit),
    [`products-list-${limit}`],
    {
      tags:    ['products', 'products-list'],
      revalidate: 300, // 5 min
    },
  )();

/**
 * Single product by SKU.
 * Cached for 10 minutes, tagged 'products' and 'product-sku-{sku}'.
 *
 * Returns null if not found / inactive / deleted.
 */
export const getProductBySkuFromDB = (sku: string) =>
  unstable_cache(
    () => _fetchProductBySku(sku),
    [`product-${sku}`],
    {
      tags:    ['products', `product-sku-${sku}`],
      revalidate: 600, // 10 min
    },
  )();

/**
 * Small set of featured products for the marketing homepage hero.
 * Cached for 10 minutes — homepage is the hottest path, keep it fast.
 */
export const getFeaturedProducts = (limit = 8) =>
  unstable_cache(
    () => _fetchFeaturedProducts(limit),
    [`products-featured-${limit}`],
    {
      tags:    ['products', 'products-featured'],
      revalidate: 600, // 10 min
    },
  )();
