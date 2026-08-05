import type {
  ProductDTO, CategoryDTO, ProductImageDTO, BulkImportResult, InventoryBatchDTO,
} from '@/lib/api/types';

export interface GetAdminProductsParams {
  page?:     number;
  limit?:    number;
  search?:   string;
  category?: string;
  status?:   string;
  sort?:     string;
}

export interface ReceiveStockInput {
  product_id:   number;
  batch_number: string;
  quantity:     number;
  cost_price:   number;
  expiry_date?: string;
  notes?:       string;
}

export interface InventoryStats {
  total_skus:      number;
  low_stock_count: number;
  expiring_count:  number;
  total_stock:     number;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res  = await fetch(path, { credentials: 'include', ...init });
  const json = await res.json();
  if (!res.ok) {
    const err: Error & { status?: number; fieldErrors?: Record<string, string[]> } =
      new Error(json?.message ?? 'Request failed. Please try again.');
    err.status      = res.status;
    err.fieldErrors = json?.errors;
    throw err;
  }
  return json?.data as T;
}

export async function getAdminProducts(
  params: GetAdminProductsParams = {},
): Promise<ProductDTO[]> {
  const qs = new URLSearchParams();
  if (params.page)     qs.set('page',     String(params.page));
  if (params.limit)    qs.set('limit',    String(params.limit));
  if (params.search)   qs.set('search',   params.search);
  if (params.category) qs.set('category', params.category);
  if (params.status)   qs.set('status',   params.status);
  if (params.sort)     qs.set('sort',     params.sort);

  const data = await apiFetch<{ records: ProductDTO[]; pagination: unknown }>(
    `/api/products${qs.toString() ? `?${qs}` : ''}`,
  );
  return data.records ?? [];
}

export async function getProductCategories(): Promise<CategoryDTO[]> {
  const data = await apiFetch<{ categories: CategoryDTO[] }>('/api/products/categories');
  return data.categories ?? [];
}

export async function createCategory(name: string): Promise<CategoryDTO> {
  const data = await apiFetch<{ category: CategoryDTO }>('/api/products/categories', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name }),
  });
  return data.category;
}

export async function deleteCategory(id: number): Promise<void> {
  await apiFetch(`/api/products/categories/${id}`, { method: 'DELETE' });
}

export async function uploadProductImages(
  sku:   string,
  files: File[],
  primaryIdx?: number,
): Promise<{ images: ProductImageDTO[]; uploaded: number }> {
  const fd = new FormData();
  files.forEach((f, i) => fd.append(`file${i}`, f));
  if (primaryIdx !== undefined) fd.append('set_primary', String(primaryIdx));

  const res  = await fetch(`/api/products/${encodeURIComponent(sku)}/images`, {
    method:      'POST',
    credentials: 'include',
    body:        fd,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message ?? 'Image upload failed');
  }
  return json.data as { images: ProductImageDTO[]; uploaded: number };
}

export async function deleteProductImage(sku: string, imageId: number): Promise<void> {
  await apiFetch(`/api/products/${encodeURIComponent(sku)}/images/${imageId}`, {
    method: 'DELETE',
  });
}

export async function setProductImagePrimary(sku: string, imageId: number): Promise<void> {
  await apiFetch(`/api/products/${encodeURIComponent(sku)}/images/${imageId}`, {
    method: 'PATCH',
  });
}

export async function bulkImportProducts(file: File): Promise<BulkImportResult> {
  const fd = new FormData();
  fd.append('file', file);

  const res  = await fetch('/api/products/bulk-import', {
    method:      'POST',
    credentials: 'include',
    body:        fd,
  });
  const json = await res.json();

  if (!res.ok) {
    const err: Error & { status?: number; uploadResult?: BulkImportResult } =
      new Error(json?.message ?? 'Bulk import failed. Please check your file and try again.');
    err.status       = res.status;
    if (json?.data) err.uploadResult = json.data as BulkImportResult;
    throw err;
  }

  return (json?.data ?? { total: 0, inserted: 0, updated: 0, failed: 0 }) as BulkImportResult;
}

export async function getInventoryStats(): Promise<InventoryStats> {
  const data = await apiFetch<InventoryStats>('/api/inventory/stats');
  return data;
}

export async function receiveStock(input: ReceiveStockInput): Promise<InventoryBatchDTO> {
  const data = await apiFetch<{ batch: InventoryBatchDTO }>('/api/inventory/receive', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  });
  return data.batch;
}

export async function bulkReceiveStock(file: File): Promise<{
  total_records:  number;
  successful:     number;
  failed:         number;
  failed_records: Array<{ row: number; sku: string; errors: string[] }>;
}> {
  const fd = new FormData();
  fd.append('file', file);

  const res  = await fetch('/api/inventory/bulk-receive', {
    method:      'POST',
    credentials: 'include',
    body:        fd,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? 'Bulk receive failed');
  return json.data;
}
