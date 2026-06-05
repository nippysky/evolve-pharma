/**
 * ENVOLVE PHARMACEUTICALS — Internal staff (mock).
 * Staff are admin-role employees with a department + job title. Kept in
 * its own module so swapping to a live API touches one file.
 */

import type { User } from '@/types';

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

export interface StaffMember extends User {
  department: string;
  job_title: string;
}

export const DEPARTMENTS = [
  'Operations',
  'Procurement',
  'Logistics',
  'Finance',
  'Compliance',
  'Customer Success',
] as const;

export const STAFF: StaffMember[] = [
  {
    id: 1,
    uuid: 'u-admin-01',
    role: 'admin',
    email: 'adeola.bankole@envolvepharm.com.ng',
    fname: 'Adeola',
    lname: 'Bankole',
    phone: '+234 803 000 1100',
    is_verified: true,
    status: 'active',
    created_at: daysAgo(400),
    updated_at: daysAgo(1),
    department: 'Operations',
    job_title: 'Head of Operations',
  },
  {
    id: 2,
    uuid: 'u-admin-02',
    role: 'admin',
    email: 'ngozi.umeh@envolvepharm.com.ng',
    fname: 'Ngozi',
    lname: 'Umeh',
    phone: '+234 802 000 2200',
    is_verified: true,
    status: 'active',
    created_at: daysAgo(300),
    updated_at: daysAgo(3),
    department: 'Procurement',
    job_title: 'Procurement Lead',
  },
  {
    id: 3,
    uuid: 'u-admin-03',
    role: 'admin',
    email: 'segun.balogun@envolvepharm.com.ng',
    fname: 'Segun',
    lname: 'Balogun',
    phone: '+234 805 000 3300',
    is_verified: true,
    status: 'active',
    created_at: daysAgo(120),
    updated_at: daysAgo(2),
    department: 'Logistics',
    job_title: 'Logistics Coordinator',
  },
];