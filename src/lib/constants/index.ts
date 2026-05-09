/**
 * ENVOLVE PHARMACEUTICALS — App Constants
 *
 * Central registry for all site-wide static config: site metadata, nav,
 * status labels, formatting maps. Edit one file to retheme/rebrand.
 */

import type { OrderStatus, PaymentStatus, DeliveryStatus, Role } from '@/types';

// ---------- Site ---------------------------------------------------------

export const SITE = {
  name: 'Envolve Pharmaceuticals',
  shortName: 'Envolve',
  tagline: 'Order pharmaceuticals and industrial chemicals online.',
  description:
    'The online ordering platform of Envolve Pharmaceuticals — a Nigerian distributor of pharmaceuticals, industrial chemicals, and related products. Browse the catalog and order from your verified account.',
  url: 'https://envolvepharm.com.ng',
  email: 'orders@envolvepharm.com.ng',
  phone: '+234 800 000 0000',
  address: 'Off Oworonshoki–Ogudu Expressway, Ogudu, Lagos, Nigeria',
  socials: {
    twitter: 'https://twitter.com/envolvepharm',
    linkedin: 'https://linkedin.com/company/envolvepharm',
    instagram: 'https://instagram.com/envolvepharm',
  },
} as const;

// ---------- Portal navigation (customer) --------------------------------

export const PORTAL_NAV = [
  { label: 'Catalog', href: '/portal/catalog', icon: 'Pill' as const },
  { label: 'Orders', href: '/portal/orders', icon: 'Box' as const },
  { label: 'Notifications', href: '/portal/notifications', icon: 'Bell' as const },
  { label: 'Profile', href: '/portal/profile', icon: 'User' as const },
] as const;

// ---------- Console navigation (admin + sales agent) --------------------
// Items are gated by `roles` — RBAC at the navigation layer.

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
        roles: ['admin'] as Role[],
      },
      {
        label: 'Inventory',
        href: '/console/inventory',
        icon: 'Boxes' as const,
        roles: ['admin'] as Role[],
      },
    ],
  },
  {
    section: 'Team',
    items: [
      {
        label: 'Sales Agents',
        href: '/console/agents',
        icon: 'Users' as const,
        roles: ['admin'] as Role[],
      },
      {
        label: 'Reports',
        href: '/console/reports',
        icon: 'Chart' as const,
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

// ---------- Status maps --------------------------------------------------

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_TONE: Record<OrderStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  confirmed: 'info',
  processing: 'info',
  dispatched: 'info',
  delivered: 'success',
  cancelled: 'danger',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partially paid',
  paid: 'Paid',
  refunded: 'Refunded',
  failed: 'Failed',
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  unpaid: 'warning',
  partial: 'warning',
  paid: 'success',
  refunded: 'neutral',
  failed: 'danger',
};

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  awaiting_dispatch: 'Awaiting dispatch',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  failed: 'Failed',
  returned: 'Returned',
};

// ---------- Categories --------------------------------------------------

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