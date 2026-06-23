/**
 * ENVOLVE PHARMACEUTICALS — Browser-side Axios client
 *
 * Single client for ALL endpoints — customer AND staff/admin.
 * Base URL: https://envolvepharm.com.ng/erp/api/v1/public/
 *
 * Auth is JWT via HttpOnly cookies. `withCredentials: true` tells the
 * browser to include session cookies on every cross-origin request.
 * No manual Authorization headers — the backend handles everything.
 *
 * Token lifecycle (per backend engineer):
 *  - Access token expires every 15 minutes.
 *  - The interceptor catches 401s, calls POST public/auth/refresh to silently
 *    get a new access token, then retries the original request.
 *  - On refresh failure the promise is rejected — the calling component
 *    surfaces the error. NO automatic redirects from the HTTP layer.
 */

import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { API_BASE_URL, AUTH } from './endpoints';

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

// ---------- Token-refresh queue (backend engineer pattern) -----------------
//
// Multiple requests can 401 simultaneously while a refresh is in flight.
// We queue them here and replay all once the new access token is ready.

let isRefreshing = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let failedQueue: Array<{ resolve: (value?: any) => void; reject: (reason?: unknown) => void }> = [];

/**
 * Drain the queue.
 * - error = null  → resolve all (trigger retry via .then(() => apiClient(original)))
 * - error = Error → reject all with the refresh error
 */
const processQueue = (error: unknown = null) => {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve();
    }
  });
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

// ---------- Response interceptor (matches backend engineer's spec) ----------
//
// Pattern from "Axios Intercept.docx" provided by the backend engineer:
//  1. Catch 401 on any request (except auth/refresh itself).
//  2. If a refresh is already in flight, queue the request.
//  3. Otherwise call auth/refresh once, drain the queue, retry original.
//  4. On refresh failure: drain queue with the error, reject — NO redirect.

apiClient.interceptors.response.use(
  // 2xx — pass through unchanged
  (response: AxiosResponse) => response,

  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Guard: don't intercept 401s that came FROM auth/refresh itself —
    // that would cause an infinite refresh loop. Check both the relative
    // path (normal case) and any full-URL form (edge case in some Axios builds).
    const requestUrl = originalRequest.url ?? '';
    const isRefreshCall = requestUrl === AUTH.REFRESH || requestUrl.endsWith('/' + AUTH.REFRESH);

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isRefreshCall
    ) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Another refresh already in flight — queue this request.
        // When the refresh resolves, .then() retries it.
        return new Promise<AxiosResponse>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest));
      }

      isRefreshing = true;
      try {
        // Silently get a new access token
        await apiClient.post('auth/refresh');
        processQueue();           // unblock all queued requests
        return apiClient(originalRequest); // retry the original
      } catch (refreshError) {
        processQueue(refreshError); // reject all queued requests
        // Do NOT redirect — let the component handle the error.
        return Promise.reject(normalizeError(refreshError as AxiosError));
      } finally {
        isRefreshing = false;
      }
    }

    // All non-401 errors (and 401s that skip the refresh path) —
    // normalize into a readable message before rejecting.
    return Promise.reject(normalizeError(error));
  },
);

export default apiClient;
