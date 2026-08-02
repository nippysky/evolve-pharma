/**
 * Product Service — client-side stubs
 *
 * Will call /api/products/* routes implemented in Module 4.
 * Stubs return empty/typed values so the TypeScript graph compiles cleanly.
 */

import type { ProductDTO, CategoryDTO, BulkImportResult } from '@/lib/api/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GetAdminProductsParams {
  page?:       number;
  limit?:      number;
  search?:     string;
  category?:   string;
  status?:     string;
  sort?:       string;
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getAdminProducts(
  _params: GetAdminProductsParams = {},
): Promise<ProductDTO[]> {
  // Module 4 — will call GET /api/products
  return [];
}

export async function getProductCategories(): Promise<CategoryDTO[]> {
  // Module 4 — will call GET /api/products/categories
  return [];
}

export async function bulkImportProducts(_file: File): Promise<BulkImportResult> {
  // Module 4 — will call POST /api/products/bulk-import
  throw new Error('Not implemented — Module 4');
}
