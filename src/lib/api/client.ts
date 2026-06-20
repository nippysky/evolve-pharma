/**
 * ENVOLVE PHARMACEUTICALS — Browser-side Axios client
 *
 * Single client for ALL endpoints — customer AND staff/admin.
 * Base URL: https://envolvepharm.com.ng/erp/api/v1/public/
 *
 * Auth is entirely cookie-based (HttpOnly JWT). `withCredentials: true`
 * tells the browser to include session cookies on every cross-origin
 * request automatically — no manual Authorization headers needed.
 *
 * The response interceptor handles token expiry: on a 401 it fires
 * POST auth/refresh once, queues concurrent requests, and retries.
 */

import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { API_BASE_URL } from './endpoints';

// ---------- Shared Axios instance ------------------------------------------

const apiClient = axios.create({
  baseURL: API_BASE_URL,   // https://envolvepharm.com.ng/erp/api/v1/public/
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// adminApiClient is an alias — all endpoints share the same base URL
export const adminApiClient = apiClient;

// ---------- Token-refresh queue -------------------------------------------

let isRefreshing = false;
let failedQueue: Array<{
  resolve: () => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  failedQueue = [];
};

// ---------- Error normalizer -----------------------------------------------

/**
 * Convert an AxiosError into a plain Error with a human-readable message.
 *
 * Handles two backend error shapes:
 *   Shape A: { status:"error", message:"...", errors:{ field:[...] } }
 *   Shape B: { status:"error", error:{ message:"...", details:{ field:[...] } } }
 */
function normalizeError(
  error: AxiosError,
): Error & { fieldErrors?: Record<string, string[]>; status?: number } {
  const status = error.response?.status;
  const body   = error.response?.data as Record<string, unknown> | undefined;

  if (body) {
    // Shape A — top-level message
    if (typeof body.message === 'string') {
      const err = new Error(body.message) as Error & {
        fieldErrors?: Record<string, string[]>;
        status?: number;
      };
      err.status = status;
      if (body.errors && typeof body.errors === 'object') {
        err.fieldErrors = body.errors as Record<string, string[]>;
      }
      return err;
    }
    // Shape B — message nested under `error` key
    if (body.error && typeof body.error === 'object') {
      const nested = body.error as Record<string, unknown>;
      if (typeof nested.message === 'string') {
        const err = new Error(nested.message) as Error & {
          fieldErrors?: Record<string, string[]>;
          status?: number;
        };
        err.status = status;
        if (nested.details && typeof nested.details === 'object') {
          err.fieldErrors = nested.details as Record<string, string[]>;
        }
        return err;
      }
    }
  }

  // HTTP error without a JSON body
  if (status) {
    const statusMessages: Record<number, string> = {
      400: 'Bad request. Please check your input and try again.',
      401: 'Your session has expired. Please sign in again.',
      403: 'You do not have permission to perform this action.',
      404: 'The requested resource was not found.',
      409: 'A conflict occurred — this record may already exist.',
      413: 'The uploaded file is too large. Maximum size is 8 MB.',
      422: 'Validation failed. Please review the form and try again.',
      429: 'Too many requests. Please wait a moment and try again.',
      500: 'An internal server error occurred. Please try again later.',
      502: 'The server is temporarily unavailable (502). Please try again.',
      503: 'The server is temporarily unavailable (503). Please try again.',
    };
    const msg = statusMessages[status] ?? `Unexpected server response (${status}).`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = status;
    return err;
  }

  // No response — network / CORS / DNS / timeout
  if (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED') {
    return new Error('Request timed out. Please try again.');
  }

  if (error.code === 'ERR_NETWORK' || !error.response) {
    return new Error(
      'Network error — unable to reach the server. ' +
      'Check your internet connection or open DevTools (F12) for details.',
    );
  }

  return new Error(error.message ?? 'An unexpected error occurred. Please try again.');
}

// ---------- Response interceptor ------------------------------------------

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,

  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Intercept 401s (session expired): refresh once then retry.
    // Skip the refresh endpoint itself to avoid an infinite loop.
    if (
      error.response?.status === 401 &&
      !original._retry &&
      original.url !== 'auth/refresh'
    ) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise<AxiosResponse>((resolve, reject) => {
          failedQueue.push({
            resolve: () => resolve(apiClient(original)),
            reject,
          });
        });
      }

      isRefreshing = true;
      try {
        await apiClient.post('auth/refresh');
        processQueue();
        return apiClient(original);
      } catch (refreshError) {
        processQueue(refreshError);
        if (typeof window !== 'undefined') {
          window.location.href = '/sign-in';
        }
        return Promise.reject(normalizeError(refreshError as AxiosError));
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(normalizeError(error));
  },
);

export default apiClient;
