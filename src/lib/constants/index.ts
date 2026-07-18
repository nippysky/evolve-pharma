/**
 * ENVOLVE PHARMACEUTICALS — App Constants
 *
 * Central registry for all site-wide static config: site metadata, nav,
 * status labels, formatting maps. Edit one file to retheme/rebrand.
 */

import type { OrderStatus, PaymentStatus, DeliveryStatus, Role } from '@/types';

// ---------- Site ---------------------------------------------------------

export const SITE = {
  name: 'EnvolveCare Express',
  shortName: 'ECE',
  tagline: 'Order pharmaceuticals and industrial chemicals online.',
  description:
    'The online ordering platform of EnvolveCare Express — a Nigerian distributor of pharmaceuticals, industrial chemicals, and related products. Browse the catalog and order from your verified account.',
  url: 'https://ece.envolvepharm.com.ng',
  email: 'orders@ece.envolvepharm.com.ng',
  phone: '+234 800 000 0000',
  address: 'Off Oworonshoki–Ogudu Expressway, Ogudu, Lagos, Nigeria',
  socials: {
    twitter: 'https://twitter.com/evolvecareexpress',
    linkedin: 'https://linkedin.com/company/evolvecareexpress',
    instagram: 'https://instagram.com/evolvecareexpress',
  },
} as const;

// ---------- Portal navigation (customer) --------------------------------

export const PORTAL_NAV = [
  { label: 'Catalog', href: '/portal/catalog', icon: 'Pill' as const },
  { label: 'Orders', href: '/portal/orders', icon: 'Box' as const },
  { label: 'Notifications', href: '/portal/notifications', icon: 'Bell' as const },
  { label: 'Profile', href: '/portal/profile', icon: 'User' as const },
] as const;

// ---------- Console navigation (admin + staff + driver) -----------------
//
// `roles` gates which top-level roles see the item.
// `permission` (optional) gates sales_agent items by StaffPermissionKey.
// Items with no `permission` are visible to all roles listed.

export const CONSOLE_NAV = [
  {
    section: 'Operate',
    items: [
      {
        label: 'Overview',
        href: '/console/overview',
        icon: 'Dashboard' as const,
        roles: ['admin', 'sales_agent'] as Role[],
      },
      {
        label: 'Customers',
        href: '/console/customers',
        icon: 'Building' as const,
        roles: ['admin', 'sales_agent'] as Role[],
        permission: 'onboard_customers' as const,
      },
      {
        label: 'Orders',
        href: '/console/orders',
        icon: 'Box' as const,
        roles: ['admin', 'sales_agent'] as Role[],
      },
      {
        label: 'Deliveries',
        href: '/console/deliveries',
        icon: 'Truck' as const,
        roles: ['admin', 'sales_agent'] as Role[],
        permission: 'assign_drivers' as const,
      },
    ],
  },
  {
    section: 'Catalog',
    items: [
      {
        label: 'Products',
        href: '/console/products',
        icon: 'Pill' as const,
        roles: ['admin', 'sales_agent'] as Role[],
        permission: 'manage_products' as const,
      },
      {
        label: 'Inventory',
        href: '/console/inventory',
        icon: 'Boxes' as const,
        roles: ['admin', 'sales_agent'] as Role[],
        permission: 'manage_inventory' as const,
      },
    ],
  },
  {
    section: 'Team',
    items: [
      {
        label: 'Staff',
        href: '/console/staff',
        icon: 'Users' as const,
        roles: ['admin'] as Role[],
      },
      {
        label: 'Drivers',
        href: '/console/drivers',
        icon: 'Truck' as const,
        roles: ['admin'] as Role[],
      },
      {
        label: 'Roles',
        href: '/console/roles',
        icon: 'Shield' as const,
        roles: ['admin'] as Role[],
      },
    ],
  },
  {
    section: 'Analytics',
    items: [
      {
        label: 'Reports',
        href: '/console/reports',
        icon: 'Chart' as const,
        roles: ['admin', 'sales_agent'] as Role[],
        permission: 'view_reports' as const,
      },
    ],
  },
  {
    section: 'System',
    items: [
      {
        label: 'Audit Logs',
        href: '/console/audit-logs',
        icon: 'ClipboardList' as const,
        roles: ['admin'] as Role[],
      },
      {
        label: 'Settings',
        href: '/console/settings',
        icon: 'Settings' as const,
        roles: ['admin'] as Role[],
      },
    ],
  },
] as const;

// ---------- Driver navigation (driver role only) -------------------------

export const DRIVER_NAV = [
  {
    section: 'Deliveries',
    items: [
      { label: 'My Assignments', href: '/console/driver', icon: 'Box' as const },
      { label: 'History', href: '/console/driver/history', icon: 'Truck' as const },
    ],
  },
] as const;

// ---------- Status maps --------------------------------------------------

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending:    'Pending',
  confirmed:  'Confirmed',
  processing: 'Processing',
  dispatched: 'Dispatched',
  delivered:  'Delivered',
  cancelled:  'Cancelled',
};

export const ORDER_STATUS_TONE: Record<OrderStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  pending:    'warning',
  confirmed:  'info',
  processing: 'info',
  dispatched: 'info',
  delivered:  'success',
  cancelled:  'danger',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid:   'Unpaid',
  partial:  'Partially paid',
  paid:     'Paid',
  refunded: 'Refunded',
  failed:   'Failed',
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  unpaid:   'warning',
  partial:  'warning',
  paid:     'success',
  refunded: 'neutral',
  failed:   'danger',
};

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  awaiting_dispatch: 'Awaiting dispatch',
  assigned:          'Assigned',
  in_transit:        'In transit',
  out_for_delivery:  'Out for delivery',
  delivered:         'Delivered',
  failed:            'Failed',
  returned:          'Returned',
};

export const DELIVERY_STATUS_TONE: Record<DeliveryStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand'> = {
  awaiting_dispatch: 'neutral',
  assigned:          'brand',
  in_transit:        'info',
  out_for_delivery:  'info',
  delivered:         'success',
  failed:            'danger',
  returned:          'warning',
};

// ---------- Categories --------------------------------------------------

// ---------- Nigerian States -----------------------------------------------

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti',
  'Enugu', 'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
  'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
  'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
] as const;

export type NigerianState = (typeof NIGERIAN_STATES)[number];

// ---------- Categories ---------------------------------------------------

export const PRODUCT_CATEGORIES = [
  'Antibiotics',
  'Analgesics',
  'Antimalarials',
  'Vitamins & Supplements',
  'Cardiovascular',
  'Antidiabetics',
  'Respiratory',
  'Gastrointestinal',
  'Dermatologicals',
  'Antifungals',
  'Hormonal',
  'Ophthalmics',
  'Industrial Chemicals',
] as const;

export const PRODUCT_FORMS = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Suspension',
  'Injection',
  'Cream',
  'Ointment',
  'Drops',
  'Inhaler',
  'Patch',
] as const;

// ---------- Thresholds --------------------------------------------------

export const LOW_STOCK_THRESHOLD = 50;
export const EXPIRY_WARNING_DAYS = 90;
