/**
 * ENVOLVE PHARMACEUTICALS — Staff & Console TanStack Query Hooks
 *
 * Mutations for staff login / register / bulk-upload and
 * queries for listing staff and customers by lifecycle stage.
 *
 * Components import these hooks — never import services directly.
 */

'use client';

import { useMutation, useQuery, useQueryClient, useQueries } from '@tanstack/react-query';
import {
  loginStaff,
  registerStaff,
  bulkUploadStaff,
  listVerifiedStaff,
  listUnverifiedStaff,
} from '@/lib/api/services/staff.service';
import {
  listCustomersByStage,
  reviewCustomer,
  bulkUploadCustomers,
} from '@/lib/api/services/console.service';
import type { LoginStaffPayload, RegisterStaffPayload, CustomerAdminRecord, StaffRecord } from '@/lib/api/types';

// ---------- Query keys -----------------------------------------------------

export const STAFF_KEYS = {
  verified:   ['staff', 'verified']   as const,
  unverified: ['staff', 'unverified'] as const,
} as const;

export const CUSTOMER_ADMIN_KEYS = {
  list: (stage: string) => ['customers-admin', stage] as const,
} as const;

// ---------- Staff login ----------------------------------------------------

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

// ---------- Staff register -------------------------------------------------

export function useRegisterStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterStaffPayload) => registerStaff(payload),
    onSuccess: () => {
      // New staff starts UNVERIFIED — refresh that list
      queryClient.invalidateQueries({ queryKey: STAFF_KEYS.unverified });
    },
  });
}

// ---------- Staff bulk upload ----------------------------------------------

export function useBulkUploadStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => bulkUploadStaff(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAFF_KEYS.unverified });
    },
  });
}

// ---------- Staff types for unified view -----------------------------------

export type StaffStatus = 'VERIFIED' | 'UNVERIFIED';

export interface TaggedStaffRecord extends StaffRecord {
  _status: StaffStatus;
}

// ---------- Staff lists ----------------------------------------------------

export function useVerifiedStaff() {
  return useQuery({
    queryKey: STAFF_KEYS.verified,
    queryFn: listVerifiedStaff,
    staleTime: 2 * 60 * 1000,
  });
}

export function useUnverifiedStaff() {
  return useQuery({
    queryKey: STAFF_KEYS.unverified,
    queryFn: listUnverifiedStaff,
    staleTime: 2 * 60 * 1000,
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
  const errors    = [verifiedQ.error, unverifiedQ.error].filter((e): e is Error => e != null);

  const allRecords: TaggedStaffRecord[] = [
    ...(verifiedQ.data?.records   ?? []).map((r) => ({ ...r, _status: 'VERIFIED'   as const })),
    ...(unverifiedQ.data?.records ?? []).map((r) => ({ ...r, _status: 'UNVERIFIED' as const })),
  ];

  const counts: Record<StaffStatus, number> = {
    VERIFIED:   verifiedQ.data?.records?.length   ?? 0,
    UNVERIFIED: unverifiedQ.data?.records?.length ?? 0,
  };

  const refetchAll = () => {
    void verifiedQ.refetch();
    void unverifiedQ.refetch();
  };

  return { allRecords, counts, isLoading, errors, refetchAll };
}

// ---------- Customer admin lists -------------------------------------------

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

/**
 * Fetches ALL 6 stage endpoints in parallel and merges them into a single
 * flat list. Each record is tagged with `_stage` so the UI can filter
 * client-side without additional network round-trips.
 */
export function useAllCustomers() {
  const results = useQueries({
    queries: ALL_CUSTOMER_STAGES.map((stage) => ({
      queryKey: CUSTOMER_ADMIN_KEYS.list(stage),
      queryFn: (): ReturnType<typeof listCustomersByStage> => listCustomersByStage(stage),
      staleTime: 60_000,
    })),
  });

  // Loading = at least one stage has no data yet
  const isLoading = results.some((r) => r.isLoading && !r.data);
  const isFetching = results.some((r) => r.isFetching);
  const errors     = results.map((r) => r.error).filter((e): e is Error => e != null);

  const allRecords: TaggedCustomerRecord[] = ALL_CUSTOMER_STAGES.flatMap((stage, i) =>
    (results[i]?.data?.records ?? []).map((rec) => ({ ...rec, _stage: stage })),
  );

  const counts = ALL_CUSTOMER_STAGES.reduce<Record<CustomerStage, number>>(
    (acc, stage, i) => {
      acc[stage] = results[i]?.data?.records?.length ?? 0;
      return acc;
    },
    {} as Record<CustomerStage, number>,
  );

  const refetchAll = () => { results.forEach((r) => void r.refetch()); };

  return { allRecords, counts, isLoading, isFetching, errors, refetchAll };
}

// ---------- Review customer ------------------------------------------------

export function useReviewCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      review_notes,
    }: {
      id: number | string;
      decision: 'APPROVE' | 'REJECTED';
      review_notes: string;
    }) => reviewCustomer(id, decision, review_notes),
    onSuccess: () => {
      // Invalidate all customer tabs so counts + lists stay in sync
      queryClient.invalidateQueries({ queryKey: ['customers-admin'] });
    },
  });
}

// ---------- Bulk upload customers ------------------------------------------

export function useBulkUploadCustomers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => bulkUploadCustomers(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers-admin'] });
    },
  });
}
