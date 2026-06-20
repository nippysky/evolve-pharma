/**
 * ENVOLVE PHARMACEUTICALS — Server-side fetch wrapper
 *
 * Used inside Server Components, Server Actions, and Route Handlers.
 * Auth cookies are read from Next.js `cookies()` and forwarded to the
 * backend with each request. Any `Set-Cookie` response headers from the
 * backend are applied back to the browser via Next.js `cookies().set()`.
 *
 * This mirrors `withCredentials: true` for the server context where the
 * browser's automatic cookie handling doesn't apply.
 *
 * Usage:
 *   import { serverFetch } from '@/lib/api/server';
 *   const { data } = await serverFetch<ProductListResponse>('/products');
 */

import { cookies } from 'next/headers';
import { API_BASE_URL } from './endpoints';
import { type ApiResponse, isApiSuccess } from './types';

// ---------- Types ----------------------------------------------------------

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ServerFetchOptions<TBody = unknown> {
  method?: HttpMethod;
  body?: TBody;
  /** Extra headers to merge in */
  headers?: Record<string, string>;
  /**
   * Next.js fetch cache control.
   * Pass `{ revalidate: N }` for ISR, `{ tags: ['products'] }` for on-demand
   * revalidation, or `'no-store'` for always-fresh data.
   */
  cache?: RequestCache | { revalidate?: number | false; tags?: string[] };
  /** When true, forward the browser's existing cookies to the backend */
  forwardCookies?: boolean;
}

interface ServerFetchResult<T> {
  data: T | null;
  error: string | null;
  status: number | null;
  /** Raw response for edge cases */
  raw?: Response;
}

// ---------- Core function -------------------------------------------------

export async function serverFetch<T = unknown, TBody = unknown>(
  path: string,
  options: ServerFetchOptions<TBody> = {},
): Promise<ServerFetchResult<T>> {
  const {
    method = 'GET',
    body,
    headers: extraHeaders = {},
    cache,
    forwardCookies = true,
  } = options;

  // Build cookie header from Next.js cookie store
  let cookieHeader = '';
  if (forwardCookies) {
    try {
      const store = await cookies();
      cookieHeader = store
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');
    } catch {
      // cookies() throws outside request context — safe to ignore
    }
  }

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const isFormData = body instanceof FormData;

  const fetchHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    ...extraHeaders,
  };

  // Build Next.js-specific cache config
  let nextInit: RequestInit['next'] | undefined;
  let cacheControl: RequestCache | undefined;
  if (typeof cache === 'object' && cache !== null && !('no-store' in cache)) {
    nextInit = cache as { revalidate?: number | false; tags?: string[] };
  } else if (typeof cache === 'string') {
    cacheControl = cache as RequestCache;
  }

  const init: RequestInit & { next?: RequestInit['next'] } = {
    method,
    headers: fetchHeaders,
    ...(body !== undefined ? { body: isFormData ? (body as FormData) : JSON.stringify(body) } : {}),
    ...(cacheControl ? { cache: cacheControl } : {}),
    ...(nextInit ? { next: nextInit } : {}),
    // credentials: 'include' doesn't work server-side; we use the Cookie header instead
  };

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (networkError) {
    return {
      data: null,
      error: 'Network error — could not reach the server.',
      status: null,
    };
  }

  // Forward Set-Cookie headers from backend to the browser
  try {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    if (setCookies.length > 0) {
      const store = await cookies();
      for (const raw of setCookies) {
        // Parse the first name=value pair only; path/httpOnly/etc. are handled by the backend
        const [nameValue] = raw.split(';');
        const eqIdx = nameValue?.indexOf('=') ?? -1;
        if (eqIdx > 0) {
          const name = nameValue!.slice(0, eqIdx).trim();
          const value = nameValue!.slice(eqIdx + 1).trim();
          // Set with minimal options — the backend owns the full cookie policy
          store.set({ name, value, path: '/', sameSite: 'lax' });
        }
      }
    }
  } catch {
    // Can't set cookies outside a request context — ignore
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errBody = (await response.json()) as ApiResponse;
      if (!isApiSuccess(errBody)) errorMessage = errBody.message ?? errorMessage;
    } catch {
      // body wasn't JSON
    }
    return { data: null, error: errorMessage, status: response.status, raw: response };
  }

  try {
    const json = (await response.json()) as ApiResponse<T>;
    if (!isApiSuccess(json)) {
      return { data: null, error: json.message, status: response.status, raw: response };
    }
    return { data: json.data, error: null, status: response.status, raw: response };
  } catch {
    return { data: null, error: 'Invalid JSON response from server.', status: response.status };
  }
}

// ---------- Convenience helpers -------------------------------------------

export const serverGet = <T>(path: string, opts?: Omit<ServerFetchOptions, 'method' | 'body'>) =>
  serverFetch<T>(path, { ...opts, method: 'GET' });

export const serverPost = <T, B = unknown>(
  path: string,
  body: B,
  opts?: Omit<ServerFetchOptions<B>, 'method' | 'body'>,
) => serverFetch<T, B>(path, { ...opts, method: 'POST', body });

export const serverPatch = <T, B = unknown>(
  path: string,
  body: B,
  opts?: Omit<ServerFetchOptions<B>, 'method' | 'body'>,
) => serverFetch<T, B>(path, { ...opts, method: 'PATCH', body });

export const serverDelete = <T>(path: string, opts?: Omit<ServerFetchOptions, 'method' | 'body'>) =>
  serverFetch<T>(path, { ...opts, method: 'DELETE' });
