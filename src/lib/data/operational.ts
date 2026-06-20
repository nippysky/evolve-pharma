/**
 * ENVOLVE PHARMACEUTICALS — Mock Operational Data
 * (customers, orders, deliveries, agents, notifications, inventory)
 */

import type {
  CustomerWithUser,
  Order,
  Delivery,
  Notification,
  InventorySnapshot,
  User,
  Review,
  SessionUser,
} from '@/types';
import { PRODUCTS } from './products';
import { STAFF_MEMBERS } from './staff';

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();

// ---------- Sales Agents (Staff) -----------------------------------------
// Re-exported from staff.ts for backward compat across the codebase.

export const AGENTS: User[] = STAFF_MEMBERS;

// ---------- Customers (Businesses) ---------------------------------------

export const CUSTOMERS: CustomerWithUser[] = [
  {
    id: 101,
    uuid: 'cp-101',
    user_id: 1001,
    onboarded_by: 11,
    company_name: 'Greenleaf Pharmacy Ltd.',
    address: '12 Lagos Street, Wuse 2, Abuja',
    pcn_cert: 'https://cdn.envolvepharm.com.ng/pcn/greenleaf.pdf',
    pcn_verified: true,
    created_at: daysAgo(180),
    updated_at: daysAgo(8),
    user: {
      id: 1001,
      uuid: 'u-1001',
      role: 'customer',
      email: 'orders@greenleaf.ng',
      fname: 'Chinedu',
      lname: 'Okafor',
      phone: '+234 803 555 0101',
      is_verified: true,
      status: 'active',
      created_at: daysAgo(180),
      updated_at: daysAgo(8),
    },
    agent: { id: 11, fname: 'Amaka', lname: 'Eze', email: 'amaka.eze@envolvepharm.com.ng' },
    total_orders: 24,
    total_spent: 1_485_400,
    last_order_at: daysAgo(2),
  },
  {
    id: 102,
    uuid: 'cp-102',
    user_id: 1002,
    onboarded_by: null,
    company_name: 'CityCare Pharmacy',
    address: '5 Awolowo Road, Ikoyi, Lagos',
    pcn_cert: 'https://cdn.envolvepharm.com.ng/pcn/citycare.pdf',
    pcn_verified: true,
    created_at: daysAgo(120),
    updated_at: daysAgo(4),
    user: {
      id: 1002,
      uuid: 'u-1002',
      role: 'customer',
      email: 'admin@citycarepharm.ng',
      fname: 'Adaeze',
      lname: 'Nwankwo',
      phone: '+234 802 444 0202',
      is_verified: true,
      status: 'active',
      created_at: daysAgo(120),
      updated_at: daysAgo(4),
    },
    agent: null,
    total_orders: 17,
    total_spent: 980_200,
    last_order_at: daysAgo(4),
  },
  {
    id: 103,
    uuid: 'cp-103',
    user_id: 1003,
    onboarded_by: 12,
    company_name: 'Wellspring Chemists',
    address: '23 Aminu Kano Crescent, Wuse 2, Abuja',
    pcn_cert: 'https://cdn.envolvepharm.com.ng/pcn/wellspring.pdf',
    pcn_verified: false,
    created_at: daysAgo(14),
    updated_at: daysAgo(1),
    user: {
      id: 1003,
      uuid: 'u-1003',
      role: 'customer',
      email: 'pharm@wellspring.ng',
      fname: 'Ibrahim',
      lname: 'Yusuf',
      phone: '+234 805 333 0303',
      is_verified: false,
      status: 'pending',
      created_at: daysAgo(14),
      updated_at: daysAgo(1),
    },
    agent: { id: 12, fname: 'Tobi', lname: 'Adeyemi', email: 'tobi.adeyemi@envolvepharm.com.ng' },
    total_orders: 1,
    total_spent: 24_500,
    last_order_at: daysAgo(8),
  },
  {
    id: 104,
    uuid: 'cp-104',
    user_id: 1004,
    onboarded_by: 13,
    company_name: 'MedPlus Wuse',
    address: '7 Bangui Street, Wuse 2, Abuja',
    pcn_cert: 'https://cdn.envolvepharm.com.ng/pcn/medplus.pdf',
    pcn_verified: true,
    created_at: daysAgo(75),
    updated_at: daysAgo(3),
    user: {
      id: 1004,
      uuid: 'u-1004',
      role: 'customer',
      email: 'wuse@medplus.ng',
      fname: 'Sandra',
      lname: 'Akpabio',
      phone: '+234 809 222 0404',
      is_verified: true,
      status: 'active',
      created_at: daysAgo(75),
      updated_at: daysAgo(3),
    },
    agent: { id: 13, fname: 'Fatima', lname: 'Bello', email: 'fatima.bello@envolvepharm.com.ng' },
    total_orders: 9,
    total_spent: 562_800,
    last_order_at: daysAgo(3),
  },
  {
    id: 105,
    uuid: 'cp-105',
    user_id: 1005,
    onboarded_by: null,
    company_name: 'Healthbridge Pharmacy',
    address: '88 Allen Avenue, Ikeja, Lagos',
    pcn_cert: 'https://cdn.envolvepharm.com.ng/pcn/healthbridge.pdf',
    pcn_verified: true,
    created_at: daysAgo(240),
    updated_at: daysAgo(12),
    user: {
      id: 1005,
      uuid: 'u-1005',
      role: 'customer',
      email: 'orders@healthbridge.ng',
      fname: 'Bola',
      lname: 'Ogunleye',
      phone: '+234 803 111 0505',
      is_verified: true,
      status: 'active',
      created_at: daysAgo(240),
      updated_at: daysAgo(12),
    },
    agent: null,
    total_orders: 41,
    total_spent: 3_120_500,
    last_order_at: daysAgo(1),
  },
];

// ---------- Orders -------------------------------------------------------

const buildOrder = (
  id: number,
  customer_id: number,
  productIds: { id: number; qty: number }[],
  status: Order['status'],
  payment_status: Order['payment_status'],
  daysOld: number,
): Order => {
  const items = productIds.map(({ id: pid, qty }, i) => {
    const p = PRODUCTS.find((x) => x.id === pid)!;
    return {
      id: id * 100 + i,
      uuid: `oi-${id}-${i}`,
      order_id: id,
      product_id: p.id,
      product_name: p.name,
      product_sku: p.sku,
      product_image: p.image_url,
      quantity: qty,
      price: p.selling_price,
      subtotal: p.selling_price * qty,
      created_at: daysAgo(daysOld),
    };
  });
  const total = items.reduce((sum, i) => sum + i.subtotal, 0);
  const customer = CUSTOMERS.find((c) => c.id === customer_id);
  return {
    id,
    uuid: `o-${id}`,
    order_number: `EVP-2025-${String(id).padStart(5, '0')}`,
    customer_id,
    customer_company: customer?.company_name,
    total_amount: total,
    status,
    payment_status,
    items,
    created_at: daysAgo(daysOld),
    updated_at: daysAgo(Math.max(0, daysOld - 1)),
  };
};

export const ORDERS: Order[] = [
  buildOrder(148, 101, [{ id: 1, qty: 20 }, { id: 2, qty: 50 }, { id: 4, qty: 30 }], 'delivered', 'paid', 12),
  buildOrder(151, 105, [{ id: 5, qty: 40 }, { id: 6, qty: 60 }], 'delivered', 'paid', 10),
  buildOrder(156, 102, [{ id: 3, qty: 100 }], 'dispatched', 'paid', 4),
  buildOrder(159, 101, [{ id: 7, qty: 12 }, { id: 8, qty: 20 }], 'processing', 'paid', 2),
  buildOrder(162, 105, [{ id: 9, qty: 30 }, { id: 10, qty: 80 }], 'confirmed', 'paid', 1),
  buildOrder(164, 104, [{ id: 11, qty: 24 }, { id: 12, qty: 30 }], 'pending', 'unpaid', 0),
  buildOrder(141, 103, [{ id: 2, qty: 20 }], 'cancelled', 'refunded', 8),
];

// ---------- Deliveries ---------------------------------------------------

export const DELIVERIES: Delivery[] = [
  {
    id: 1,
    uuid: 'd-001',
    order_id: 156,
    tracking_code: 'EVL-NG-561284',
    status: 'in_transit',
    driver_id: 1,
    driver_name: 'Musa Bello',
    driver_phone: '+234 803 222 1148',
    vehicle_plate: 'ABJ-148-XK',
    estimated_arrival: daysAhead(1),
    acknowledged_at: daysAgo(2),
    events: [
      {
        status: 'awaiting_dispatch',
        description: 'Order packed at Abuja warehouse',
        location: 'Abuja DC',
        occurred_at: daysAgo(3),
      },
      {
        status: 'in_transit',
        description: 'Out for inter-city transit',
        location: 'En route to Lagos',
        occurred_at: daysAgo(2),
      },
    ],
    created_at: daysAgo(3),
    updated_at: daysAgo(1),
  },
  {
    // Assigned — driver acknowledged, not yet started
    id: 2,
    uuid: 'd-002',
    order_id: 159,
    tracking_code: 'EVL-NG-591820',
    status: 'assigned',
    driver_id: 3,
    driver_name: 'Kola Adesanya',
    driver_phone: '+234 809 112 5560',
    vehicle_plate: 'LAS-554-QB',
    estimated_arrival: daysAhead(2),
    acknowledged_at: daysAgo(0.5),
    events: [
      {
        status: 'awaiting_dispatch',
        description: 'Order packed and ready for dispatch',
        location: 'Abuja DC',
        occurred_at: daysAgo(1),
      },
      {
        status: 'assigned',
        description: 'Driver acknowledged assignment',
        location: 'Lagos Mainland',
        occurred_at: daysAgo(0.5),
      },
    ],
    created_at: daysAgo(1),
    updated_at: daysAgo(0.5),
  },
  {
    id: 3,
    uuid: 'd-003',
    order_id: 148,
    tracking_code: 'EVL-NG-480122',
    status: 'delivered',
    driver_id: 2,
    driver_name: 'Emeka Osei',
    driver_phone: '+234 806 344 2290',
    vehicle_plate: 'LAS-320-KA',
    estimated_arrival: daysAgo(10),
    acknowledged_at: daysAgo(12),
    events: [
      {
        status: 'awaiting_dispatch',
        description: 'Order packed at Lagos warehouse',
        location: 'Lagos DC',
        occurred_at: daysAgo(14),
      },
      {
        status: 'in_transit',
        description: 'Picked up by driver',
        location: 'Lagos',
        occurred_at: daysAgo(13),
      },
      {
        status: 'out_for_delivery',
        description: 'Out for last-mile delivery',
        location: 'Wuse 2, Abuja',
        occurred_at: daysAgo(10),
      },
      {
        status: 'delivered',
        description: 'Delivered and signed for',
        location: '12 Lagos Street, Wuse 2, Abuja',
        occurred_at: daysAgo(10),
      },
    ],
    created_at: daysAgo(14),
    updated_at: daysAgo(10),
  },
  {
    id: 4,
    uuid: 'd-004',
    order_id: 151,
    tracking_code: 'EVL-NG-510044',
    status: 'delivered',
    driver_id: 2,
    driver_name: 'Emeka Osei',
    driver_phone: '+234 806 344 2290',
    vehicle_plate: 'LAS-320-KA',
    estimated_arrival: daysAgo(8),
    acknowledged_at: daysAgo(11),
    events: [
      {
        status: 'awaiting_dispatch',
        description: 'Ready for dispatch',
        location: 'Lagos DC',
        occurred_at: daysAgo(12),
      },
      {
        status: 'in_transit',
        description: 'Picked up',
        location: 'Lagos',
        occurred_at: daysAgo(11),
      },
      {
        status: 'delivered',
        description: 'Delivered successfully',
        location: '88 Allen Avenue, Ikeja, Lagos',
        occurred_at: daysAgo(8),
      },
    ],
    created_at: daysAgo(12),
    updated_at: daysAgo(8),
  },
];

// ---------- Notifications ------------------------------------------------

export const NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    uuid: 'n-001',
    user_id: 1001,
    title: 'Order EVP-2025-00148 delivered',
    message: 'Greenleaf Pharmacy Ltd. signed for the parcel at 14:32. Thank you for ordering with Envolve.',
    type: 'delivery',
    is_read: false,
    link: '/portal/orders/148',
    created_at: daysAgo(0.2),
  },
  {
    id: 2,
    uuid: 'n-002',
    user_id: 1001,
    title: 'Payment received',
    message: 'We received your payment of ₦240,400 for EVP-2025-00159 via Paystack.',
    type: 'payment',
    is_read: false,
    link: '/portal/orders/159',
    created_at: daysAgo(2),
  },
  {
    id: 3,
    uuid: 'n-003',
    user_id: 1001,
    title: 'New product available',
    message: 'Vitamin C 1000mg Effervescent is now in stock with 600 units across 2 batches.',
    type: 'system',
    is_read: true,
    link: '/portal/catalog/VTC-1000-20',
    created_at: daysAgo(5),
  },
  {
    id: 4,
    uuid: 'n-004',
    user_id: 1001,
    title: 'PCN certificate verified',
    message: 'Your PCN certificate has been verified. You now have full access to the catalog.',
    type: 'system',
    is_read: true,
    created_at: daysAgo(180),
  },
];

// ---------- Inventory ----------------------------------------------------

export const INVENTORY: InventorySnapshot[] = PRODUCTS.map((p, idx) => {
  const expiringSoon = idx % 5 === 0;
  const lowStock = idx % 4 === 0;
  return {
    product: p,
    total_quantity: lowStock ? 28 + idx : 480 + idx * 32,
    next_expiry: expiringSoon ? daysAhead(45 + idx) : daysAhead(420 + idx * 10),
    is_low_stock: lowStock,
    is_expiring_soon: expiringSoon,
    batches: [
      {
        id: idx * 10 + 1,
        uuid: `b-${p.sku}-1`,
        product_id: p.id,
        batch_no: `BN-${2025}-${String(idx + 1).padStart(3, '0')}A`,
        quantity: lowStock ? 12 + idx : 240 + idx * 12,
        expiry_date: expiringSoon ? daysAhead(45 + idx) : daysAhead(420 + idx * 10),
        created_at: daysAgo(40),
        updated_at: daysAgo(2),
      },
      {
        id: idx * 10 + 2,
        uuid: `b-${p.sku}-2`,
        product_id: p.id,
        batch_no: `BN-${2025}-${String(idx + 1).padStart(3, '0')}B`,
        quantity: lowStock ? 16 : 240 + idx * 20,
        expiry_date: daysAhead(720 + idx * 5),
        created_at: daysAgo(15),
        updated_at: daysAgo(1),
      },
    ],
  };
});

// ---------- Reviews ------------------------------------------------------

export const REVIEWS: Review[] = [
  {
    id: 1,
    uuid: 'r-001',
    product_id: 1,
    customer_id: 101,
    customer_name: 'Greenleaf Pharmacy Ltd.',
    rating: 5,
    comment:
      'Consistent quality across batches. Our customers ask for it by name. Delivery is reliably on time.',
    created_at: daysAgo(20),
  },
  {
    id: 2,
    uuid: 'r-002',
    product_id: 1,
    customer_id: 102,
    customer_name: 'CityCare Pharmacy',
    rating: 4,
    comment:
      'Authentic product, well packaged. Would prefer a bulk pack option for our higher-volume branches.',
    created_at: daysAgo(35),
  },
  {
    id: 3,
    uuid: 'r-003',
    product_id: 5,
    customer_id: 105,
    customer_name: 'Healthbridge Pharmacy',
    rating: 5,
    comment: 'Lisinopril is one of our top movers. Envolve is now our default supplier for this SKU.',
    created_at: daysAgo(12),
  },
];

// ---------- Session ------------------------------------------------------

/**
 * Mocked active session — swap with real session resolution from cookie/JWT.
 * Toggle the role to preview different shells.
 */
export const MOCK_SESSION: SessionUser = {
  id: 1001,
  uuid: 'u-1001',
  role: 'customer',
  email: 'orders@greenleaf.ng',
  full_name: 'Chinedu Okafor',
  company_name: 'Greenleaf Pharmacy Ltd.',
  pcn_uploaded: true,
  pcn_verified: true,
};

/** Demo session for a customer who registered but hasn't uploaded their PCN cert yet. */
export const MOCK_SESSION_PENDING_PCN: SessionUser = {
  id: 1009,
  uuid: 'u-1009',
  role: 'customer',
  email: 'newpharm@example.ng',
  full_name: 'Tayo Adeyemi',
  company_name: 'NewPharm Stores',
  pcn_uploaded: false,
  pcn_verified: false,
};

export const MOCK_ADMIN_SESSION: SessionUser = {
  id: 1,
  uuid: 'u-admin-01',
  role: 'admin',
  email: 'admin@envolvepharm.com.ng',
  full_name: 'Adeola Bankole',
};

export const MOCK_AGENT_SESSION: SessionUser = {
  id: 11,
  uuid: 'u-agent-01',
  role: 'sales_agent',
  email: 'amaka.eze@envolvepharm.com.ng',
  full_name: 'Amaka Eze',
  permissions: ['onboard_customers', 'manage_products', 'manage_inventory', 'assign_drivers', 'view_reports'],
  permission_preset: 'senior_staff',
};

export const MOCK_DRIVER_SESSION: SessionUser = {
  id: 21,
  uuid: 'u-driver-01',
  role: 'driver',
  email: 'musa.bello@envolvepharm.com.ng',
  full_name: 'Musa Bello',
  driver_id: 1,
};
