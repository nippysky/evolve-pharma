/**
 * ENVOLVE PHARMACEUTICALS — Next.js API Proxy
 *
 * WHY THIS EXISTS
 * ───────────────
 * The browser runs on localhost:3000; the backend is on ece.envolvepharm.com.ng.
 * Modern browsers block cross-origin cookies (SameSite=Lax/Strict) and won't
 * send the backend's `access_token` / `refresh_token` cookies on XHR/fetch
 * requests from a different origin — even with withCredentials:true — unless
 * the cookie is SameSite=None AND Secure. HTTP localhost is never "Secure".
 *
 * The proxy makes every request same-origin:
 *   Browser ──► localhost:3000/api/proxy/auth/me       (same origin ✓)
 *   Next.js ──► ece.envolvepharm.com.ng/…/auth/me     (server-to-server ✓)
 *
 * On login, the backend's Set-Cookie response travels through the proxy,
 * which strips the `Secure` / `Domain` / `SameSite` constraints and
 * re-issues the cookies for `localhost`. All subsequent browser requests to
 * /api/proxy/* automatically include those cookies.
 *
 * IMPORTANT — Set-Cookie multi-header fix
 * ────────────────────────────────────────
 * Node.js's native fetch concatenates multiple Set-Cookie values when you
 * read them with headers.get('set-cookie') or headers.forEach(). To iterate
 * them separately we use Headers.getSetCookie() (Node.js 20+ / undici).
 */

import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE = 'https://ece.envolvepharm.com.ng/api/v1/public';

/** Headers that must not be forwarded (hop-by-hop). */
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'transfer-encoding',
  'te', 'trailer', 'upgrade',
  'proxy-authorization', 'proxy-authenticate',
]);

/**
 * Response headers we strip before forwarding to the browser.
 *
 * content-encoding — proxy reads the body with arrayBuffer() which decompresses
 *   it; forwarding the original encoding header would tell the browser to
 *   decompress again → garbled response.
 *
 * content-length — the original byte count came from the compressed (or
 *   chunked) backend response. After arrayBuffer() the size may differ.
 *   Forwarding the old Content-Length causes ERR_CONTENT_LENGTH_MISMATCH in
 *   Chrome. We let Next.js compute the correct length from the actual buffer.
 */
const STRIP_RESPONSE = new Set(['content-encoding', 'content-length']);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return all Set-Cookie strings as a proper array.
 * `Headers.getSetCookie()` is the correct cross-platform API; we fall back to
 * splitting on ', ' for environments where it is not yet available.
 */
function getSetCookies(headers: Headers): string[] {
  if (typeof (headers as { getSetCookie?: () => string[] }).getSetCookie === 'function') {
    return (headers as { getSetCookie: () => string[] }).getSetCookie();
  }
  // Fallback: the value may be comma-joined (incorrect but better than nothing)
  const raw = headers.get('set-cookie');
  return raw ? raw.split(/,(?=[^ ])/) : [];
}

/**
 * Strip Secure / Domain / SameSite from a Set-Cookie directive so the browser
 * accepts and stores it for localhost (which is HTTP, not HTTPS).
 */
function sanitizeCookie(raw: string): string {
  return raw
    .replace(/;\s*Secure\b/gi, '')
    .replace(/;\s*Domain=[^;,]*/gi, '')
    .replace(/;\s*SameSite=\w+/gi, '; SameSite=Lax');
}

// ── Core proxy handler ────────────────────────────────────────────────────────

async function proxyRequest(
  req: NextRequest,
  params: Promise<{ path: string[] }>,
): Promise<NextResponse> {
  const { path } = await params;
  const backendPath = path.join('/');
  const backendUrl   = `${BACKEND_BASE}/${backendPath}${req.nextUrl.search}`;

  // ── Forward request headers ────────────────────────────────────────────────
  const forwardHeaders = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP.has(lower) && lower !== 'host') {
      forwardHeaders.set(key, value);
    }
  });

  // Pass all cookies the browser sends (will include JWT cookies once
  // they have been re-issued for localhost by a previous login through this proxy).
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    forwardHeaders.set('cookie', cookieHeader);
  }

  // ── Read body ──────────────────────────────────────────────────────────────
  //
  // For multipart/form-data uploads (bulk-upload endpoints) we CANNOT forward
  // the raw ArrayBuffer from the browser because Node.js fetch cannot send an
  // opaque ArrayBuffer as multipart — the backend cannot find the file field.
  //
  // Instead we:
  //   1. Parse the incoming multipart request with req.formData() so Next.js
  //      correctly extracts all fields and files.
  //   2. Pass the parsed FormData object to the backend fetch call.
  //   3. Delete the incoming Content-Type header from forwardHeaders so that
  //      Node.js fetch generates a fresh boundary string automatically.
  //
  // For all other bodies (JSON, text, binary) we read as ArrayBuffer and
  // forward verbatim — the existing Content-Type header stays intact.

  const method = req.method.toUpperCase();
  let   body: BodyInit | undefined;

  if (method !== 'GET' && method !== 'HEAD') {
    // Read the full body as raw bytes and forward verbatim.
    // For multipart/form-data the browser (via native fetch in the service)
    // has already set Content-Type: multipart/form-data; boundary=XXX on the
    // incoming request. We forward that header + the raw bytes unchanged, so
    // the backend receives a correctly-formed multipart request.
    body = await req.arrayBuffer();
  }

  // ── Call backend ──────────────────────────────────────────────────────────
  let backendRes: Response;
  try {
    backendRes = await fetch(backendUrl, {
      method,
      headers: forwardHeaders,
      body,
      redirect: 'manual',
      cache:    'no-store',
    });
  } catch (err) {
    console.error('[Proxy] Network error →', backendUrl, err);
    return NextResponse.json(
      { status: 'error', message: 'Proxy could not reach the backend.' },
      { status: 502 },
    );
  }

  // Log non-2xx responses in dev to make backend errors easier to diagnose
  if (process.env.NODE_ENV === 'development' && !backendRes.ok) {
    console.error(`[Proxy] Backend ${backendRes.status} for ${method} ${backendUrl}`);
  }

  // ── Build response headers ────────────────────────────────────────────────
  const responseHeaders = new Headers();

  backendRes.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || STRIP_RESPONSE.has(lower) || lower === 'set-cookie') return;
    responseHeaders.set(key, value);
  });

  // Re-issue each Set-Cookie separately with localhost-friendly attributes
  for (const cookie of getSetCookies(backendRes.headers)) {
    responseHeaders.append('set-cookie', sanitizeCookie(cookie));
  }

  const responseBody = await backendRes.arrayBuffer();

  return new NextResponse(responseBody, {
    status:     backendRes.status,
    statusText: backendRes.statusText,
    headers:    responseHeaders,
  });
}

// ── Route exports (one per HTTP method) ──────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, params);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, params);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, params);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, params);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, params);
}
