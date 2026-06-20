/**
 * ENVOLVE PHARMACEUTICALS — Staff & Console TanStack Query Hooks
 *
 * Mutations for staff login / register / bulk-upload and
 * queries for listing staff and customers by lifecycle stage.
 *
 * Components import these hooks — never import services directly.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import type { LoginStaffPayload, RegisterStaffPayload } from '@/lib/api/types';

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

// ---------- Customer admin lists -------------------------------------------

type CustomerStage = 'registered' | 'unverified' | 'verified' | 'pending';

export function useCustomerAdminList(stage: CustomerStage) {
  return useQuery({
    queryKey: CUSTOMER_ADMIN_KEYS.list(stage),
    queryFn: () => listCustomersByStage(stage),
    staleTime: 60 * 1000, // 1 min — admin lists change frequently
  });
}

// ---------- Review customer ------------------------------------------------

export function useReviewCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      review_notes,
    }: {
      id: number | string;
      action: 'approve' | 'reject';
      review_notes?: string;
    }) => reviewCustomer(id, action, review_notes),
    onSuccess: () => {
      // After review, pending list shrinks; refresh all customer lists
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
