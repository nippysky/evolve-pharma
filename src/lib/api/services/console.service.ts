/**
 * Console service — stubs.
 * Real implementations use Next.js API routes + Prisma 7.
 * These stubs satisfy TypeScript until Module 6 rewrites this layer.
 */

import type { CustomerAdminRecord } from '@/lib/api/types';

interface ListResponse<T> { records: T[]; total: number }

type CustomerStage = 'pending' | 'registered' | 'unverified' | 'verified' | 'approved' | 'rejected';

/** @stub — Module 6 */
export async function listCustomersByStage(
  _stage: CustomerStage,
): Promise<ListResponse<CustomerAdminRecord>> {
  return { records: [], total: 0 };
}

/** @stub — Module 6 */
export async function reviewCustomer(
  _id: number,
  _action: 'approve' | 'reject',
  _note?: string,
): Promise<CustomerAdminRecord> {
  throw new Error('Not implemented');
}

/** @stub — Module 6 */
export async function bulkUploadCustomers(
  _file: File,
): Promise<{
  total_records: number;
  successful: number;
  failed: number;
  failed_records?: Array<{ row: number; email?: string; reason?: string }>;
}> {
  throw new Error('Not implemented');
}
