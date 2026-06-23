/**
 * ENVOLVE PHARMACEUTICALS — API Response Types
 *
 * All HTTP responses from the PHP backend follow these shapes.
 * Confirmed against actual API responses (Postman, 2026-06).
 *
 * Key: the backend uses  status: "success" | "error"  (strings),
 * NOT boolean true/false.
 */

// ---------- Envelope shapes -----------------------------------------------

/** Standard success envelope — status is the string "success". */
export interface ApiSuccess<T = unknown> {
  status: 'success';
  message: string;
  data: T;
}

/**
 * Standard error envelope.
 * status is any non-"success" string the backend sends (e.g. "error").
 * errors contains Laravel field-level validation messages.
 */
export interface ApiError {
  status: string; // e.g. "error", "fail", etc.
  message: string;
  errors?: Record<string, string[]>; // Laravel validation errors
}

/** Union — either a success or an error response. */
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

/** Paginated list response. */
export interface PaginatedData<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

// ---------- Auth ------------------------------------------------------------

/** POST auth/customer/register (multipart/form-data) */
export interface RegisterCustomerPayload {
  first_name: string;
  middle_name?: string;
  last_name: string;
  company_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  gender?: string;
  referral_code?: string;
  pcn_certificate: File;
}

/**
 * POST auth/customer/register → 201 Created
 * Actual shape confirmed from Postman (2026-06):
 * {
 *   "status": "success",
 *   "message": "Registration successful. Please check your email to continue verification.",
 *   "data": {
 *     "customer_id": 187,
 *     "email": "...",
 *     "status": "REGISTERED",
 *     "token_sent": true,
 *     "token_expires_at": "2026-06-18 00:14:16"
 *   }
 * }
 */
export interface RegisterCustomerResponse {
  customer_id: number;
  email: string;
  /** Always "REGISTERED" after a successful registration call. */
  status: 'REGISTERED';
  /** true when the OTP email was dispatched. */
  token_sent: boolean;
  /** ISO-ish datetime when the OTP expires. */
  token_expires_at: string;
}

/** POST auth/customer/login */
export interface LoginCustomerPayload {
  email: string;
  password: string;
}

/**
 * Customer Login → 200
 * {
 *   "data": {
 *     "customer": {
 *       "id": "186", "first_name": "Ifeoluwa", "last_name": "Ayomide",
 *       "email": "...", "role": "CUSTOMER",
 *       "status": "APPROVED" | "PENDING_REVIEW" | ...,
 *       "referral_code": "ENV58A5D112"
 *     }
 *   }
 * }
 * Route to portal if status === "APPROVED", else to /sign-up/pending.
 */
export interface LoginCustomerResponse {
  customer: {
    id: string | number;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    /** "APPROVED" | "PENDING_REVIEW" | other statuses */
    status: string;
    referral_code?: string;
    company_name?: string;
    pcn_uploaded?: boolean;
    pcn_verified?: boolean;
  };
}

/** POST auth/customer/verify-otp */
export interface VerifyOtpPayload {
  email: string;
  otp_code: string;
}

/**
 * Verify OTP → 200
 * {
 *   "email": "...",
 *   "token": "cbb2a400ffab252...",  ← REQUIRED for create-password
 *   "message": "OTP verified successfully"
 * }
 */
export interface VerifyOtpResponse {
  email: string;
  /** Short-lived token that must be passed to create-password. */
  token: string;
  message?: string;
}

/**
 * POST auth/customer/create-password
 * Requires the token from the verify-OTP step.
 */
export interface CreatePasswordPayload {
  password: string;
  token: string; // from VerifyOtpResponse.token
}

/**
 * Create Password → 200
 * { "customer_id": "188", "status": "PENDING_REVIEW" }
 */
export interface CreatePasswordResponse {
  customer_id: string | number;
  status: 'PENDING_REVIEW' | string;
}

/** GET auth/me — profile for any authenticated user (customer or staff) */
export interface MeResponse {
  id: string | number;
  uuid?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  phone?: string;
  role: string;          // "CUSTOMER" | "ADMIN" | "STAFF" | "DRIVER"
  status: string;
  // Customer-only fields
  company_name?: string;
  pcn_uploaded?: boolean;
  pcn_verified?: boolean;
  referral_code?: string;
  // Staff-only fields
  department?: string;
  job_title?: string;
  employee_code?: string;
  created_at?: string;
  updated_at?: string;
}

// ---------- Staff auth ------------------------------------------------------

/** POST auth/login-staff — same endpoint for ADMIN, STAFF, DRIVER */
export interface LoginStaffPayload {
  email: string;
  password: string;
}

/**
 * Staff Login → 200
 * { "status":"success", "message":"Login Successful",
 *   "data":{ "id":"151", "email":"admin@gmail.com", "role":"ADMIN", "status":"ACTIVE", "employee_code":null } }
 * role: "ADMIN" | "STAFF" | "DRIVER"
 */
export interface LoginStaffResponse {
  id: string | number;
  email: string;
  role: 'ADMIN' | 'STAFF' | 'DRIVER' | string;
  /** "ACTIVE" | "INACTIVE" | other status strings */
  status: string;
  employee_code?: string | null;
}

/** POST auth/staff/register */
export interface RegisterStaffPayload {
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  phone: string;
  department?: string;
  job_title?: string;
  gender: string;
}

/**
 * Staff Register → 200
 * { "id":458, "employee_code":"EMP-2026-000001", "email":"...",
 *   "status":"UNVERIFIED", "verification_expires_at":"..." }
 */
export interface RegisterStaffResponse {
  id: string | number;
  employee_code: string;
  email: string;
  status: 'UNVERIFIED' | string;
  verification_expires_at?: string;
}

// ---------- Staff lists (admin) ---------------------------------------------

export interface StaffRecord {
  id: string | number;
  uuid?: string;
  employee_code: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  phone: string;
  department?: string;
  job_title?: string;
  gender?: string;
  verification_status: 'UNVERIFIED' | 'VERIFIED' | string;
  email_verified_at?: string | null;
  created_at: string;
}

export interface StaffListResponse {
  total: number;
  records: StaffRecord[];
}

/** POST staff/bulk-upload (form-data) */
export interface BulkUploadStaffSuccess {
  total_record_inserted: number;
  existing_emails: string[];
  total_existing_record: number;
}

// ---------- Customer lists (admin) ------------------------------------------

export interface CustomerAdminRecord {
  id: string | number;
  uuid?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  company_name?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  gender?: string;
  /**
   * Lifecycle status string from the backend:
   * "REGISTERED" | "PCN_CERT_UPLOADED" | "OTP_CONFIRMED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED"
   */
  status: string;
  verification_status?: string;
  reviewed_by?: string | number | null;
  reviewed_at?: string | null;
  review_note?: string | null;   // returned on approved/rejected records
  email_verified_at?: string | null;
  created_at: string;
}

export interface CustomerAdminListResponse {
  total: number;
  records: CustomerAdminRecord[];
}

/** POST customers/{id}/approval — body the backend actually expects */
export interface ReviewCustomerPayload {
  /** "APPROVE" or "REJECTED" — exact strings the backend accepts */
  decision: 'APPROVE' | 'REJECTED';
  review_notes: string;          // required for both approve and reject
}

export interface ReviewCustomerResponse {
  customer_id: string | number;
  email: string;
  status: 'APPROVED' | 'REJECTED' | string;
  reviewed_at: string;
  reviewed_by: string | number;
  review_notes?: string;
}

/** POST customers/bulk-upload — returns 200 even on partial failures */
export interface BulkUploadFailedRecord {
  row: number;
  email: string;
  errors: string[];
}

export interface BulkUploadCustomerResponse {
  total_records: number;
  successful: number;
  failed: number;
  failed_records: BulkUploadFailedRecord[];
}

// ---------- Pagination meta ------------------------------------------------

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

// ---------- Login history (admin) ------------------------------------------

/** One entry from GET admin/login-history */
export interface LoginHistoryRecord {
  id: string;
  user_id: string;
  user_type: string;           // "ADMIN" | "CUSTOMER" | "STAFF"
  ip_address: string;
  device_name: string;
  browser: string;
  operating_system: string;
  country: string;
  city: string;
  event: string;               // "LOGIN_SUCCESS" | "LOGIN_FAILED" etc.
  created_at: string;
  user_name: string | null;
  email: string | null;
}

export interface LoginHistoryResponse {
  pagination: PaginationMeta;
  records: LoginHistoryRecord[];
}

// ---------- Audit logs (admin) ---------------------------------------------

/** One entry from GET admin/logs */
export interface AuditLogRecord {
  id: string;
  user_id: string;
  user_type: string;
  action: string;              // "LOGIN" | "CREATE_STAFF" | "APPROVE_ACCOUNT" etc.
  entity_type: string;         // "Admin" | "Customer" | "Staff"
  entity_id: string;
  description: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  user_name: string | null;
  email: string | null;
}

export interface AuditLogsResponse {
  pagination: PaginationMeta;
  records: AuditLogRecord[];
}

// ---------- Helpers ---------------------------------------------------------

/**
 * Type-guard: narrows ApiResponse<T> to ApiSuccess<T>.
 * Uses the string "success" because the backend status field is a string,
 * NOT a boolean.
 */
export function isApiSuccess<T>(res: ApiResponse<T>): res is ApiSuccess<T> {
  return res.status === 'success';
}
