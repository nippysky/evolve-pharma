/**
 * Staff service — stubs.
 * Real implementations use Next.js API routes + Prisma 7.
 * These stubs satisfy TypeScript until Module 6 rewrites this layer.
 */

import type {
  LoginStaffPayload,
  RegisterStaffPayload,
  StaffRecord,
  StaffBulkUploadResult,
} from '@/lib/api/types';

interface ListResponse<T> { records: T[]; total: number }

/** @stub — Module 6 */
export async function loginStaff(_payload: LoginStaffPayload): Promise<{ status: string; role: string; email: string; token?: string }> {
  throw new Error('Not implemented — use /api/auth/staff/login directly');
}

/** @stub — Module 6 */
export async function registerStaff(_payload: RegisterStaffPayload): Promise<StaffRecord> {
  throw new Error('Not implemented');
}

/** @stub — Module 6 */
export async function bulkUploadStaff(_file: File): Promise<StaffBulkUploadResult> {
  throw new Error('Not implemented');
}

/** @stub — Module 6 */
export async function listVerifiedStaff(): Promise<ListResponse<StaffRecord>> {
  return { records: [], total: 0 };
}

/** @stub — Module 6 */
export async function listUnverifiedStaff(): Promise<ListResponse<StaffRecord>> {
  return { records: [], total: 0 };
}
