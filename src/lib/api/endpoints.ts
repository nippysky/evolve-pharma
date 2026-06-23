// Single source of truth for every backend URL.
//
// In development the browser routes through the Next.js proxy at /api/proxy/
// so all requests are same-origin — this eliminates cross-origin cookie
// restrictions that block auth/me and other authenticated endpoints.
//
// In production set NEXT_PUBLIC_API_BASE_URL to the direct backend URL if you
// want to bypass the proxy (e.g. when frontend and backend share a domain).
// Leave it unset to keep the proxy active in production as well.

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/proxy/';

// ---------- Auth -----------------------------------------------------------

export const AUTH = {
  REGISTER_CUSTOMER:    'auth/customer/register',
  LOGIN_CUSTOMER:       'auth/customer/login',
  VERIFY_OTP:           'auth/customer/verify-otp',
  CREATE_PASSWORD:      'auth/customer/create-password',
  UPLOAD_PCN:           'auth/customer/upload-pcn',
  ME:                   'auth/me',
  REFRESH:              'auth/refresh',
  LOGOUT:               'auth/logout',
  LOGIN_STAFF:          'auth/staff/login',
  REGISTER_STAFF:       'auth/staff/register',
  CREATE_STAFF_PASSWORD:'auth/staff/create-password',
} as const;

// ---------- Customers (admin) -----------------------------------------------

export const CUSTOMERS_ADMIN = {
  REGISTERED:    'customer/registered',
  UNVERIFIED:    'customer/unverified',
  VERIFIED:      'customer/verified',
  PENDING_REVIEW:'customer/pending-review',
  APPROVED:      'customer/approved',
  REJECTED:      'customer/rejected',
  REVIEW:        (id: number | string) => `customers/${id}/approval`,
  BULK_UPLOAD:   'customers/bulk-upload',
} as const;

export const CUSTOMERS = {
  LIST:   'admin/customers',
  DETAIL: (id: number | string) => `admin/customers/${id}`,
  ONBOARD:'admin/customers',
  UPDATE: (id: number | string) => `admin/customers/${id}`,
  REVIEW: (id: number | string) => `admin/customers/${id}/review`,
  IMPORT: 'admin/customers/import',
} as const;

// ---------- Staff (admin) ---------------------------------------------------

export const STAFF_ADMIN = {
  UNVERIFIED:  'staff/unverified',
  VERIFIED:    'staff/verified',
  REGISTER:    'auth/staff/register',
  BULK_UPLOAD: 'staff/bulk-upload',
} as const;

export const STAFF = {
  LIST:   'admin/staff',
  INVITE: 'admin/staff',
  UPDATE: (id: number | string) => `admin/staff/${id}`,
  IMPORT: 'admin/staff/import',
} as const;

// ---------- Products --------------------------------------------------------

export const PRODUCTS = {
  CATALOG:    'products',
  DETAIL:     (sku: string) => `products/${sku}`,
  ADMIN_LIST: 'admin/products',
  CREATE:     'admin/products',
  UPDATE:     (id: number | string) => `admin/products/${id}`,
  ARCHIVE:    (id: number | string) => `admin/products/${id}`,
  IMPORT:     'admin/products/import',
} as const;

// ---------- Inventory -------------------------------------------------------

export const INVENTORY = {
  LIST:    'admin/inventory',
  RECEIVE: 'admin/inventory/receive',
  IMPORT:  'admin/inventory/import',
} as const;

// ---------- Orders ----------------------------------------------------------

export const ORDERS = {
  MY_ORDERS:     'orders',
  DETAIL:        (id: number | string) => `orders/${id}`,
  PLACE:         'orders',
  ADMIN_LIST:    'admin/orders',
  UPDATE_STATUS: (id: number | string) => `admin/orders/${id}/status`,
} as const;

// ---------- Deliveries ------------------------------------------------------

export const DELIVERIES = {
  ADMIN_LIST:    'admin/deliveries',
  ASSIGN_DRIVER: (id: number | string) => `admin/deliveries/${id}/assign`,
  ACKNOWLEDGE:   (id: number | string) => `driver/deliveries/${id}/acknowledge`,
  UPDATE_STATUS: (id: number | string) => `driver/deliveries/${id}/status`,
  DRIVER_LIST:   'driver/deliveries',
} as const;

// ---------- Drivers ---------------------------------------------------------

export const DRIVERS = {
  LIST:   'admin/drivers',
  ONBOARD:'admin/drivers',
  UPDATE: (id: number | string) => `admin/drivers/${id}`,
} as const;

// ---------- Reports ---------------------------------------------------------

export const REPORTS = {
  SALES: 'admin/reports/sales',
  STAFF: 'admin/reports/staff',
} as const;

// ---------- Admin logs ------------------------------------------------------

export const ADMIN_LOGS = {
  LOGIN_HISTORY: 'admin/login-history',
  AUDIT_LOGS:    'admin/logs',
} as const;
