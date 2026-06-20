/**
 * ENVOLVE PHARMACEUTICALS — Console (admin) API Service
 *
 * Customer lifecycle management: listing customers by registration stage,
 * approving / rejecting pending customers, and bulk-uploading via xlsx.
 *
 * Auth is cookie-based (withCredentials: true) — cookies sent automatically.
 */

import { adminApiClient } from '@/lib/api/client';
import { CUSTOMERS_ADMIN } from '@/lib/api/endpoints';
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

type CustomerStage = 'registered' | 'unverified' | 'verified' | 'pending';

const STAGE_ENDPOINT: Record<CustomerStage, string> = {
  registered: CUSTOMERS_ADMIN.REGISTERED,
  unverified: CUSTOMERS_ADMIN.UNVERIFIED,
  verified:   CUSTOMERS_ADMIN.VERIFIED,
  pending:    CUSTOMERS_ADMIN.PENDING_REVIEW,
};

/**
 * Fetch customers filtered by their registration stage.
 *  - registered : REGISTERED  (email not yet verified)
 *  - unverified : PCN_CERT_UPLOADED + UNVERIFIED
 *  - verified   : OTP_CONFIRMED / EMAIL_VERIFIED_PASSWORD_CREATED
 *  - pending    : PENDING_REVIEW (awaiting admin approval)
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
 * { action: "approve" | "reject", review_notes?: string }
 * Returns the updated customer status.
 */
export async function reviewCustomer(
  customerId: number | string,
  action: 'approve' | 'reject',
  review_notes?: string,
): Promise<ReviewCustomerResponse> {
  const payload: ReviewCustomerPayload = { action };
  if (review_notes) payload.review_notes = review_notes;

  const { data } = await adminApiClient.post<ApiResponse<ReviewCustomerResponse>>(
    CUSTOMERS_ADMIN.REVIEW(customerId),
    payload,
  );
  return unwrap(data);
}

// ---------- Bulk upload customers ------------------------------------------

/**
 * POST customers/bulk-upload (multipart/form-data, key = "customer")
 * Returns 200 even on partial failures — check `failed` and `failed_records`.
 */
export async function bulkUploadCustomers(
  file: File,
): Promise<BulkUploadCustomerResponse> {
  const fd = new FormData();
  fd.set('customer', file);
  const { data } = await adminApiClient.post<ApiResponse<BulkUploadCustomerResponse>>(
    CUSTOMERS_ADMIN.BULK_UPLOAD,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return unwrap(data);
}
