/**
 * POST /api/auth/customer/invited-pcn
 *
 * Unauthenticated PCN upload step for admin-invited customers.
 *
 * Flow:
 *   1. Customer receives invitation email → clicks link → lands on /sign-up/invited
 *   2. Step 1 of the invited page calls this endpoint with their email + PCN file
 *   3. Validates the customer is in REGISTERED status (no PCN yet, not self-registered)
 *   4. Uploads PCN to Cloudinary
 *   5. Updates customer.pcn_certificate_url + customer.status → PCN_CERT_UPLOADED
 *
 * No session required. Email acts as the lookup key — the OTP step that follows
 * provides the identity proof.
 *
 * Body: multipart/form-data
 *   email  — customer's email address
 *   file   — PCN certificate (PDF / JPG / PNG, max 8 MB)
 *
 * Response 200:
 *   { url: string }   — public Cloudinary URL (for display in the UI)
 */

import { NextRequest }        from 'next/server';
import { db }                 from '@/lib/db';
import { uploadToCloudinary } from '@/lib/cloudinary';
import {
  apiSuccess,
  apiError,
  apiInternalError,
} from '@/lib/api/response';

const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'] as const;
const MAX_FILE_SIZE_BYTES  = 8 * 1024 * 1024; // 8 MB

export async function POST(req: NextRequest) {
  try {
    let formData: FormData;
    try { formData = await req.formData(); }
    catch { return apiError('Multipart form data required', 400); }

    const email = (formData.get('email') as string | null)?.trim().toLowerCase();
    const file  = formData.get('file') as File | null;

    // ── Field presence ────────────────────────────────────────────────────────
    if (!email || !email.includes('@')) {
      return apiError('A valid email address is required.', 422);
    }
    if (!file) {
      return apiError('No file uploaded.', 422);
    }

    // ── File type guard ───────────────────────────────────────────────────────
    const fileName = file.name.toLowerCase();
    const isAccepted = ACCEPTED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
    if (!isAccepted) {
      return apiError('Only PDF, JPG, or PNG files are accepted.', 415);
    }

    // ── File size guard ───────────────────────────────────────────────────────
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return apiError('File must be under 8 MB.', 413);
    }

    // ── Resolve customer ──────────────────────────────────────────────────────
    const user = await db.user.findUnique({
      where:  { email },
      select: {
        id:       true,
        role:     true,
        customer: { select: { id: true, status: true, pcn_certificate_url: true } },
      },
    });

    if (!user || user.role !== 'CUSTOMER') {
      return apiError('No customer account found for this email address.', 404);
    }

    if (!user.customer) {
      return apiError('Customer profile not found.', 404);
    }

    // Only allow REGISTERED customers (admin-invited, no PCN yet).
    // Self-registered customers who already have a PCN go through upload-pcn instead.
    if (user.customer.status !== 'REGISTERED') {
      return apiError(
        'Your account is not eligible for this action. If you already uploaded a PCN, please sign in.',
        409,
      );
    }

    // ── Upload to Cloudinary ──────────────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const isPdf  = fileName.endsWith('.pdf');

    let uploadResult: { url: string };
    try {
      uploadResult = await uploadToCloudinary(buffer, 'evolve/pcn', {
        resourceType: isPdf ? 'raw' : 'image',
      });
    } catch (uploadErr: unknown) {
      const detail =
        uploadErr && typeof uploadErr === 'object' && 'message' in uploadErr
          ? (uploadErr as { message: string }).message
          : String(uploadErr);
      console.error('[invited-pcn] Cloudinary upload failed:', detail);
      return apiError(
        'Could not upload your certificate. Please check your file and try again.',
        502,
      );
    }

    // ── Persist ───────────────────────────────────────────────────────────────
    await db.customer.update({
      where: { id: user.customer.id },
      data:  {
        pcn_certificate_url: uploadResult.url,
        status:              'PCN_CERT_UPLOADED',
      },
    });

    console.log(`[invited-pcn] PCN uploaded for ${email}: ${uploadResult.url}`);

    return apiSuccess(
      { url: uploadResult.url },
      200,
      'PCN certificate uploaded successfully.',
    );
  } catch (err) {
    console.error('[POST /api/auth/customer/invited-pcn]', err);
    return apiInternalError();
  }
}
