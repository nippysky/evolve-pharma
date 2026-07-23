/**
 * ENVOLVE PHARMACEUTICALS — Console dummy data
 *
 * Single source of truth for all admin/console demo data.
 * Everything is typed against the real interfaces in src/types.
 * When the backend API is ready, replace each export with an API hook —
 * the consuming components are already wired to these shapes.
 */

import type {
  Order, OrderItem, Delivery, Driver, InventorySnapshot, InventoryBatch,
  CustomerWithUser, User,
} from '@/types';
import { DUMMY_PRODUCTS } from './dummy-products';

// ─── User factory ─────────────────────────────────────────────────────────

function makeUser(
  id: number, fname: string, lname: string, email: string, phone: string,
  role: User['role'] = 'customer',
): User {
  return {
    id,
    uuid: `user-${id.toString().padStart(3, '0')}`,
    fname,
    lname,
    email,
    phone,
    role,
    is_verified: true,
    status: 'active',
    created_at: '2026-01-10T08:00:00Z',
    updated_at: '2026-07-01T08:00:00Z',
  };
}

// ─── Customers ────────────────────────────────────────────────────────────

export const DUMMY_CUSTOMERS: CustomerWithUser[] = [
  {
    id: 1, uuid: 'cust-001', user_id: 101,
    company_name: 'Greenleaf Pharmacy Ltd.',
    address: '12 Lagos Street, Wuse 2, Abuja FCT',
    pcn_cert: 'https://cdn.envolvepharm.com.ng/pcn/greenleaf.pdf',
    pcn_verified: true,
    created_at: '2026-01-15T10:00:00Z', updated_at: '2026-07-01T10:00:00Z',
    user: makeUser(101, 'Adaeze', 'Nwosu', 'adaeze.nwosu@greenleafpharmacy.ng', '08034567890'),
    total_orders: 12, total_spent: 451_300, last_order_at: '2026-07-21T09:14:22Z',
  },
  {
    id: 2, uuid: 'cust-002', user_id: 102,
    company_name: 'Wellspring Health Centre',
    address: '5 Awolowo Road, Ikoyi, Lagos',
    pcn_cert: 'https://cdn.envolvepharm.com.ng/pcn/wellspring.pdf',
    pcn_verified: true,
    created_at: '2026-02-03T08:30:00Z', updated_at: '2026-06-20T08:30:00Z',
    user: makeUser(102, 'Chibuike', 'Obi', 'c.obi@wellspringhealth.ng', '09012345678'),
    total_orders: 7, total_spent: 143_800, last_order_at: '2026-07-20T14:30:00Z',
  },
  {
    id: 3, uuid: 'cust-003', user_id: 103,
    company_name: 'Apex Chemist & Stores',
    address: '22 Ogui Road, Enugu',
    pcn_cert: 'https://cdn.envolvepharm.com.ng/pcn/apex.pdf',
    pcn_verified: false,
    created_at: '2026-02-18T11:00:00Z', updated_at: '2026-07-05T11:00:00Z',
    user: makeUser(103, 'Ngozi', 'Eze', 'ngozi.eze@apexchemist.ng', '08123456789'),
    total_orders: 3, total_spent: 38_600, last_order_at: '2026-07-12T16:20:00Z',
  },
  {
    id: 4, uuid: 'cust-004', user_id: 104,
    company_name: 'Sunrise Medical Supplies',
    address: '8 Trans Amadi, Port Harcourt',
    pcn_cert: 'https://cdn.envolvepharm.com.ng/pcn/sunrise.pdf',
    pcn_verified: true,
    created_at: '2026-03-05T09:00:00Z', updated_at: '2026-07-10T09:00:00Z',
    user: makeUser(104, 'Amaka', 'Ikenna', 'a.ikenna@sunrisemedical.ng', '07056789012'),
    total_orders: 8, total_spent: 186_100, last_order_at: '2026-07-18T11:05:00Z',
  },
  {
    id: 5, uuid: 'cust-005', user_id: 105,
    company_name: 'MedPlus Pharmacy – Kano',
    address: '14 Ibrahim Taiwo Road, Kano',
    pcn_cert: 'https://cdn.envolvepharm.com.ng/pcn/medplus.pdf',
    pcn_verified: true,
    created_at: '2026-03-22T14:00:00Z', updated_at: '2026-06-30T14:00:00Z',
    user: makeUser(105, 'Yusuf', 'Abdullahi', 'yusuf@medpluskano.ng', '08090123456'),
    total_orders: 5, total_spent: 72_500, last_order_at: '2026-07-17T08:40:00Z',
  },
  {
    id: 6, uuid: 'cust-006', user_id: 106,
    company_name: 'HealthBridge Dispensary',
    address: '3 Ring Road, Ibadan',
    pcn_cert: '',
    pcn_verified: false,
    created_at: '2026-07-18T07:30:00Z', updated_at: '2026-07-18T07:30:00Z',
    user: makeUser(106, 'Seun', 'Adesanya', 's.adesanya@healthbridge.ng', '08076543210'),
    total_orders: 0, total_spent: 0, last_order_at: null,
  },
];

// ─── Orders ───────────────────────────────────────────────────────────────

function makeItem(
  id: number, orderId: number, productIndex: number, qty: number,
): OrderItem {
  const p = DUMMY_PRODUCTS[productIndex]!;
  return {
    id,
    uuid: `oi-${orderId.toString().padStart(3, '0')}-${id}`,
    order_id: orderId,
    product_id: p.id,
    product_name: p.name,
    product_sku: p.sku,
    product_image: p.image_url,
    quantity: qty,
    price: p.selling_price,
    subtotal: p.selling_price * qty,
    created_at: '2026-07-01T00:00:00Z',
  };
}

export type ConsoleOrder = Order & { customer_name: string };

export const DUMMY_CONSOLE_ORDERS: ConsoleOrder[] = [
  {
    id: 1, uuid: 'ord-c-001', order_number: 'EVP-2026-0041',
    customer_id: 1, customer_name: 'Adaeze Nwosu', customer_company: 'Greenleaf Pharmacy Ltd.',
    status: 'dispatched', payment_status: 'paid', total_amount: 87_500,
    notes: '12 Lagos Street, Wuse 2, Abuja FCT',
    created_at: '2026-07-21T09:14:22Z', updated_at: '2026-07-21T12:30:00Z',
    items: [makeItem(1, 1, 0, 10), makeItem(2, 1, 3, 5), makeItem(3, 1, 7, 12)],
  },
  {
    id: 2, uuid: 'ord-c-002', order_number: 'EVP-2026-0038',
    customer_id: 2, customer_name: 'Chibuike Obi', customer_company: 'Wellspring Health Centre',
    status: 'processing', payment_status: 'paid', total_amount: 45_200,
    notes: '5 Awolowo Road, Ikoyi, Lagos',
    created_at: '2026-07-20T14:30:00Z', updated_at: '2026-07-20T14:30:00Z',
    items: [makeItem(4, 2, 1, 8), makeItem(5, 2, 5, 6)],
  },
  {
    id: 3, uuid: 'ord-c-003', order_number: 'EVP-2026-0035',
    customer_id: 4, customer_name: 'Amaka Ikenna', customer_company: 'Sunrise Medical Supplies',
    status: 'delivered', payment_status: 'paid', total_amount: 132_000,
    notes: '8 Trans Amadi, Port Harcourt',
    created_at: '2026-07-18T11:05:00Z', updated_at: '2026-07-19T11:30:00Z',
    items: [makeItem(6, 3, 2, 20), makeItem(7, 3, 4, 15), makeItem(8, 3, 6, 10)],
  },
  {
    id: 4, uuid: 'ord-c-004', order_number: 'EVP-2026-0032',
    customer_id: 5, customer_name: 'Yusuf Abdullahi', customer_company: 'MedPlus Pharmacy – Kano',
    status: 'pending', payment_status: 'unpaid', total_amount: 28_750,
    notes: '14 Ibrahim Taiwo Road, Kano',
    created_at: '2026-07-17T08:40:00Z', updated_at: '2026-07-17T08:40:00Z',
    items: [makeItem(9, 4, 8, 5), makeItem(10, 4, 9, 8)],
  },
  {
    id: 5, uuid: 'ord-c-005', order_number: 'EVP-2026-0029',
    customer_id: 1, customer_name: 'Adaeze Nwosu', customer_company: 'Greenleaf Pharmacy Ltd.',
    status: 'delivered', payment_status: 'paid', total_amount: 64_300,
    notes: '12 Lagos Street, Wuse 2, Abuja FCT',
    created_at: '2026-07-14T10:00:00Z', updated_at: '2026-07-15T10:00:00Z',
    items: [makeItem(11, 5, 10, 18)],
  },
  {
    id: 6, uuid: 'ord-c-006', order_number: 'EVP-2026-0026',
    customer_id: 3, customer_name: 'Ngozi Eze', customer_company: 'Apex Chemist & Stores',
    status: 'cancelled', payment_status: 'refunded', total_amount: 19_400,
    notes: '22 Ogui Road, Enugu',
    created_at: '2026-07-12T16:20:00Z', updated_at: '2026-07-12T16:20:00Z',
    items: [makeItem(12, 6, 11, 4)],
  },
  {
    id: 7, uuid: 'ord-c-007', order_number: 'EVP-2026-0022',
    customer_id: 2, customer_name: 'Chibuike Obi', customer_company: 'Wellspring Health Centre',
    status: 'delivered', payment_status: 'paid', total_amount: 98_600,
    notes: '5 Awolowo Road, Ikoyi, Lagos',
    created_at: '2026-07-09T13:15:00Z', updated_at: '2026-07-10T11:00:00Z',
    items: [makeItem(13, 7, 12, 12), makeItem(14, 7, 13, 10)],
  },
  {
    id: 8, uuid: 'ord-c-008', order_number: 'EVP-2026-0018',
    customer_id: 4, customer_name: 'Amaka Ikenna', customer_company: 'Sunrise Medical Supplies',
    status: 'delivered', payment_status: 'paid', total_amount: 54_100,
    notes: '8 Trans Amadi, Port Harcourt',
    created_at: '2026-07-05T09:55:00Z', updated_at: '2026-07-05T09:55:00Z',
    items: [makeItem(15, 8, 14, 15)],
  },
];

// ─── Drivers ──────────────────────────────────────────────────────────────

export const DUMMY_DRIVERS: Driver[] = [
  {
    id: 1, uuid: 'drv-001', user_id: 201,
    vehicle_plate: 'LND 482 EW', vehicle_type: 'Van',
    region: 'Lagos', driver_status: 'on_delivery',
    total_deliveries: 47, rating: 4.8,
    created_at: '2025-11-01T08:00:00Z', updated_at: '2026-07-21T08:00:00Z',
    user: makeUser(201, 'Emeka', 'Obieze', 'emeka.obieze@envolvepharm.ng', '08057234890', 'driver'),
  },
  {
    id: 2, uuid: 'drv-002', user_id: 202,
    vehicle_plate: 'ABJ 197 KA', vehicle_type: 'Motorcycle',
    region: 'Abuja FCT', driver_status: 'available',
    total_deliveries: 31, rating: 4.5,
    created_at: '2025-12-10T08:00:00Z', updated_at: '2026-07-20T08:00:00Z',
    user: makeUser(202, 'Musa', 'Garba', 'musa.garba@envolvepharm.ng', '09034567123', 'driver'),
  },
  {
    id: 3, uuid: 'drv-003', user_id: 203,
    vehicle_plate: 'PHC 033 RS', vehicle_type: 'Van',
    region: 'Rivers', driver_status: 'available',
    total_deliveries: 22, rating: 4.6,
    created_at: '2026-01-15T08:00:00Z', updated_at: '2026-07-19T08:00:00Z',
    user: makeUser(203, 'Tonye', 'Briggs', 'tonye.briggs@envolvepharm.ng', '08012345670', 'driver'),
  },
  {
    id: 4, uuid: 'drv-004', user_id: 204,
    vehicle_plate: 'KNO 855 AM', vehicle_type: 'Van',
    region: 'Kano', driver_status: 'off_duty',
    total_deliveries: 15, rating: 4.2,
    created_at: '2026-02-20T08:00:00Z', updated_at: '2026-07-15T08:00:00Z',
    user: makeUser(204, 'Ibrahim', 'Suleiman', 'ibrahim.s@envolvepharm.ng', '08098765432', 'driver'),
  },
];

// ─── Deliveries ───────────────────────────────────────────────────────────

export const DUMMY_DELIVERIES: Delivery[] = [
  {
    id: 1, uuid: 'del-001', order_id: 1,
    tracking_code: 'EVP-TRK-9847', status: 'in_transit',
    driver_id: 1, driver_name: 'Emeka Obieze', driver_phone: '08057234890',
    vehicle_plate: 'LND 482 EW', estimated_arrival: '2026-07-22T14:00:00Z',
    events: [
      { status: 'assigned',   description: 'Driver assigned',    occurred_at: '2026-07-21T10:00:00Z' },
      { status: 'in_transit', description: 'Shipment picked up', occurred_at: '2026-07-21T12:30:00Z' },
    ],
    created_at: '2026-07-21T09:30:00Z', updated_at: '2026-07-21T12:30:00Z',
  },
  {
    id: 2, uuid: 'del-002', order_id: 2,
    tracking_code: 'EVP-TRK-9831', status: 'awaiting_dispatch',
    driver_id: null, events: [],
    created_at: '2026-07-20T14:45:00Z', updated_at: '2026-07-20T14:45:00Z',
  },
  {
    id: 3, uuid: 'del-003', order_id: 3,
    tracking_code: 'EVP-TRK-9809', status: 'delivered',
    driver_id: 3, driver_name: 'Tonye Briggs', driver_phone: '08012345670',
    vehicle_plate: 'PHC 033 RS',
    events: [
      { status: 'assigned',         description: 'Driver assigned',       occurred_at: '2026-07-18T12:00:00Z' },
      { status: 'in_transit',       description: 'Shipment picked up',    occurred_at: '2026-07-18T14:00:00Z' },
      { status: 'out_for_delivery', description: 'Out for delivery',      occurred_at: '2026-07-19T09:00:00Z' },
      { status: 'delivered',        description: 'Delivered to customer', occurred_at: '2026-07-19T11:30:00Z' },
    ],
    created_at: '2026-07-18T11:30:00Z', updated_at: '2026-07-19T11:30:00Z',
  },
  {
    id: 4, uuid: 'del-004', order_id: 5,
    tracking_code: 'EVP-TRK-9788', status: 'delivered',
    driver_id: 2, driver_name: 'Musa Garba', driver_phone: '09034567123',
    vehicle_plate: 'ABJ 197 KA',
    events: [
      { status: 'assigned',   description: 'Driver assigned',    occurred_at: '2026-07-14T11:00:00Z' },
      { status: 'in_transit', description: 'Shipment picked up', occurred_at: '2026-07-14T13:00:00Z' },
      { status: 'delivered',  description: 'Delivered',          occurred_at: '2026-07-15T10:00:00Z' },
    ],
    created_at: '2026-07-14T10:30:00Z', updated_at: '2026-07-15T10:00:00Z',
  },
  {
    id: 5, uuid: 'del-005', order_id: 7,
    tracking_code: 'EVP-TRK-9754', status: 'delivered',
    driver_id: 1, driver_name: 'Emeka Obieze', driver_phone: '08057234890',
    vehicle_plate: 'LND 482 EW',
    events: [
      { status: 'assigned',   description: 'Driver assigned',   occurred_at: '2026-07-09T14:00:00Z' },
      { status: 'in_transit', description: 'Picked up',         occurred_at: '2026-07-09T15:30:00Z' },
      { status: 'delivered',  description: 'Delivered',         occurred_at: '2026-07-10T11:00:00Z' },
    ],
    created_at: '2026-07-09T13:45:00Z', updated_at: '2026-07-10T11:00:00Z',
  },
];

// ─── Inventory ────────────────────────────────────────────────────────────

const STOCK_SEEDS: [qty: number, reorder: number, batch: string, expiry: string][] = [
  [240, 50,  'BN-2026-A01', '2027-06-30'],
  [85,  30,  'BN-2026-A02', '2027-03-15'],
  [420, 100, 'BN-2026-A03', '2028-01-20'],
  [18,  40,  'BN-2026-A04', '2026-12-31'],
  [560, 80,  'BN-2026-A05', '2028-05-10'],
  [7,   25,  'BN-2026-A06', '2026-10-31'],
  [310, 60,  'BN-2026-A07', '2027-09-15'],
  [150, 50,  'BN-2026-A08', '2027-04-20'],
  [22,  40,  'BN-2026-A09', '2026-11-30'],
  [480, 100, 'BN-2026-A10', '2028-02-28'],
  [95,  30,  'BN-2026-A11', '2027-07-31'],
  [200, 50,  'BN-2026-A12', '2027-10-15'],
  [4,   20,  'BN-2026-A13', '2026-09-30'],
  [330, 70,  'BN-2026-A14', '2028-03-10'],
  [175, 40,  'BN-2026-A15', '2027-06-15'],
  [12,  30,  'BN-2026-A16', '2026-12-15'],
  [290, 60,  'BN-2026-A17', '2027-11-20'],
  [460, 80,  'BN-2026-A18', '2028-04-05'],
  [65,  40,  'BN-2026-A19', '2027-02-28'],
  [380, 70,  'BN-2026-A20', '2027-08-31'],
  [110, 35,  'BN-2026-A21', '2027-05-20'],
];

export const DUMMY_INVENTORY: InventorySnapshot[] = DUMMY_PRODUCTS.map((product, i) => {
  const seed = STOCK_SEEDS[i] ?? [100, 20, 'BN-2026-X99', '2027-12-31'];
  const [qty, reorder, batchNo, expiry] = seed;
  const batch: InventoryBatch = {
    id: i + 1,
    uuid: `batch-${i + 1}`,
    product_id: product.id,
    batch_no: batchNo,
    quantity: qty,
    expiry_date: expiry,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  };
  const daysLeft = (new Date(expiry).getTime() - Date.now()) / 86_400_000;
  return {
    product,
    total_quantity: qty,
    batches: [batch],
    next_expiry: expiry,
    is_low_stock:     qty <= reorder,
    is_expiring_soon: daysLeft <= 90,
  };
});

// ─── Computed summary stats ───────────────────────────────────────────────

export const CONSOLE_STATS = {
  revenue_mtd:      1_247_800,
  orders_mtd:       28,
  active_customers: 14,
  low_stock_skus:   DUMMY_INVENTORY.filter((s) => s.is_low_stock).length,
} as const;
