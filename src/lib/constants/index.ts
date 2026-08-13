import type { OrderStatus, Role } from '@/types';

/**
 * Company details.
 *
 * Sourced from the corporate site (envolvepharm.com.ng) rather than invented.
 * Anything customer-facing — invoices, receipts, contact links — must read from
 * here so there is a single place to correct it.
 */
export const SITE = {
  name: 'EnvolveCare Express',
  /** Registered entity, used on invoices and other formal documents. */
  legalName: 'Envolve Pharmaceuticals Limited',
  shortName: 'ECE',
  tagline: 'Order pharmaceuticals and industrial chemicals online.',
  description:
    'The online ordering platform of Envolve Pharmaceuticals Limited — a Nigerian distributor of ' +
    'pharmaceuticals, industrial chemicals, and related products. Browse the catalogue and order ' +
    'from your verified account.',
  url: 'https://ece.envolvepharm.com.ng',
  /** Verified on the corporate site's contact page. */
  email: 'info@envolvepharm.com.ng',
  phone: '+234 805 513 6726',
  /** Tel: href form — no spaces. */
  phoneHref: '+2348055136726',
  address: '7, Celestial Way by Oworonshoki – Ogudu, Ogudu, Lagos, Nigeria',
  // The corporate site lists social icons but none of them point anywhere yet,
  // so there are no real handles to link to. Left empty deliberately rather
  // than guessed — a dead social link is worse than none.
  socials: {},
} as const;

export const PORTAL_NAV = [
  { label: 'Catalog',       href: '/portal/catalog',       icon: 'Pill'  as const },
  { label: 'My Orders',     href: '/portal/orders',        icon: 'Box'   as const },
  { label: 'Track Order',   href: '/portal/track',         icon: 'Truck' as const },
  { label: 'Notifications', href: '/portal/notifications', icon: 'Bell'  as const },
  { label: 'Referrals',     href: '/portal/referral',      icon: 'Star'  as const },
  { label: 'Profile',       href: '/portal/profile',       icon: 'User'  as const },
] as const;
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
        href: '/admin/overview',
        icon: 'Dashboard' as const,
        roles: ['ADMIN', 'STAFF'] as Role[],
      },
      {
        label: 'Customers',
        href: '/admin/customers',
        icon: 'Building' as const,
        roles: ['ADMIN', 'STAFF'] as Role[],
        permission: 'onboard_customers' as const,
      },
      {
        label: 'Orders',
        href: '/admin/orders',
        icon: 'Box' as const,
        roles: ['ADMIN', 'STAFF'] as Role[],
      },
      {
        label: 'Deliveries',
        href: '/admin/deliveries',
        icon: 'Truck' as const,
        roles: ['ADMIN', 'STAFF'] as Role[],
        permission: 'assign_drivers' as const,
      },
    ],
  },
  {
    section: 'Catalog',
    items: [
      {
        label: 'Products',
        href: '/admin/products',
        icon: 'Pill' as const,
        roles: ['ADMIN', 'STAFF'] as Role[],
        permission: 'manage_products' as const,
      },
      {
        label: 'Categories',
        href: '/admin/categories',
        icon: 'Tag' as const,
        roles: ['ADMIN', 'STAFF'] as Role[],
      },
      {
        label: 'Manufacturers',
        href: '/admin/manufacturers',
        icon: 'Building' as const,
        roles: ['ADMIN', 'STAFF'] as Role[],
      },
      {
        label: 'Inventory',
        href: '/admin/inventory',
        icon: 'Boxes' as const,
        roles: ['ADMIN', 'STAFF'] as Role[],
        permission: 'manage_inventory' as const,
      },
    ],
  },
  {
    section: 'Team',
    items: [
      {
        label: 'Staff',
        href: '/admin/staff',
        icon: 'Users' as const,
        roles: ['ADMIN'] as Role[],
      },
      {
        label: 'Drivers',
        href: '/admin/drivers',
        icon: 'Truck' as const,
        roles: ['ADMIN'] as Role[],
      },
      {
        label: 'Roles',
        href: '/admin/roles',
        icon: 'Shield' as const,
        roles: ['ADMIN'] as Role[],
      },
    ],
  },
  {
    section: 'Analytics',
    items: [
      {
        label: 'Reports',
        href: '/admin/reports',
        icon: 'Chart' as const,
        roles: ['ADMIN', 'STAFF'] as Role[],
        permission: 'view_reports' as const,
      },
    ],
  },
  {
    section: 'System',
    items: [
      {
        label: 'Audit Logs',
        href: '/admin/audit-logs',
        icon: 'ClipboardList' as const,
        roles: ['ADMIN'] as Role[],
      },
      {
        label: 'Login Activity',
        href: '/admin/login-activity',
        icon: 'Shield' as const,
        roles: ['ADMIN'] as Role[],
      },
      {
        label: 'Settings',
        href: '/admin/settings',
        icon: 'Settings' as const,
        roles: ['ADMIN'] as Role[],
      },
    ],
  },
] as const;

export const DRIVER_NAV = [
  {
    section: 'Deliveries',
    items: [
      { label: 'My Assignments', href: '/driver', icon: 'Box' as const },
      { label: 'History', href: '/driver/history', icon: 'Truck' as const },
    ],
  },
] as const;

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

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti',
  'Enugu', 'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
  'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
  'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
] as const;

export type NigerianState = (typeof NIGERIAN_STATES)[number];

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

/** Fallback `referred_by` value stored when no referral code is entered at signup.
 *  No points are awarded for this code — it's just a sentinel for analytics. */
export const DEFAULT_REFERRAL_CODE = 'ENV-PLATFORM';

/**
 * The signup award moved into admin settings as `referral_signup_bonus`, in
 * naira, so the business can change it without a deploy. Read it through
 * `getReferralSettings()` — there is no longer a hardcoded value, and the
 * old dimensionless "points" unit no longer exists.
 */
