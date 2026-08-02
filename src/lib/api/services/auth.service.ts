/**
 * Auth Service — client-side stubs
 *
 * These functions call the new Next.js /api/auth/* routes.
 * Full implementation wired in Module 6; stubs here satisfy TypeScript
 * and compile cleanly until then.
 */

import type {
  SessionUser,
  LoginCustomerPayload,
  RegisterCustomerPayload,
  VerifyOtpPayload,
  CreatePasswordPayload,
} from '@/lib/api/types';

// ─── helpers ──────────────────────────────────────────────────────────────────

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? 'Request failed');
  return json?.data as T;
}

// ─── Customer auth ────────────────────────────────────────────────────────────

export async function registerCustomer(payload: RegisterCustomerPayload) {
  return post<{ message: string }>('/api/auth/customer/register', payload);
}

export async function loginCustomer(payload: LoginCustomerPayload) {
  return post<{ customer: SessionUser & { status: string } }>(
    '/api/auth/customer/login',
    payload,
  );
}

export async function verifyOtp(payload: VerifyOtpPayload) {
  return post<{ token: string }>('/api/auth/customer/verify-otp', payload);
}

export async function createPassword(payload: CreatePasswordPayload) {
  return post<{ message: string }>('/api/auth/customer/create-password', payload);
}

export async function resendOtp(email: string) {
  return post<{ message: string }>('/api/auth/customer/resend-otp', { email });
}

export async function uploadPcnCert(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/auth/customer/upload-pcn', {
    method:      'POST',
    credentials: 'include',
    body:        fd,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? 'Upload failed');
  return json?.data as { url: string };
}

// ─── Shared auth ──────────────────────────────────────────────────────────────

export async function getMe() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) throw new Error('Unauthenticated');
  const json = await res.json();
  return json?.data?.user as SessionUser;
}

export async function logoutUser() {
  return post<{ message: string }>('/api/auth/logout');
}
