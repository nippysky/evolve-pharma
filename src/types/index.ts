
export type UUID = string;
export type ISODate = string;
export type Money = number; // stored in NGN major units (₦)

/** New uppercase roles matching the Prisma schema and JWT payload. */
export type Role = 'ADMIN' | 'STAFF' | 'DRIVER' | 'CUSTOMER';

/** @deprecated Use Role */
export type LegacyRole = 'admin' | 'sales_agent' | 'driver' | 'customer';

export type Status = 'active' | 'inactive' | 'pending' | 'suspended';
//
// Admin can grant/revoke individual permissions per staff member.
// Presets (sales_rep, product_manager, operations_lead, senior_staff) are
// convenience bundles — they map to these exact permission keys.

export type StaffPermissionKey =
  | 'onboard_customers'   // create & approve customer accounts
  | 'manage_products'     // add / edit / archive products
  | 'manage_inventory'    // receive stock, adjust batches
  | 'assign_drivers'      // assign drivers to deliveries
  | 'view_reports';       // access reports page

export type StaffPermissionPreset =
  | 'sales_rep'         // onboard_customers + view_reports
  | 'product_manager'   // manage_products + manage_inventory
  | 'operations_lead'   // assign_drivers + manage_inventory + view_reports
  | 'senior_staff';     // all permissions

export const STAFF_PRESET_PERMISSIONS: Record<StaffPermissionPreset, StaffPermissionKey[]> = {
  sales_rep:        ['onboard_customers', 'view_reports'],
  product_manager:  ['manage_products', 'manage_inventory'],
  operations_lead:  ['assign_drivers', 'manage_inventory', 'view_reports'],
  senior_staff:     ['onboard_customers', 'manage_products', 'manage_inventory', 'assign_drivers', 'view_reports'],
};

export const STAFF_PRESET_LABELS: Record<StaffPermissionPreset, string> = {
  sales_rep:       'Sales Rep',
  product_manager: 'Product Manager',
  operations_lead: 'Operations Lead',
  senior_staff:    'Senior Staff',
};

export interface User {
  id: number;
  uuid: UUID;
  role: Role;
  email: string;
  fname: string;
  mname?: string | null;
  lname: string;
  phone: string;
  is_verified: boolean;
  status: Status;
  created_at: ISODate;
  updated_at: ISODate;
  /** Only for sales_agent role — which capabilities they have */
  permissions?: StaffPermissionKey[];
  /** Convenience preset label (derived from permissions on backend) */
  permission_preset?: StaffPermissionPreset | null;
}

export interface CustomerProfile {
  id: number;
  uuid: UUID;
  user_id: number;
  onboarded_by?: number | null; // sales_agent user id
  company_name: string;
  address: string;
  pcn_cert: string; // URL to uploaded PCN certificate
  pcn_verified: boolean;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface CustomerWithUser extends CustomerProfile {
  user: User;
  agent?: Pick<User, 'id' | 'fname' | 'lname' | 'email'> | null;
  total_orders: number;
  total_spent: Money;
  last_order_at?: ISODate | null;
}

export type ProductStatus = 'active' | 'draft' | 'discontinued';

/**
 * Products are sold in packs / cartons, never in individual units.
 * pack_size format: "1 x 6 x 25" (cases × packs × units per pack)
 */
export interface Product {
  id: number;
  uuid: UUID;
  /** Brand / trade name */
  name: string;
  /** Generic / INN name */
  generic_name: string;
  sku: string;
  /** Cost price (internal, admin-only) */
  cost_price: Money;
  /** Selling price shown to customers */
  selling_price: Money;
  category: string;
  manufacturer: string;
  /** Dosage form: Tablet, Capsule, Syrup, Injection, etc. */
  form: string;
  /** Product strength e.g. "125mg" */
  strength: string;
  /**
   * Pack size in "cases × packs × units" format, e.g. "1 x 6 x 25".
   * All orders are placed in whole pack multiples.
   */
  pack_size: string;
  prescription_required: boolean;
  image_url: string;
  gallery?: string[];
  /** Shelf / bin location in the warehouse, e.g. "AB001" */
  shelf_location?: string;
  /** Minimum quantity before a low-stock alert is raised */
  min_stock_level?: number;
  /** Suggested reorder quantity */
  reorder_qty?: number;
  status: ProductStatus;
  created_by: number;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface InventoryBatch {
  id: number;
  uuid: UUID;
  product_id: number;
  batch_no: string;
  quantity: number;
  expiry_date: ISODate;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface InventorySnapshot {
  product: Product;
  total_quantity: number;
  batches: InventoryBatch[];
  next_expiry?: ISODate | null;
  is_low_stock: boolean;
  is_expiring_soon: boolean;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded' | 'failed';

export interface OrderItem {
  id: number;
  uuid: UUID;
  order_id: number;
  product_id: number;
  product_name: string; // snapshot
  product_sku: string;  // snapshot
  product_image?: string;
  quantity: number;
  price: Money; // unit price snapshot
  subtotal: Money;
  created_at: ISODate;
}

export interface Order {
  id: number;
  uuid: UUID;
  order_number: string;
  customer_id: number;
  customer_company?: string;
  total_amount: Money;
  status: OrderStatus;
  payment_status: PaymentStatus;
  items: OrderItem[];
  delivery?: Delivery | null;
  payment?: Payment | null;
  notes?: string | null;
  created_at: ISODate;
  updated_at?: ISODate;
}

export type PaymentMethod = 'paystack' | 'bank_transfer' | 'cash_on_delivery';

export interface Payment {
  id: number;
  uuid: UUID;
  order_id: number;
  reference: string;
  amount: Money;
  status: PaymentStatus;
  payment_method: PaymentMethod;
  paid_at?: ISODate | null;
}

export type DeliveryStatus =
  | 'awaiting_dispatch'  // admin assigned a driver; driver hasn't acknowledged yet
  | 'assigned'           // driver acknowledged — visible on admin dashboard
  | 'in_transit'         // driver has started the journey
  | 'out_for_delivery'   // last-mile (optional granularity)
  | 'delivered'
  | 'failed'
  | 'returned';

export interface DeliveryEvent {
  status: DeliveryStatus;
  description: string;
  location?: string;
  occurred_at: ISODate;
}

export interface Delivery {
  id: number;
  uuid: UUID;
  order_id: number;
  tracking_code: string;
  status: DeliveryStatus;
  driver_id?: number | null;    // references Driver.id
  driver_name?: string;
  driver_phone?: string;
  vehicle_plate?: string;
  estimated_arrival?: ISODate;
  events: DeliveryEvent[];
  acknowledged_at?: ISODate | null; // driver acknowledged the assignment
  created_at: ISODate;
  updated_at: ISODate;
}

export type DriverStatus = 'available' | 'on_delivery' | 'off_duty' | 'suspended';

export interface Driver {
  id: number;
  uuid: UUID;
  user_id: number; // references User with role=driver
  vehicle_plate: string;
  vehicle_type: string;
  region: string;
  driver_status: DriverStatus;
  total_deliveries: number;
  rating?: number | null;
  user: User;
  created_at: ISODate;
  updated_at: ISODate;
}

export type NotificationType =
  | 'order'
  | 'payment'
  | 'delivery'
  | 'system'
  | 'inventory'
  | 'promo';

export interface Notification {
  id: number;
  uuid: UUID;
  user_id: number;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  link?: string;
  created_at: ISODate;
}

export interface Review {
  id: number;
  uuid: UUID;
  product_id: number;
  customer_id: number;
  customer_name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  created_at: ISODate;
}

export interface BasketItem {
  product_id:    number;
  sku:           string;
  name:          string;
  price:         Money;
  image:         string;
  quantity:      number;
  pack_size:     string;
  minimum_order: number;
}

export interface Basket {
  items: BasketItem[];
  subtotal: Money;
  item_count: number;
}

/**
 * Session user — matches the TokenPayload embedded in the JWT.
 * All fields are verified on every request via JWT signature.
 *
 * Computed helper: `full_name = first_name + " " + last_name`
 */
export interface SessionUser {
  userId:     number;
  role:       Role;
  email:      string;
  first_name: string;
  last_name:  string;
  /** Convenience accessor — not stored in JWT, derived on the client */
  full_name?: string;
  /** Staff permission keys — populated from DB for STAFF role */
  permissions?:       StaffPermissionKey[];
  permission_preset?: StaffPermissionPreset | null;
  /** Customer PCN gate fields — checked via DB query in portal layout */
  pcn_uploaded?: boolean;
  pcn_verified?: boolean;
}

export function hasPermission(
  session: SessionUser | null,
  key: StaffPermissionKey,
): boolean {
  if (!session) return false;
  if (session.role === 'ADMIN') return true;
  return session.permissions?.includes(key) ?? false;
}
