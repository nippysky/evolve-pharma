/**
 * ENVOLVE PHARMACEUTICALS — Auth Service
 *
 * Pure async functions that call the backend auth endpoints.
 * Each function uses the browser-side Axios client so cookies are sent
 * and received automatically. These are consumed by TanStack Query hooks
 * — never call them directly from components.
 *
 * Swap the endpoint paths here when the backend changes; hooks stay stable.
 */

import apiClient from '@/lib/api/client';
import { AUTH } from '@/lib/api/endpoints';
import type {
  RegisterCustomerPayload,
  RegisterCustomerResponse,
  LoginCustomerPayload,
  LoginCustomerResponse,
  VerifyOtpPayload,
  VerifyOtpResponse,
  CreatePasswordPayload,
  CreatePasswordResponse,
  MeResponse,
  ApiResponse,
  ApiSuccess,
  ApiError,
} from '@/lib/api/types';

// ---------- Helpers --------------------------------------------------------

/**
 * Unwrap the backend envelope and throw on errors.
 *
 * The backend sends `status: "success"` on success and a different string
 * (e.g. "error") on failure — NOT a boolean.
 */
function unwrap<T>(res: ApiResponse<T>): T {
  if (res.status !== 'success') {
    const err = new Error(res.message ?? 'Request failed');
    // Attach validation errors so TanStack Query can surface them
    (err as Error & { fieldErrors?: Record<string, string[]> }).fieldErrors =
      (res as ApiError).errors;
    throw err;
  }
  return (res as ApiSuccess<T>).data;
}

// ---------- Register -------------------------------------------------------

/**
 * POST auth/customer/register
 * Body is multipart/form-data because the PCN certificate is a file.
 */
export async function registerCustomer(
  payload: RegisterCustomerPayload,
): Promise<RegisterCustomerResponse> {
  const fd = new FormData();
  fd.set('first_name', payload.first_name);
  if (payload.middle_name) fd.set('middle_name', payload.middle_name);
  fd.set('last_name', payload.last_name);
  fd.set('company_name', payload.company_name);
  fd.set('email', payload.email);
  fd.set('phone', payload.phone);
  fd.set('address', payload.address);
  fd.set('city', payload.city);
  fd.set('state', payload.state);
  if (payload.gender) fd.set('gender', payload.gender);
  if (payload.referral_code) fd.set('referral_code', payload.referral_code);
  fd.set('pcn_certificate', payload.pcn_certificate);

  const { data } = await apiClient.post<ApiResponse<RegisterCustomerResponse>>(
    AUTH.REGISTER_CUSTOMER,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return unwrap(data);
}

// ---------- Login -----------------------------------------------------------

/** POST auth/login-customer */
export async function loginCustomer(
  payload: LoginCustomerPayload,
): Promise<LoginCustomerResponse> {
  const { data } = await apiClient.post<ApiResponse<LoginCustomerResponse>>(
    AUTH.LOGIN_CUSTOMER,
    payload,
  );
  return unwrap(data);
}

// ---------- Verify OTP ------------------------------------------------------

/** POST auth/customer/verify-otp */
export async function verifyOtp(
  payload: VerifyOtpPayload,
): Promise<VerifyOtpResponse> {
  const { data } = await apiClient.post<ApiResponse<VerifyOtpResponse>>(
    AUTH.VERIFY_OTP,
    payload,
  );
  return unwrap(data);
}

// ---------- Create password -------------------------------------------------

/** POST auth/customer/create-password */
export async function createPassword(
  payload: CreatePasswordPayload,
): Promise<CreatePasswordResponse> {
  const { data } = await apiClient.post<ApiResponse<CreatePasswordResponse>>(
    AUTH.CREATE_PASSWORD,
    payload,
  );
  return unwrap(data);
}

// ---------- Upload PCN (post-login gate) ------------------------------------

/** POST auth/customer/upload-pcn */
export async function uploadPcnCert(file: File): Promise<{ message: string }> {
  const fd = new FormData();
  fd.set('pcn_certificate', file);
  const { data } = await apiClient.post<ApiResponse<{ message: string }>>(
    AUTH.UPLOAD_PCN,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return unwrap(data);
}

// ---------- Current user ---------------------------------------------------

/** GET auth/user — fetches the authenticated user from the session cookie */
export async function getMe(): Promise<MeResponse> {
  const { data } = await apiClient.get<ApiResponse<MeResponse>>(AUTH.ME);
  return unwrap(data);
}

// ---------- Logout ---------------------------------------------------------

/** POST auth/logout */
export async function logoutUser(): Promise<void> {
  await apiClient.post(AUTH.LOGOUT);
}

// ---------- Resend OTP (if backend supports it) ----------------------------

/** POST auth/customer/resend-otp — stub, update path when backend ships */
export async function resendOtp(email: string): Promise<{ message: string }> {
  const { data } = await apiClient.post<ApiResponse<{ message: string }>>(
    'auth/customer/resend-otp',
    { email },
  );
  return unwrap(data);
}
