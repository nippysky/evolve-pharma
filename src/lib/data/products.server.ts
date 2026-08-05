import { unstable_cache } from 'next/cache';
import { db }            from '@/lib/db';
import type { ProductDTO } from '@/lib/api/types';

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

async function _fetchActiveProducts(limit: number): Promise<ProductDTO[]> {
  // Do NOT catch errors here — let them propagate so unstable_cache never
  // stores an empty result from a transient DB failure.
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

/**
 * Paginated list of active products.
 * Cached for 5 minutes, tagged 'products' and 'products-list'.
 *
 * Usage: const products = await getActiveProducts(48);
 */
export const getActiveProducts = (limit = 48) =>
  unstable_cache(
    () => _fetchActiveProducts(limit),
    [`products-list-v2-${limit}`],   // v2 busts any stale cached empty results
    {
      tags:    ['products', 'products-list', 'catalog'],
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
