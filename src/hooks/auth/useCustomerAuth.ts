/**
 * ENVOLVE PHARMACEUTICALS — Customer Auth Hooks
 *
 * TanStack Query mutations and queries for the customer auth flow.
 * Components import these hooks — they never import the service directly.
 *
 * Error shape:
 *   error.message           — human-readable message
 *   error.fieldErrors       — Laravel validation errors (Record<string, string[]>)
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  registerCustomer,
  loginCustomer,
  verifyOtp,
  createPassword,
  uploadPcnCert,
  getMe,
  logoutUser,
  resendOtp,
} from '@/lib/api/services/auth.service';
import type {
  RegisterCustomerPayload,
  LoginCustomerPayload,
  VerifyOtpPayload,
  CreatePasswordPayload,
} from '@/lib/api/types';

// ---------- Query keys (centralised so cache invalidations are consistent) --

export const AUTH_KEYS = {
  me: ['auth', 'me'] as const,
} as const;

// ---------- useMe -----------------------------------------------------------

/**
 * Returns the currently authenticated user from the session cookie.
 * Used to gate routes and personalise the UI.
 * Enabled only in the browser to avoid SSR/server-action conflicts.
 */
export function useMe() {
  return useQuery({
    queryKey: AUTH_KEYS.me,
    queryFn: getMe,
    retry: false,
    staleTime: 5 * 60 * 1000,      // 5 min — user profile rarely changes
    refetchOnMount: true,
    refetchOnWindowFocus: false,    // avoid noisy re-fetches
    enabled: typeof window !== 'undefined',
  });
}

// ---------- useRegisterCustomer ---------------------------------------------

export function useRegisterCustomer() {
  return useMutation({
    mutationFn: (payload: RegisterCustomerPayload) => registerCustomer(payload),
    // onSuccess / onError handled by the calling component
  });
}

// ---------- useLoginCustomer ------------------------------------------------

export function useLoginCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoginCustomerPayload) => loginCustomer(payload),
    onSuccess: (data: Awaited<ReturnType<typeof loginCustomer>>) => {
      // Pre-populate the me cache so the first portal load is instant
      // Login response wraps the user under `data.customer`
      queryClient.setQueryData(AUTH_KEYS.me, data.customer);
    },
  });
}

// ---------- useVerifyOtp ----------------------------------------------------

export function useVerifyOtp() {
  return useMutation({
    mutationFn: (payload: VerifyOtpPayload) => verifyOtp(payload),
  });
}

// ---------- useCreatePassword -----------------------------------------------

export function useCreatePassword() {
  return useMutation({
    mutationFn: (payload: CreatePasswordPayload) => createPassword(payload),
  });
}

// ---------- useUploadPcn ----------------------------------------------------

export function useUploadPcn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadPcnCert(file),
    onSuccess: () => {
      // Refetch `me` so pcn_uploaded flips to true and the gate passes
      queryClient.invalidateQueries({ queryKey: AUTH_KEYS.me });
    },
  });
}

// ---------- useResendOtp ----------------------------------------------------

export function useResendOtp() {
  return useMutation({
    mutationFn: (email: string) => resendOtp(email),
  });
}

// ---------- useLogout -------------------------------------------------------

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logoutUser,
    onSettled: () => {
      // Always clear the client-side cache regardless of success/error
      queryClient.clear();
    },
  });
}
