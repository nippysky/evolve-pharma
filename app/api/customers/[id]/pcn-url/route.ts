import { NextRequest }   from 'next/server';
import { db }            from '@/lib/db';
import { cloudinary }    from '@/lib/cloudinary';
import { getSession }    from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';

/**
 * Viewable URLs for a customer's PCN certificate.
 *
 * ## Why a PDF certificate wouldn't open
 *
 * Cloudinary **blocks delivery of PDF and ZIP files by default** (Settings →
 * Security → "Allow delivery of PDF and ZIP files"). A blocked request returns
 * 401, which a browser renders as a broken-image icon and a native image view
 * reports as a load failure. The file is perfectly fine — the account simply
 * won't serve it in its original form.
 *
 * The way around it without changing account settings is to stop asking for a
 * PDF. A transformation that rasterises page one delivers a **JPEG**, and image
 * delivery isn't restricted. That's what `preview_url` is.
 *
 * ## Why the transformation must be built here
 *
 * These URLs are signed — the stored `secure_url` carries an `s--<sig>--`
 * segment, and the signature covers the delivery path *including the
 * transformation string*. Appending `pg_1,f_jpg` client-side invalidates it.
 * Only the server has the API secret, so only the server can produce a signed,
 * transformed URL. An earlier client-side attempt at this broke working
 * certificates.
 *
 * Note the previous server bug too: `cloudinary.url(..., { expires_at })`
 * produces a *token-authenticated* URL, which needs an account feature that
 * isn't enabled here. Sign, but never with `expires_at`.
 *
 * ## What's returned
 *
 *   `url`         — the original, untouched. Correct for download, and what to
 *                   open once PDF delivery is enabled on the account.
 *   `preview_url` — a signed JPEG of page one. Renders anywhere, always.
 *                   Falls back to `url` if the public id can't be parsed.
 *   `is_pdf`      — so clients can label it without re-deriving from the path.
 *
 * ## What this endpoint protects
 *
 * The signature makes the URL unguessable but it doesn't expire — anyone who
 * obtains the link keeps access. What's gated here is *discovery*: only ADMIN
 * and STAFF can ask which URL belongs to which customer, and every request is
 * audited. Genuinely revocable access would need `type: 'authenticated'` at
 * upload plus time-limited signing, and a migration for existing records.
 */

interface ParsedAsset {
  resourceType: 'image' | 'video' | 'raw';
  publicId:     string;
  format:       string;
}

/**
 * Pull the public id back out of a delivery URL.
 *
 * Shape: `/{resourceType}/upload/{s--sig--/}{transforms/}{v123/}{public_id}.{ext}`
 *
 * The signature and version segments are stripped because `cloudinary.url()`
 * regenerates both. The public id may contain slashes (it includes the folder),
 * so only the final extension is split off.
 */
function parseCloudinaryUrl(url: string): ParsedAsset | null {
  const clean = url.split('?')[0] ?? url;

  const m = clean.match(/\/(image|video|raw)\/upload\/(.+)$/);
  if (!m) return null;

  const resourceType = (m[1] ?? 'image') as ParsedAsset['resourceType'];

  const path = (m[2] ?? '')
    .replace(/^s--[^/]+--\//, '')   // signature
    .replace(/^v\d+\//, '');        // version

  if (!path) return null;

  const dot = path.lastIndexOf('.');
  return dot === -1
    ? { resourceType, publicId: path, format: '' }
    : { resourceType, publicId: path.slice(0, dot), format: path.slice(dot + 1) };
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
      select: { pcn_certificate_url: true, company_name: true },
    });

    if (!customer)                     return apiNotFound('Customer');
    if (!customer.pcn_certificate_url) return apiNotFound('PCN certificate');

    // Verbatim. Never rewrite or re-sign this one — see above.
    const url = customer.pcn_certificate_url;

    const lower  = url.toLowerCase();
    const is_pdf = lower.includes('.pdf') || lower.includes('/raw/');

    /**
     * A signed, rasterised preview.
     *
     * `page: 1` flattens the first page of a PDF; on a single image it's a
     * no-op. `fetch_format: 'jpg'` is what sidesteps the PDF delivery block —
     * the response is an image, so the restriction doesn't apply. `crop:
     * 'limit'` only ever shrinks, so a small scan isn't upscaled into mush.
     *
     * Raw-stored PDFs are re-addressed as `image` because raw assets don't
     * accept transformations.
     */
    let preview_url = url;
    const parsed = parseCloudinaryUrl(url);

    if (parsed) {
      try {
        preview_url = cloudinary.url(parsed.publicId, {
          resource_type: parsed.resourceType === 'raw' ? 'image' : parsed.resourceType,
          format:        'jpg',
          sign_url:      true,
          secure:        true,
          transformation: [
            { page: 1, width: 1600, crop: 'limit', quality: 'auto' },
          ],
        });
      } catch (err) {
        console.warn('[pcn-url] Could not build a preview URL; falling back to the original.', err);
      }
    }

    // Viewing someone's licence is worth recording. The signed URL is
    // unguessable but non-expiring, so who asked for it is the audit trail.
    writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'VIEW_PCN_CERTIFICATE',
      entityType:  'Customer',
      entityId:    String(customerId),
      description: `Viewed the PCN certificate for ${customer.company_name ?? `customer #${customerId}`}.`,
      req,
    });

    return apiSuccess({ url, preview_url, is_pdf }, 200, 'Certificate URL retrieved.');
  } catch (err) {
    console.error('[GET /api/customers/[id]/pcn-url]', err);
    return apiInternalError();
  }
}
