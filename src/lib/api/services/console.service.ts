/**
 * ENVOLVE PHARMACEUTICALS — Console (admin) API Service
 *
 * Customer lifecycle management: listing customers by registration stage,
 * approving / rejecting pending customers, and bulk-uploading via xlsx.
 *
 * Auth is cookie-based (withCredentials: true) — cookies sent automatically.
 */

import { adminApiClient } from '@/lib/api/client';
import { API_BASE_URL, CUSTOMERS_ADMIN } from '@/lib/api/endpoints';
import type {
  CustomerAdminListResponse,
  ReviewCustomerPayload,
  ReviewCustomerResponse,
  BulkUploadCustomerResponse,
  ApiResponse,
  ApiSuccess,
  ApiError,
} from '@/lib/api/types';

// ---------- Helpers --------------------------------------------------------

function unwrap<T>(res: ApiResponse<T>): T {
  if (res.status !== 'success') {
    const err = new Error(res.message ?? 'Request failed');
    (err as Error & { fieldErrors?: Record<string, string[]> }).fieldErrors =
      (res as ApiError).errors;
    throw err;
  }
  return (res as ApiSuccess<T>).data;
}

// ---------- Customer list by stage -----------------------------------------

export type CustomerStage =
  | 'pending'
  | 'registered'
  | 'unverified'
  | 'verified'
  | 'approved'
  | 'rejected';

const STAGE_ENDPOINT: Record<CustomerStage, string> = {
  pending:    CUSTOMERS_ADMIN.PENDING_REVIEW,
  registered: CUSTOMERS_ADMIN.REGISTERED,
  unverified: CUSTOMERS_ADMIN.UNVERIFIED,
  verified:   CUSTOMERS_ADMIN.VERIFIED,
  approved:   CUSTOMERS_ADMIN.APPROVED,
  rejected:   CUSTOMERS_ADMIN.REJECTED,
};

/**
 * Fetch customers filtered by their registration stage.
 *   pending    → GET customer/pending-review
 *   registered → GET customer/registered
 *   unverified → GET customer/unverified
 *   verified   → GET customer/verified
 *   approved   → GET customer/approved
 *   rejected   → GET customer/rejected
 */
export async function listCustomersByStage(
  stage: CustomerStage,
): Promise<CustomerAdminListResponse> {
  const { data } = await adminApiClient.get<ApiResponse<CustomerAdminListResponse>>(
    STAGE_ENDPOINT[stage],
  );
  return unwrap(data);
}

// ---------- Review (approve / reject) --------------------------------------

/**
 * POST customers/{id}/approval
 * Body: { decision: "APPROVE" | "REJECTED", review_notes: string }
 */
export async function reviewCustomer(
  customerId: number | string,
  decision: 'APPROVE' | 'REJECTED',
  review_notes: string,
): Promise<ReviewCustomerResponse> {
  const payload: ReviewCustomerPayload = { decision, review_notes };
  const { data } = await adminApiClient.post<ApiResponse<ReviewCustomerResponse>>(
    CUSTOMERS_ADMIN.REVIEW(customerId),
    payload,
  );
  return unwrap(data);
}

// ---------- Bulk upload customers ------------------------------------------

/**
 * POST customers/bulk-upload (multipart/form-data, key = "customer")
 * Returns status:"success" even on partial failures — check `failed` and `failed_records`.
 *
 * WHY native fetch instead of Axios:
 * The Axios instance has a default Content-Type: application/json.
 * Even when passing FormData, that default leaks through in some Axios versions
 * and reaches the server without the multipart boundary → 400 Bad Request.
 * Using native fetch with credentials:"include" (same as withCredentials:true)
 * lets the browser set Content-Type: multipart/form-data; boundary=XXX correctly.
 */
export async function bulkUploadCustomers(
  file: File,
): Promise<BulkUploadCustomerResponse> {
  const fd = new FormData();
  fd.set('customer', file); // backend expects key = "customer"

  const res = await fetch(`${API_BASE_URL}${CUSTOMERS_ADMIN.BULK_UPLOAD}`, {
    method:      'POST',
    credentials: 'include', // send JWT cookies (same as Axios withCredentials:true)
    body:        fd,
    // No Content-Type header — browser sets multipart/form-data; boundary=XXX automatically
  });

  const json = (await res.json()) as ApiResponse<BulkUploadCustomerResponse>;

  if (!res.ok && json.status !== 'success') {
    const msg = (json as ApiError).message ?? `Upload failed (${res.status})`;
    throw new Error(msg);
  }

  return unwrap(json);
}
