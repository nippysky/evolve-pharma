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
export interface BulkFailedRecord {
  row: number;
  email: string;
  errors: string[];
}
export interface BulkUploadResult {
  total_records: number;
  successful: number;
  failed: number;
  failed_records: BulkFailedRecord[];
}

function normalizeError(
  error: AxiosError,
): Error & { fieldErrors?: Record<string, string[]>; status?: number; uploadResult?: BulkUploadResult } {
  const status = error.response?.status;
  const body   = error.response?.data as Record<string, unknown> | undefined;

  /**
   * Translate a raw backend message into a friendly string if it contains
   * technical jargon a user should never see (SMTP, SQL, PHP internals, etc.)
   */
  function sanitizeBackendMessage(raw: string): string {
    const l = raw.toLowerCase();
    if (
      l.includes('smtp') || l.includes('invalid address') ||
      l.includes('econnrefused') || l.includes('enotfound') ||
      l.includes('getaddrinfo') || l.includes('nodemailer') ||
      l.includes('connect etimedout') || l.includes('failed to connect to server') ||
      l.includes('could not connect')
    ) {
      return 'We ran into a technical issue on our end. Please try again in a moment or contact support.';
    }
    if (
      l.includes('typed property') || l.includes('must not be accessed before initialization') ||
      l.includes('app\\core') || l.includes('app\\\\core') ||
      l.includes('syntax error') || l.includes('sequelize') || l.includes('sql') ||
      l.includes('undefined variable') || l.includes('call to undefined')
    ) {
      return 'A server error occurred while processing this request. Please contact support.';
    }
    // Sanitize per-row errors inside bulk upload failed_records
    if (l.includes('mail') && (l.includes('smtp') || l.includes('host'))) {
      return 'We ran into a technical issue on our end. Please try again in a moment or contact support.';
    }
    return raw;
  }

  if (body) {
    // Shape A — top-level message
    if (typeof body.message === 'string') {
      const err = new Error(sanitizeBackendMessage(body.message)) as Error & {
        fieldErrors?: Record<string, string[]>;
        status?: number;
        uploadResult?: BulkUploadResult;
      };
      err.status = status;
      if (body.errors && typeof body.errors === 'object') {
        err.fieldErrors = body.errors as Record<string, string[]>;
      }
      return err;
    }
    // Shape B — message nested under `error` key
    // Also handles bulk-upload shape: { error: { message, data: { data: { failed_records } } } }
    if (body.error && typeof body.error === 'object') {
      const nested = body.error as Record<string, unknown>;
      if (typeof nested.message === 'string') {
        const err = new Error(sanitizeBackendMessage(nested.message)) as Error & {
          fieldErrors?: Record<string, string[]>;
          status?: number;
          uploadResult?: BulkUploadResult;
        };
        err.status = status;
        if (nested.details && typeof nested.details === 'object') {
          err.fieldErrors = nested.details as Record<string, string[]>;
        }
        // Extract bulk upload result if present (nested under error.data.data)
        const nestedData = nested.data as Record<string, unknown> | undefined;
        const innerData  = nestedData?.data as Record<string, unknown> | undefined;
        if (innerData && Array.isArray(innerData.failed_records)) {
          const rawRecords = innerData.failed_records as Array<Record<string, unknown>>;
          err.uploadResult = {
            total_records: Number(innerData.total_records ?? 0),
            successful:    Number(innerData.successful    ?? 0),
            failed:        Number(innerData.failed        ?? 0),
            failed_records: rawRecords.map((r) => ({
              row:    Number(r.row ?? 0),
              email:  String(r.email ?? ''),
              errors: (Array.isArray(r.errors) ? r.errors as string[] : [String(r.errors ?? '')]).map(sanitizeBackendMessage),
            })),
          };
        }
        return err;
      }
    }
  }

  // HTTP error without a JSON body
  if (status) {
    const statusMessages: Record<number, string> = {
      400: 'Something looks off with what was submitted. Please check your details and try again.',
      401: 'Incorrect email or password. Please double-check and try again.',
      403: 'You don\'t have permission to do that. Contact your administrator if you think this is a mistake.',
      404: 'We couldn\'t find what you\'re looking for. It may have been moved or deleted.',
      409: 'This record already exists. Please check for duplicates.',
      413: 'The file you uploaded is too large. Please use a file under 8 MB.',
      422: 'Some of the information you entered isn\'t quite right. Please review and try again.',
      429: 'You\'ve made too many attempts. Please wait a moment and try again.',
      500: 'Something went wrong on our end. Please try again — our team has been notified.',
      502: 'Our servers are temporarily unavailable. Please try again in a few moments.',
      503: 'The service is temporarily down for maintenance. Please try again shortly.',
    };
    const msg = statusMessages[status] ?? `An unexpected error occurred (code ${status}). Please try again.`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = status;
    return err;
  }

  // No response — network / CORS / DNS / timeout / content-length mismatch
  if (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED') {
    return new Error('Our servers are taking too long to respond. Please try again in a moment.');
  }

  if (
    error.code === 'ERR_NETWORK' ||
    error.code === 'ERR_CONTENT_LENGTH_MISMATCH' ||
    !error.response
  ) {
    return new Error(
      'Our servers appear to be temporarily unavailable. Please try again in a moment.',
    );
  }

  return new Error(error.message ?? 'Something went wrong. Please try again.');
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

    // Guard: login endpoints return 401 for WRONG CREDENTIALS, not for expired
    // tokens. Attempting a refresh here makes no sense (there is no session yet)
    // and would replace the "wrong password" error with a confusing refresh-fail
    // error. Skip the refresh path entirely for all authentication flows.
    const isLoginCall =
      requestUrl.includes(AUTH.LOGIN_CUSTOMER) ||
      requestUrl.includes(AUTH.LOGIN_STAFF);

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isRefreshCall &&
      !isLoginCall
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
