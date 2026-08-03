/**
 * ENVOLVE PHARMACEUTICALS — Admin Products & Inventory Hooks
 *
 * TanStack Query hooks for the admin products list, categories, and inventory.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdminProducts,
  getProductCategories,
  createCategory,
  deleteCategory,
  uploadProductImages,
  deleteProductImage,
  setProductImagePrimary,
  getInventoryStats,
  receiveStock,
  bulkReceiveStock,
  type GetAdminProductsParams,
  type ReceiveStockInput,
} from '@/lib/api/services/product.service';
import type { ProductDTO } from '@/lib/api/types';

// ---------- Query key factory -----------------------------------------------

export const PRODUCT_KEYS = {
  all:            ['products']                                   as const,
  list:           (params: GetAdminProductsParams) =>
                    ['products', 'list', params]                 as const,
  categories:     ['product', 'categories']                      as const,
  inventoryStats: ['inventory-stats']                            as const,
};

// ---------- Admin product list ----------------------------------------------

/** Paginated admin product list. */
export function useAdminProducts(params: GetAdminProductsParams = {}) {
  return useQuery({
    queryKey:        PRODUCT_KEYS.list(params),
    queryFn:         () => getAdminProducts(params),
    staleTime:       2 * 60 * 1000,
    placeholderData: (prev: ProductDTO[] | undefined) => prev,
  });
}

// ---------- Product categories ----------------------------------------------

/** All categories, cached 30 min. */
export function useProductCategories() {
  return useQuery({
    queryKey: PRODUCT_KEYS.categories,
    queryFn:  getProductCategories,
    staleTime: 30 * 60 * 1000,
  });
}

/** Create a new category. Invalidates category list on success. */
export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createCategory(name),
    onSuccess:  () => qc.invalidateQueries({ queryKey: PRODUCT_KEYS.categories }),
  });
}

/** Delete a category by ID. Invalidates category + product lists on success. */
export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: PRODUCT_KEYS.categories });
      qc.invalidateQueries({ queryKey: PRODUCT_KEYS.all });
    },
  });
}

// ---------- Product images --------------------------------------------------

/** Upload one or more images for a product. */
export function useUploadProductImages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sku, files, primaryIdx }: { sku: string; files: File[]; primaryIdx?: number }) =>
      uploadProductImages(sku, files, primaryIdx),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_KEYS.all }),
  });
}

/** Delete a product image by its ID. */
export function useDeleteProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sku, imageId }: { sku: string; imageId: number }) =>
      deleteProductImage(sku, imageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_KEYS.all }),
  });
}

/** Set a specific image as primary for a product. */
export function useSetProductImagePrimary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sku, imageId }: { sku: string; imageId: number }) =>
      setProductImagePrimary(sku, imageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_KEYS.all }),
  });
}

// ---------- Inventory stats -------------------------------------------------

/** Summary counts for the Inventory dashboard. */
export function useInventoryStats() {
  return useQuery({
    queryKey: PRODUCT_KEYS.inventoryStats,
    queryFn:  getInventoryStats,
    staleTime: 60 * 1000, // 1 min
  });
}

// ---------- Receive stock ---------------------------------------------------

/** Manually receive a stock batch. Invalidates inventory + stats on success. */
export function useReceiveStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReceiveStockInput) => receiveStock(input),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: PRODUCT_KEYS.inventoryStats });
    },
  });
}

/** Bulk receive stock from a spreadsheet. Invalidates inventory + stats. */
export function useBulkReceiveStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => bulkReceiveStock(file),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: PRODUCT_KEYS.inventoryStats });
    },
  });
}
