/**
 * ENVOLVE PHARMACEUTICALS — Admin Products Hooks
 *
 * TanStack Query hooks for the admin products list and categories.
 */

import { useQuery } from '@tanstack/react-query';
import {
  getAdminProducts,
  getProductCategories,
  type GetAdminProductsParams,
} from '@/lib/api/services/product.service';

// ---------- Query key factory -----------------------------------------------

export const PRODUCT_KEYS = {
  all:        ['products'] as const,
  list:       (params: GetAdminProductsParams) =>
                ['products', 'list', params] as const,
  categories: ['product', 'categories'] as const,
};

// ---------- Admin product list ---------------------------------------------

/**
 * Paginated admin product list.
 * Uses page + limit params — response is a flat array.
 */
export function useAdminProducts(params: GetAdminProductsParams = {}) {
  return useQuery({
    queryKey: PRODUCT_KEYS.list(params),
    queryFn:  () => getAdminProducts(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    placeholderData: (prev: import('@/lib/api/types').ProductDTO[] | undefined) => prev,
  });
}

// ---------- Product categories ---------------------------------------------

/**
 * Fetches all product categories from the database.
 * Cached for 30 minutes — categories rarely change.
 */
export function useProductCategories() {
  return useQuery({
    queryKey: PRODUCT_KEYS.categories,
    queryFn:  getProductCategories,
    staleTime: 30 * 60 * 1000,
  });
}
