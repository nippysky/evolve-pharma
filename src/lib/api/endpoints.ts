/**
 * ENVOLVE PHARMACEUTICALS — API Endpoint Registry
 *
 * Single source of truth for every backend URL.
 * Swap BASE_URL or restructure paths here without touching service files.
 */

/**
 * All endpoints — customer AND staff/admin — share the same base URL.
 * https://envolvepharm.com.ng/erp/api/v1/public/
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'https://envolvepharm.com.ng/erp/api/v1/public/';

// ---------- Auth -----------------------------------------------------------

export const AUTH = {
  /** POST — customer self-registration (multipart/form-data) */
  REGISTER_CUSTOMER: 'auth/customer/register',

  /** POST — customer login */
  LOGIN_CUSTOMER: 'auth/customer/login',

  /** POST — verify email OTP sent after registration */
  VERIFY_OTP: 'auth/customer/verify-otp',

  /** POST — set password using token from registration response */
  CREATE_PASSWORD: 'auth/customer/create-password',

  /** POST — upload PCN certificate post-login gate */
  UPLOAD_PCN: 'auth/customer/upload-pcn',

  /** GET — get the currently authenticated user */
  ME: 'auth/user',

  /** POST — refresh access token (called automatically by the Axios interceptor) */
  REFRESH: 'auth/refresh',

  /** POST — log out */
  LOGOUT: 'auth/logout',

  /** POST — staff/admin login (admin, staff, driver all use this endpoint; role from response) */
  LOGIN_STAFF: 'auth/staff/login',

  /** POST — staff register (admin-initiated) */
  REGISTER_STAFF: 'auth/staff/register',

  /** POST — create password for staff (from invite token) */
  CREATE_STAFF_PASSWORD: 'auth/staff/create-password',
} as const;

// ---------- Customers (admin management) -----------------------------------

export const CUSTOMERS = {
  /** GET — paginated list */
  LIST: 'admin/customers',
  /** GET — single customer */
  DETAIL: (id: number | string) => `admin/customers/${id}`,
  /** POST — onboard a customer (admin/staff) */
  ONBOARD: 'admin/customers',
  /** PATCH — update customer */
  UPDATE: (id: number | string) => `admin/customers/${id}`,
  /** POST — approve/reject PCN */
  REVIEW: (id: number | string) => `admin/customers/${id}/review`,
  /** POST — bulk import */
  IMPORT: 'admin/customers/import',
} as const;

/**
 * Customer lists by registration stage + the review / bulk-upload actions.
 * Confirmed from Postman (2026-06).
 */
export const CUSTOMERS_ADMIN = {
  /** GET — REGISTERED status (email not yet verified) */
  REGISTERED: 'customer/registered',
  /** GET — PCN_CERT_UPLOADED + UNVERIFIED */
  UNVERIFIED: 'customer/unverified',
  /** GET — OTP_CONFIRMED / EMAIL_VERIFIED_PASSWORD_CREATED */
  VERIFIED: 'customer/verified',
  /** GET — PENDING_REVIEW (awaiting admin approval) */
  PENDING_REVIEW: 'customer/pending-review',
  /** POST — approve or reject a customer: { action, review_notes? } */
  REVIEW: (id: number | string) => `customers/${id}/approval`,
  /** POST — bulk upload via xlsx file (form-data key = "customer") */
  BULK_UPLOAD: 'customers/bulk-upload',
} as const;

/**
 * Staff management endpoints (admin-only).
 * Confirmed from Postman (2026-06).
 */
export const STAFF_ADMIN = {
  /** GET — staff whose email is UNVERIFIED */
  UNVERIFIED: 'staff/unverified',
  /** GET — staff whose email is VERIFIED */
  VERIFIED: 'staff/verified',
  /** POST — register (invite) a new staff member */
  REGISTER: 'auth/staff/register',
  /** POST — bulk upload staff via xlsx (form-data key = "staff") */
  BULK_UPLOAD: 'staff/bulk-upload',
} as const;

// ---------- Products --------------------------------------------------------

export const PRODUCTS = {
  /** GET — public catalog (customer-facing) */
  CATALOG: 'products',
  /** GET — single product by SKU */
  DETAIL: (sku: string) => `products/${sku}`,
  /** GET — admin product list */
  ADMIN_LIST: 'admin/products',
  /** POST — create product */
  CREATE: 'admin/products',
  /** PATCH — update product */
  UPDATE: (id: number | string) => `admin/products/${id}`,
  /** DELETE — archive product */
  ARCHIVE: (id: number | string) => `admin/products/${id}`,
  /** POST — bulk import */
  IMPORT: 'admin/products/import',
} as const;

// ---------- Inventory -------------------------------------------------------

export const INVENTORY = {
  /** GET — inventory list */
  LIST: 'admin/inventory',
  /** POST — receive stock / add batch */
  RECEIVE: 'admin/inventory/receive',
  /** POST — bulk import batches */
  IMPORT: 'admin/inventory/import',
} as const;

// ---------- Orders ----------------------------------------------------------

export const ORDERS = {
  /** GET — customer's own orders */
  MY_ORDERS: 'orders',
  /** GET — single order */
  DETAIL: (id: number | string) => `orders/${id}`,
  /** POST — place order */
  PLACE: 'orders',
  /** GET — admin order list */
  ADMIN_LIST: 'admin/orders',
  /** PATCH — update order status */
  UPDATE_STATUS: (id: number | string) => `admin/orders/${id}/status`,
} as const;

// ---------- Deliveries ------------------------------------------------------

export const DELIVERIES = {
  /** GET — admin delivery list */
  ADMIN_LIST: 'admin/deliveries',
  /** PATCH — assign driver */
  ASSIGN_DRIVER: (id: number | string) => `admin/deliveries/${id}/assign`,
  /** POST — driver acknowledges assignment */
  ACKNOWLEDGE: (id: number | string) => `driver/deliveries/${id}/acknowledge`,
  /** PATCH — driver updates delivery status */
  UPDATE_STATUS: (id: number | string) => `driver/deliveries/${id}/status`,
  /** GET — driver's own deliveries */
  DRIVER_LIST: 'driver/deliveries',
} as const;

// ---------- Staff -----------------------------------------------------------

export const STAFF = {
  /** GET — staff list (admin) */
  LIST: 'admin/staff',
  /** POST — invite/create staff */
  INVITE: 'admin/staff',
  /** PATCH — update staff role/permissions */
  UPDATE: (id: number | string) => `admin/staff/${id}`,
  /** POST — bulk import */
  IMPORT: 'admin/staff/import',
} as const;

// ---------- Drivers ---------------------------------------------------------

export const DRIVERS = {
  /** GET — driver list (admin) */
  LIST: 'admin/drivers',
  /** POST — onboard driver */
  ONBOARD: 'admin/drivers',
  /** PATCH — update driver */
  UPDATE: (id: number | string) => `admin/drivers/${id}`,
} as const;

// ---------- Reports ---------------------------------------------------------

export const REPORTS = {
  /** GET — sales summary */
  SALES: 'admin/reports/sales',
  /** GET — staff performance */
  STAFF: 'admin/reports/staff',
} as const;
