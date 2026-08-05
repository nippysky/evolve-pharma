import { NextRequest, NextResponse } from 'next/server';
import { db }           from '@/lib/db';
import { cloudinary }   from '@/lib/cloudinary';
import { getSession }   from '@/lib/auth';
import {
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';

/**
 * Parse a Cloudinary CDN URL into its component parts.
 *
 * Input:  https://res.cloudinary.com/{cloud}/{resourceType}/upload/{version?}/{publicId}.{format}
 * Output: { resourceType, publicId, format }
 *
 * Handles:
 *   .../image/upload/v1785739511/evolve/pcn/abc123.pdf   → image, evolve/pcn/abc123, pdf
 *   .../raw/upload/evolve/pcn/abc123.pdf                  → raw,   evolve/pcn/abc123, pdf
 *   .../image/upload/s--sig--/v123/evolve/pcn/abc.jpg    → image, evolve/pcn/abc,    jpg
 */
function parseCldUrl(url: string): { resourceType: string; publicId: string; format: string } {
  // Strip query string
  const clean = url.split('?')[0] ?? url;

  // Match /{resourceType}/upload/{optional transformations and version}/{public_id}.{format}
  const m = clean.match(/\/(image|video|raw)\/upload\/(.+)$/);
  if (!m) throw new Error(`Unrecognised Cloudinary URL: ${url}`);

  const resourceType = m[1] ?? 'image';
  // Path may contain: s--sig--/ v1234567/ folder/name.ext
  // Strip signature token (s--...--/) and version (v\d+/) from the front
  const rawPath = (m[2] ?? '')
    .replace(/^s--[^/]+--\//, '') // strip signature
    .replace(/^v\d+\//, '');      // strip version

  // Split off format (last .ext)
  const dotIdx = rawPath.lastIndexOf('.');
  if (dotIdx === -1) {
    return { resourceType, publicId: rawPath, format: '' };
  }

  const publicId = rawPath.slice(0, dotIdx);
  const format   = rawPath.slice(dotIdx + 1) ?? '';
  return { resourceType, publicId, format };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const { id } = await params;
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) return apiNotFound('Customer');

    const customer = await db.customer.findUnique({
      where:  { id: customerId },
      select: { pcn_certificate_url: true },
    });
    if (!customer)                      return apiNotFound('Customer');
    if (!customer.pcn_certificate_url)  return apiNotFound('PCN certificate');

    const rawUrl = customer.pcn_certificate_url;
    let signedUrl: string;

    try {
      const { resourceType, publicId, format } = parseCldUrl(rawUrl);

      signedUrl = cloudinary.url(publicId, {
        resource_type: resourceType as 'image' | 'raw' | 'video',
        format:        format || undefined,
        sign_url:      true,
        secure:        true,
        // Expires 2 hours from now — enough for any admin review session
        expires_at:    Math.floor(Date.now() / 1000) + 60 * 60 * 2,
      });
    } catch (parseErr) {
      // If we can't parse the URL (unexpected format), fall back to the raw URL.
      // The browser may still 401, but at least we don't break the endpoint.
      console.warn('[pcn-url] Could not parse Cloudinary URL, returning raw URL:', parseErr);
      signedUrl = rawUrl;
    }

    return NextResponse.json({ signedUrl });
  } catch (err) {
    console.error('[GET /api/customers/[id]/pcn-url]', err);
    return apiInternalError();
  }
}
