/**
 * ENVOLVE PHARMACEUTICALS — Driver Mock Data
 *
 * Drivers are Users with role='driver'. Each has a Driver profile linking
 * to their vehicle info, region, and status. Swap the exported constants
 * for API fetch calls when the backend is ready.
 */

import type { Driver, User } from '@/types';

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

// Driver user accounts (role = 'driver')
export const DRIVER_USERS: User[] = [
  {
    id: 21,
    uuid: 'u-driver-01',
    role: 'driver',
    email: 'musa.bello@envolvepharm.com.ng',
    fname: 'Musa',
    lname: 'Bello',
    phone: '+234 803 222 1148',
    is_verified: true,
    status: 'active',
    created_at: daysAgo(180),
    updated_at: daysAgo(1),
  },
  {
    id: 22,
    uuid: 'u-driver-02',
    role: 'driver',
    email: 'emeka.osei@envolvepharm.com.ng',
    fname: 'Emeka',
    lname: 'Osei',
    phone: '+234 806 344 2290',
    is_verified: true,
    status: 'active',
    created_at: daysAgo(120),
    updated_at: daysAgo(0),
  },
  {
    id: 23,
    uuid: 'u-driver-03',
    role: 'driver',
    email: 'kola.adesanya@envolvepharm.com.ng',
    fname: 'Kola',
    lname: 'Adesanya',
    phone: '+234 809 112 5560',
    is_verified: true,
    status: 'active',
    created_at: daysAgo(90),
    updated_at: daysAgo(2),
  },
  {
    id: 24,
    uuid: 'u-driver-04',
    role: 'driver',
    email: 'tunde.lawson@envolvepharm.com.ng',
    fname: 'Tunde',
    lname: 'Lawson',
    phone: '+234 802 778 3340',
    is_verified: false,
    status: 'pending',
    created_at: daysAgo(5),
    updated_at: daysAgo(5),
  },
];

export const DRIVERS: Driver[] = [
  {
    id: 1,
    uuid: 'drv-001',
    user_id: 21,
    vehicle_plate: 'ABJ-148-XK',
    vehicle_type: 'Van',
    region: 'Abuja FCT',
    driver_status: 'on_delivery',
    total_deliveries: 87,
    rating: 4.8,
    user: DRIVER_USERS[0]!,
    created_at: daysAgo(180),
    updated_at: daysAgo(1),
  },
  {
    id: 2,
    uuid: 'drv-002',
    user_id: 22,
    vehicle_plate: 'LAS-320-KA',
    vehicle_type: 'Motorcycle',
    region: 'Lagos Island',
    driver_status: 'available',
    total_deliveries: 142,
    rating: 4.9,
    user: DRIVER_USERS[1]!,
    created_at: daysAgo(120),
    updated_at: daysAgo(0),
  },
  {
    id: 3,
    uuid: 'drv-003',
    user_id: 23,
    vehicle_plate: 'LAS-554-QB',
    vehicle_type: 'Van',
    region: 'Lagos Mainland',
    driver_status: 'available',
    total_deliveries: 56,
    rating: 4.6,
    user: DRIVER_USERS[2]!,
    created_at: daysAgo(90),
    updated_at: daysAgo(2),
  },
  {
    id: 4,
    uuid: 'drv-004',
    user_id: 24,
    vehicle_plate: 'EKY-201-FG',
    vehicle_type: 'Motorcycle',
    region: 'Ekiti',
    driver_status: 'off_duty',
    total_deliveries: 0,
    rating: null,
    user: DRIVER_USERS[3]!,
    created_at: daysAgo(5),
    updated_at: daysAgo(5),
  },
];

export const DRIVER_STATUS_LABEL: Record<Driver['driver_status'], string> = {
  available:    'Available',
  on_delivery:  'On delivery',
  off_duty:     'Off duty',
  suspended:    'Suspended',
};

export const DRIVER_STATUS_TONE: Record<Driver['driver_status'], string> = {
  available:    'success',
  on_delivery:  'info',
  off_duty:     'neutral',
  suspended:    'danger',
};
