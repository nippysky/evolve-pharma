/**
 * ENVOLVE PHARMACEUTICALS — Staff Mock Data
 *
 * "Staff" = users with role='sales_agent'. Each has a permission preset
 * that determines what they can do in the console. Admin can change the
 * preset (and thus permissions) at any time — one dropdown, instant effect.
 *
 * Swap STAFF_MEMBERS for a real API call when the backend is ready.
 * The StaffMember interface is stable — backend should return this shape.
 */

import type { User, StaffPermissionKey, StaffPermissionPreset } from '@/types';
import { STAFF_PRESET_PERMISSIONS } from '@/types';

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

// Convenience type — adds staff-specific profile fields on top of User.
export interface StaffMember extends User {
  role: 'sales_agent';
  permission_preset: StaffPermissionPreset;
  permissions: StaffPermissionKey[];
  region?: string;
  customers_onboarded?: number;
}

function buildStaff(
  base: Omit<StaffMember, 'role' | 'permissions'> & { permission_preset: StaffPermissionPreset },
): StaffMember {
  return {
    ...base,
    role: 'sales_agent',
    permissions: STAFF_PRESET_PERMISSIONS[base.permission_preset],
  };
}

export const STAFF_MEMBERS: StaffMember[] = [
  buildStaff({
    id: 11,
    uuid: 'u-agent-01',
    email: 'amaka.eze@envolvepharm.com.ng',
    fname: 'Amaka',
    lname: 'Eze',
    phone: '+234 803 456 7890',
    is_verified: true,
    status: 'active',
    created_at: daysAgo(220),
    updated_at: daysAgo(2),
    permission_preset: 'senior_staff',
    region: 'Abuja FCT',
    customers_onboarded: 2,
  }),
  buildStaff({
    id: 12,
    uuid: 'u-agent-02',
    email: 'tobi.adeyemi@envolvepharm.com.ng',
    fname: 'Tobi',
    lname: 'Adeyemi',
    phone: '+234 802 998 1010',
    is_verified: true,
    status: 'active',
    created_at: daysAgo(160),
    updated_at: daysAgo(5),
    permission_preset: 'sales_rep',
    region: 'Lagos Island',
    customers_onboarded: 1,
  }),
  buildStaff({
    id: 13,
    uuid: 'u-agent-03',
    email: 'fatima.bello@envolvepharm.com.ng',
    fname: 'Fatima',
    lname: 'Bello',
    phone: '+234 805 234 1122',
    is_verified: true,
    status: 'active',
    created_at: daysAgo(95),
    updated_at: daysAgo(1),
    permission_preset: 'operations_lead',
    region: 'Lagos Mainland',
    customers_onboarded: 1,
  }),
  buildStaff({
    id: 14,
    uuid: 'u-agent-04',
    email: 'chidi.okonkwo@envolvepharm.com.ng',
    fname: 'Chidi',
    lname: 'Okonkwo',
    phone: '+234 807 561 3394',
    is_verified: true,
    status: 'active',
    created_at: daysAgo(45),
    updated_at: daysAgo(0),
    permission_preset: 'product_manager',
    region: 'Abuja FCT',
    customers_onboarded: 0,
  }),
  buildStaff({
    id: 15,
    uuid: 'u-agent-05',
    email: 'ngozi.ibe@envolvepharm.com.ng',
    fname: 'Ngozi',
    lname: 'Ibe',
    phone: '+234 801 334 9920',
    is_verified: false,
    status: 'pending',
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
    permission_preset: 'sales_rep',
    region: 'Port Harcourt',
    customers_onboarded: 0,
  }),
];

// Keep AGENTS as an alias for backward compat (operational.ts uses it)
export const AGENTS = STAFF_MEMBERS;

// Admin users (internal back-office — not the same as "staff" in the
// new taxonomy, but kept here so the old /console/staff page still works
// until fully migrated)
export const DEPARTMENTS = [
  'Operations',
  'Procurement',
  'Logistics',
  'Finance',
  'Compliance',
  'Customer Success',
] as const;
