'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loginStaff,
  registerStaff,
  bulkUploadStaff,
  listVerifiedStaff,
  listUnverifiedStaff,
  listDrivers,
} from '@/lib/api/services/staff.service';
import {
  listCustomersByStage,
  listAllCustomers,
  reviewCustomer,
  bulkUploadCustomers,
  createCustomer,
  type CreateCustomerInput,
  type CreateCustomerResult,
} from '@/lib/api/services/customers.service';
import type { LoginStaffPayload, RegisterStaffPayload, CustomerAdminRecord, StaffRecord, DriverRecord } from '@/lib/api/types';

export const STAFF_KEYS = {
  verified:   ['staff', 'verified']   as const,
  unverified: ['staff', 'unverified'] as const,
} as const;

export const DRIVER_KEYS = {
  all: ['drivers'] as const,
} as const;

export const CUSTOMER_ADMIN_KEYS = {
  list: (stage: string) => ['customers-admin', stage] as const,
} as const;

/**
 * Mutation for staff sign-in.
 * On success, response contains `role: "ADMIN" | "STAFF" | "DRIVER"`.
 * Caller is responsible for mapping the role and setting the session cookie.
 */
export function useLoginStaff() {
  return useMutation({
    mutationFn: (payload: LoginStaffPayload) => loginStaff(payload),
  });
}

export function useRegisterStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterStaffPayload) => registerStaff(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_KEYS.unverified });
      void queryClient.invalidateQueries({ queryKey: STAFF_KEYS.verified });
    },
  });
}

export function useBulkUploadStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => bulkUploadStaff(file),
    onSuccess: () => {
      // Bulk-invited staff start UNVERIFIED — invalidate both lists
      // so the table refreshes immediately without a hard reload.
      void queryClient.invalidateQueries({ queryKey: STAFF_KEYS.unverified });
      void queryClient.invalidateQueries({ queryKey: STAFF_KEYS.verified });
    },
  });
}

export type StaffStatus = 'VERIFIED' | 'UNVERIFIED' | 'DISABLED';

export interface TaggedStaffRecord extends StaffRecord {
  _status: StaffStatus;
}

function deriveStaffStatus(r: StaffRecord, verificationStatus: 'VERIFIED' | 'UNVERIFIED'): StaffStatus {
  if (r.status === 'INACTIVE' || r.status === 'SUSPENDED') return 'DISABLED';
  return verificationStatus;
}

export function useVerifiedStaff() {
  return useQuery({
    queryKey: STAFF_KEYS.verified,
    queryFn: listVerifiedStaff,
    staleTime: 20 * 1000,
  });
}

export function useUnverifiedStaff() {
  return useQuery({
    queryKey: STAFF_KEYS.unverified,
    queryFn: listUnverifiedStaff,
    staleTime: 20 * 1000,
  });
}

/**
 * Fetches both staff lists in parallel and merges them into a single
 * flat list tagged with `_status`. Enables one unified table with
 * client-side filtering — no network round-trip when switching views.
 */
export function useAllStaff() {
  const verifiedQ   = useVerifiedStaff();
  const unverifiedQ = useUnverifiedStaff();

  const isLoading = (verifiedQ.isLoading && !verifiedQ.data) || (unverifiedQ.isLoading && !unverifiedQ.data);
  const errors    = [verifiedQ.error, unverifiedQ.error].filter((e: unknown): e is Error => e instanceof Error);

  const allRecords: TaggedStaffRecord[] = [
    ...(verifiedQ.data?.records   ?? []).map((r: StaffRecord) => ({ ...r, _status: deriveStaffStatus(r, 'VERIFIED') })),
    ...(unverifiedQ.data?.records ?? []).map((r: StaffRecord) => ({ ...r, _status: deriveStaffStatus(r, 'UNVERIFIED') })),
  ];

  const counts: Record<StaffStatus, number> = {
    VERIFIED:   allRecords.filter(r => r._status === 'VERIFIED').length,
    UNVERIFIED: allRecords.filter(r => r._status === 'UNVERIFIED').length,
    DISABLED:   allRecords.filter(r => r._status === 'DISABLED').length,
  };

  const refetchAll = () => {
    void verifiedQ.refetch();
    void unverifiedQ.refetch();
  };

  return { allRecords, counts, isLoading, errors, refetchAll };
}

export function useToggleStaffStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'ACTIVE' | 'INACTIVE' }) =>
      fetch(`/api/staff/${id}`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ status }),
      }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message ?? 'Failed to update status');
        return json;
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_KEYS.verified });
      void queryClient.invalidateQueries({ queryKey: STAFF_KEYS.unverified });
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/staff/${id}`, { method: 'DELETE', credentials: 'include' }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message ?? 'Failed to delete staff member');
        return json;
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STAFF_KEYS.verified });
      void queryClient.invalidateQueries({ queryKey: STAFF_KEYS.unverified });
    },
  });
}

export function useToggleDriverStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'ACTIVE' | 'INACTIVE' }) =>
      fetch(`/api/staff/${id}`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ status }),
      }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message ?? 'Failed to update status');
        return json;
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DRIVER_KEYS.all });
    },
  });
}

export function useDeleteDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/staff/${id}`, { method: 'DELETE', credentials: 'include' }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message ?? 'Failed to delete driver');
        return json;
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DRIVER_KEYS.all });
    },
  });
}

export { type DriverRecord };

export function useDrivers() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: DRIVER_KEYS.all,
    queryFn:  listDrivers,
    staleTime: 20 * 1000,
  });
  const refetch = () => void query.refetch();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: DRIVER_KEYS.all });
  return { ...query, refetch, invalidate };
}

export type CustomerStage = 'pending' | 'registered' | 'unverified' | 'verified' | 'approved' | 'rejected';

/** A customer record tagged with which lifecycle stage endpoint it came from. */
export interface TaggedCustomerRecord extends CustomerAdminRecord {
  _stage: CustomerStage;
}

/** All 6 stages in lifecycle order. */
export const ALL_CUSTOMER_STAGES: CustomerStage[] = [
  'registered', 'unverified', 'verified', 'pending', 'approved', 'rejected',
];

export function useCustomerAdminList(stage: CustomerStage) {
  return useQuery({
    queryKey: CUSTOMER_ADMIN_KEYS.list(stage),
    queryFn: () => listCustomersByStage(stage),
    staleTime: 60 * 1000, // 1 min — admin lists change frequently
  });
}

// Status → stage mapping (mirrors STAGE_TO_STATUS in customers.service.ts)
const STATUS_TO_STAGE: Record<string, CustomerStage> = {
  REGISTERED:        'registered',
  OTP_CONFIRMED:     'unverified',
  PCN_CERT_UPLOADED: 'verified',
  PENDING_REVIEW:    'pending',
  APPROVED:          'approved',
  REJECTED:          'rejected',
};

/**
 * Fetches ALL customers in ONE request and splits them by stage client-side.
 *
 * Replaces the previous 6-parallel-query approach which exhausted the
 * Sequential queries to stay within the DB connection limit.
 * One request = one connection = no pool starvation for other endpoints.
 */
export function useAllCustomers() {
  const result = useQuery({
    queryKey: ['customers-admin', 'all'],
    queryFn:  listAllCustomers,
    staleTime: 60_000,
  });

  const isLoading  = result.isLoading && !result.data;
  const isFetching = result.isFetching;
  const errors     = result.error ? [result.error as Error] : [];

  // Tag each record with its stage derived from status
  const allRecords: TaggedCustomerRecord[] = (result.data?.records ?? []).map(
    (rec: CustomerAdminRecord) => ({
      ...rec,
      _stage: (STATUS_TO_STAGE[rec.status] ?? 'registered') as CustomerStage,
    }),
  );

  const counts = ALL_CUSTOMER_STAGES.reduce<Record<CustomerStage, number>>(
    (acc, stage) => {
      acc[stage] = allRecords.filter((r) => r._stage === stage).length;
      return acc;
    },
    {} as Record<CustomerStage, number>,
  );

  const refetchAll = () => { void result.refetch(); };

  return { allRecords, counts, isLoading, isFetching, errors, refetchAll };
}

export function useReviewCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      review_notes,
    }: {
      id: number;
      decision: 'APPROVE' | 'REJECTED';
      review_notes: string;
    }) => reviewCustomer(id, decision === 'APPROVE' ? 'approve' : 'reject', review_notes),
    onSuccess: () => {
      // Invalidate all customer tabs so counts + lists stay in sync
      queryClient.invalidateQueries({ queryKey: ['customers-admin'] });
    },
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation<CreateCustomerResult, Error, CreateCustomerInput>({
    mutationFn: (input) => createCustomer(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers-admin'] });
    },
  });
}

export function useBulkUploadCustomers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => bulkUploadCustomers(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers-admin'] });
    },
  });
}
