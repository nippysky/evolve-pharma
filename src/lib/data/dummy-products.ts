/**
 * @deprecated — All product data now comes from the real API via Prisma 7.
 *
 * These stubs are kept ONLY to prevent TypeScript errors in pages that
 * haven't been migrated to the new API routes yet. Once each page is
 * updated to call /api/products, remove the import and delete this file.
 */

import type { ProductDTO } from '@/lib/api/types';

/** Empty array — products come from /api/products in production. */
export const DUMMY_PRODUCTS: ProductDTO[] = [];

/** Always returns undefined — use /api/products/[sku] instead. */
export function getProductBySku(_sku: string): ProductDTO | undefined {
  return undefined;
}
