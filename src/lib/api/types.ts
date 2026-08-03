/**
 * EVOLVE PHARMACEUTICALS — Shared API / Entity Types
 *
 * These types mirror the Prisma schema and are shared between:
 *   - Next.js API route handlers (server-side)
 *   - React components that display data (client-side)
 *   - Mobile app (same response envelope, same field names)
 *
 * All dates are ISO 8601 strings when serialised through JSON.
 * All decimals (prices) are serialised as strings from Prisma's Decimal type.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole    = 'ADMIN' | 'STAFF' | 'DRIVER' | 'CUSTOMER';
export type UserStatus  = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type CustomerStatus =
  | 'REGISTERED'
  | 'OTP_CONFIRMED'
  | 'PCN_CERT_UPLOADED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export type StaffVerificationStatus = 'UNVERIFIED' | 'VERIFIED';
export type DriverStatus = 'AVAILABLE' | 'ON_DELIVERY' | 'OFF_DUTY' | 'SUSPENDED';

export type ProductStatus = 'ACTIVE' | 'DRAFT' | 'DISCONTINUED';

export type OrderStatus   = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'PARTIAL' | 'REFUNDED' | 'FAILED';

export type DeliveryStatus =
  | 'AWAITING_DISPATCH'
  | 'ASSIGNED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED';

export type StockMovementType = 'IN' | 'OUT' | 'ADJUSTMENT';
export type OtpType           = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';
export type LoginEvent        = 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'TOKEN_REFRESHED';

// ─── API Envelope ─────────────────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  status:  'success';
  message: string;
  data:    T;
}

export interface ApiError {
  status:  'error';
  message: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

export interface Pagination {
  current_page: number;
  per_page:     number;
  total:        number;
  total_pages:  number;
}

export interface PaginatedResponse<T> {
  records:    T[];
  pagination: Pagination;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserDTO {
  id:                 number;
  uuid:               string;
  first_name:         string;
  middle_name?:       string | null;
  last_name:          string;
  email:              string;
  phone?:             string | null;
  role:               UserRole;
  status:             UserStatus;
  gender?:            string | null;
  avatar_url?:        string | null;
  email_verified_at?: string | null;
  created_at:         string;
  updated_at:         string;
}

export interface SessionUser {
  id:          number;
  uuid:        string;
  first_name:  string;
  last_name:   string;
  email:       string;
  role:        UserRole;
  status:      UserStatus;
  avatar_url?: string | null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  access_token:  string;
  refresh_token: string;
  expires_in:    number; // seconds until access token expiry
}

export interface AuthResponse {
  user:   SessionUser;
  tokens: AuthTokens; // also set as httpOnly cookies for web clients
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface CustomerDTO {
  id:                    number;
  uuid:                  string;
  user_id:               number;
  user:                  UserDTO;
  company_name?:         string | null;
  address?:              string | null;
  city?:                 string | null;
  state?:                string | null;
  pcn_certificate_url?:  string | null;
  pcn_verified:          boolean;
  status:                CustomerStatus;
  referral_code?:        string | null;
  referred_by?:          string | null;
  review_note?:          string | null;
  reviewed_by_id?:       number | null;
  reviewed_at?:          string | null;
  created_at:            string;
  updated_at:            string;
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface StaffDTO {
  id:                  number;
  user_id:             number;
  user:                UserDTO;
  employee_code:       string;
  department?:         string | null;
  job_title?:          string | null;
  verification_status: StaffVerificationStatus;
  created_at:          string;
  updated_at:          string;
}

// ─── Driver ───────────────────────────────────────────────────────────────────

export interface DriverDTO {
  id:               number;
  user_id:          number;
  user:             UserDTO;
  employee_code?:   string | null;
  license_number?:  string | null;
  vehicle_type?:    string | null;
  vehicle_plate?:   string | null;
  driver_status:    DriverStatus;
  created_at:       string;
  updated_at:       string;
}

// ─── Category ─────────────────────────────────────────────────────────────────

export interface CategoryDTO {
  id:         number;
  name:       string;
  created_at: string;
}

// ─── Manufacturer ─────────────────────────────────────────────────────────────

export interface ManufacturerDTO {
  id:         number;
  name:       string;
  created_at: string;
}

// ─── Product ──────────────────────────────────────────────────────────────────

export interface ProductImageDTO {
  id:                   number;
  product_id:           number;
  cloudinary_public_id: string;
  url:                  string;
  is_primary:           boolean;
  created_at:           string;
}

export interface ProductDTO {
  id:                       number;
  uuid:                     string;
  sku:                      string;
  category_id?:             number | null;
  category?:                CategoryDTO | null;
  manufacturer_id?:         number | null;
  manufacturer?:            ManufacturerDTO | null;
  brand_name:               string;
  generic_name:             string;
  product_strength?:        string | null;
  pack_size?:               string | null;
  quantity_per_carton?:     number | null;
  allow_unit_sale:          boolean;
  minimum_order:            number;
  selling_price:            string; // Decimal → string
  last_cost_price?:         string | null;
  final_price?:             string | null;
  discount_percentage?:     string | null;
  minimum_stock_level:      number;
  reorder_quantity:         number;
  status:                   ProductStatus;
  /** Sum of all inventory batch quantities. Field name from GET /api/products list. */
  total_stock:              number;
  /** Primary image URL — present on list responses, absent on single-product fetch. */
  primary_image?:           string | null;
  images:                   ProductImageDTO[];
  created_at:               string;
  updated_at:               string;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryBatchDTO {
  id:           number;
  product_id:   number;
  product?:     Pick<ProductDTO, 'id' | 'sku' | 'brand_name' | 'generic_name'>;
  batch_number: string;
  quantity:     number;
  cost_price:   string;
  expiry_date?: string | null;
  received_at:  string;
  created_at:   string;
}

export interface StockMovementDTO {
  id:              number;
  product_id:      number;
  product?:        Pick<ProductDTO, 'id' | 'sku' | 'brand_name'>;
  batch_id?:       number | null;
  type:            StockMovementType;
  quantity:        number;
  reference_type?: string | null;
  reference_id?:   number | null;
  notes?:          string | null;
  created_at:      string;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface OrderItemDTO {
  id:         number;
  order_id:   number;
  product_id: number;
  product?:   Pick<ProductDTO, 'id' | 'sku' | 'brand_name' | 'generic_name' | 'images'>;
  quantity:   number;
  unit_price: string;
  subtotal:   string;
}

export interface OrderDTO {
  id:                 number;
  uuid:               string;
  order_number:       string;
  customer_id:        number;
  customer?:          Pick<CustomerDTO, 'id' | 'uuid' | 'company_name' | 'user'>;
  status:             OrderStatus;
  payment_status:     PaymentStatus;
  payment_reference?: string | null;
  delivery_address?:  string | null;
  delivery_city?:     string | null;
  delivery_state?:    string | null;
  subtotal:           string;
  discount:           string;
  delivery_fee:       string;
  total:              string;
  notes?:             string | null;
  items?:             OrderItemDTO[];
  delivery?:          DeliveryDTO | null;
  created_at:         string;
  updated_at:         string;
}

// ─── Deliveries ───────────────────────────────────────────────────────────────

export interface DeliveryDTO {
  id:             number;
  uuid:           string;
  tracking_code:  string;
  order_id:       number;
  order?:         Pick<OrderDTO, 'id' | 'order_number' | 'customer'>;
  driver_id?:     number | null;
  driver?:        Pick<DriverDTO, 'id' | 'user' | 'vehicle_type' | 'vehicle_plate'> | null;
  status:         DeliveryStatus;
  dispatched_at?: string | null;
  delivered_at?:  string | null;
  notes?:         string | null;
  created_at:     string;
  updated_at:     string;
}

// ─── Audit / Security ─────────────────────────────────────────────────────────

export interface LoginHistoryDTO {
  id:                number;
  user_id?:          number | null;
  user_type:         string;
  user_name?:        string | null;
  email?:            string | null;
  ip_address?:       string | null;
  device_name?:      string | null;
  browser?:          string | null;
  operating_system?: string | null;
  country?:          string | null;
  city?:             string | null;
  event:             LoginEvent;
  created_at:        string;
}

export interface AuditLogDTO {
  id:           number;
  user_id?:     number | null;
  user_type:    string;
  user_name?:   string | null;
  email?:       string | null;
  action:       string;
  entity_type?: string | null;
  entity_id?:   string | null;
  description?: string | null;
  ip_address?:  string | null;
  user_agent?:  string | null;
  created_at:   string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface NotificationDTO {
  id:         number;
  user_id:    number;
  title:      string;
  body:       string;
  type:       string;
  is_read:    boolean;
  created_at: string;
}

// ─── Bulk Import ──────────────────────────────────────────────────────────────

export interface BulkImportResult {
  total:   number;
  success: number;
  failed:  number;
  errors:  Array<{ row: number; sku?: string; reason: string }>;
}

// ─── Backward-compat aliases ──────────────────────────────────────────────────

/** @deprecated Use AuditLogDTO */
export type AuditLogRecord = AuditLogDTO;

/** @deprecated Use LoginHistoryDTO */
export type LoginHistoryRecord = LoginHistoryDTO;

/** @deprecated Use Pagination */
export type PaginationMeta = Pagination;

/** @deprecated Use ProductDTO */
export type AdminProductRecord = ProductDTO;

/** @deprecated Use BulkImportResult */
export type BulkImportProductResponse = BulkImportResult;

// ─── Staff / customer hook types (used by useStaff.ts — will be rewritten in Module 6) ──

export interface LoginStaffPayload {
  email:    string;
  password: string;
}

export interface RegisterStaffPayload {
  first_name:  string;
  middle_name?: string;
  last_name:   string;
  email:       string;
  password?:   string;
  role?:       'STAFF' | 'DRIVER';
  phone?:      string;
  department?: string;
  job_title?:  string;
  gender?:     string;
}

/**
 * Flat shape returned by the staff listing endpoints.
 * Maps onto StaffDTO + the nested user fields for easy table rendering.
 */
export interface StaffRecord {
  id:                  number;
  user_id:             number;
  employee_code:       string;
  department?:         string | null;
  job_title?:          string | null;
  verification_status: StaffVerificationStatus;
  // Flattened from user relation
  first_name:          string;
  last_name:           string;
  email:               string;
  phone?:              string | null;
  email_verified_at?:  string | null;
  created_at:          string;
}

/**
 * Flat shape returned by the staff listing endpoint when role=DRIVER.
 * Extends the base user fields with driver-specific columns.
 */
export interface DriverRecord {
  id:            number;
  uuid?:         string | null;
  first_name:    string;
  last_name:     string;
  email:         string;
  phone?:        string | null;
  role:          string;
  status:        string;
  avatar_url?:   string | null;
  employee_code: string | null;
  driver_status: string | null;
  vehicle_plate: string | null;
  vehicle_type:  string | null;
  created_at:    string;
}

/**
 * Flat shape returned by the customer listing endpoints.
 * Maps onto CustomerDTO + nested user fields for easy table rendering.
 */
export interface CustomerAdminRecord {
  id:                   number;
  uuid?:                string | null;
  user_id:              number;
  company_name?:        string | null;
  address?:             string | null;
  city?:                string | null;
  state?:               string | null;
  status:               CustomerStatus;
  referral_code?:       string | null;
  review_note?:         string | null;
  reviewed_by?:         string | null; // "First Last" of the reviewing admin
  reviewed_at?:         string | null;
  pcn_verified:         boolean;
  pcn_certificate_url?: string | null; // Cloudinary URL — may be PDF or image
  // Flattened from user relation
  first_name:           string;
  last_name:            string;
  email:                string;
  phone?:               string | null;
  created_at:           string;
}

// ─── Customer auth payloads (used by useCustomerAuth.ts — will be wired in Module 6) ──

export interface RegisterCustomerPayload {
  first_name:       string;
  middle_name?:     string;
  last_name:        string;
  email:            string;
  phone?:           string;
  company_name?:    string;
  referral_code?:   string;
  address?:         string;
  city?:            string;
  state?:           string;
  gender?:          string;
  pcn_certificate?: File;
}

export interface LoginCustomerPayload {
  email:    string;
  password: string;
}

export interface VerifyOtpPayload {
  email:    string;
  otp_code: string;
}

export interface CreatePasswordPayload {
  password: string;
  token:    string;
}

// ─── Staff bulk upload result (returned by POST /api/staff/bulk-upload) ───────

export interface StaffBulkUploadResult {
  total_record_inserted: number;
  /** Display alias — may equal total_record_inserted in some API versions */
  successful?:           number;
  failed?:               number;
  total_records?:        number;
  existing_emails?:      string[];
  failed_records:        Array<{
    row:    number;
    email:  string;
    errors: string[];
  }>;
}
