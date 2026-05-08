/**
 * ENVOLVE PHARMACEUTICALS — Domain Types
 *
 * These types mirror the backend ERD (users, customer_profiles, products,
 * inventories, orders, order_items, payments, deliveries, notifications,
 * reviews) and are the single source of truth shared between server and
 * client code.
 */

// ---------- Common ---------------------------------------------------------

export type UUID = string;
export type ISODate = string;
export type Money = number; // stored in NGN minor units... actually we use major units (₦) here for simplicity

export type Role = 'admin' | 'sales_agent' | 'customer';
export type Status = 'active' | 'inactive' | 'pending' | 'suspended';

// ---------- User ----------------------------------------------------------

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
}

// ---------- Customer Profile ----------------------------------------------

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

// ---------- Product -------------------------------------------------------

export type ProductStatus = 'active' | 'draft' | 'discontinued';

export interface Product {
  id: number;
  uuid: UUID;
  name: string;
  description: string;
  sku: string;
  price: Money;
  category: string;
  manufacturer: string;
  form: string; // tablet, capsule, syrup, injection, etc.
  strength: string; // e.g. "500mg"
  pack_size: string; // e.g. "30 tabs/pack"
  prescription_required: boolean;
  image_url: string;
  gallery?: string[];
  status: ProductStatus;
  created_by: number;
  created_at: ISODate;
  updated_at: ISODate;
}

// ---------- Inventory ----------------------------------------------------

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

// ---------- Orders --------------------------------------------------------

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
  product_sku: string; // snapshot
  product_image?: string; // snapshot
  quantity: number;
  price: Money; // unit price snapshot
  subtotal: Money;
  created_at: ISODate;
}

export interface Order {
  id: number;
  uuid: UUID;
  order_number: string; // human-friendly e.g. EVP-2025-00148
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

// ---------- Payment -------------------------------------------------------

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

// ---------- Delivery ------------------------------------------------------

export type DeliveryStatus =
  | 'awaiting_dispatch'
  | 'in_transit'
  | 'out_for_delivery'
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
  driver_name?: string;
  driver_phone?: string;
  vehicle_plate?: string;
  estimated_arrival?: ISODate;
  events: DeliveryEvent[];
  created_at: ISODate;
  updated_at: ISODate;
}

// ---------- Notification --------------------------------------------------

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

// ---------- Review --------------------------------------------------------

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

// ---------- Basket (client-side) ------------------------------------------

export interface BasketItem {
  product_id: number;
  sku: string;
  name: string;
  price: Money;
  image: string;
  quantity: number;
  pack_size: string;
}

export interface Basket {
  items: BasketItem[];
  subtotal: Money;
  item_count: number;
}

// ---------- Session -------------------------------------------------------

export interface SessionUser {
  id: number;
  uuid: UUID;
  role: Role;
  email: string;
  full_name: string;
  company_name?: string;
  avatar_url?: string;
}
