/**
 * Cloudinary configuration
 *
 * Used server-side in API route handlers only — never import in client components.
 * All uploads go through /api/upload which returns a secure URL + public_id.
 * The public_id is stored in the DB for future deletion/transforms.
 *
 * Folder structure on Cloudinary:
 *   evolve/products/          — product images
 *   evolve/pcn/               — customer PCN certificates (PDF)
 *   evolve/imports/           — bulk import files (xlsx/csv)
 *   evolve/avatars/           — user profile images
 */

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

export { cloudinary };

// ─── Upload helpers ────────────────────────────────────────────────────────────

export type UploadFolder =
  | 'evolve/products'
  | 'evolve/pcn'
  | 'evolve/imports'
  | 'evolve/avatars';

export interface UploadResult {
  publicId: string;
  url:      string;
  format:   string;
  bytes:    number;
}

/**
 * Upload a Buffer to Cloudinary using upload_stream.
 *
 * upload_stream pipes the raw bytes directly — no base64 data-URI encoding.
 * This avoids the 403 that certain Cloudinary account configurations return
 * when they receive a data:...;base64,... string upload payload.
 *
 * resource_type 'auto' lets Cloudinary detect image (JPEG/PNG/WEBP) vs
 * raw (PDF/XLSX) automatically — pass it explicitly for every call.
 */
export async function uploadToCloudinary(
  source:   Buffer | string,
  folder:   UploadFolder,
  options: {
    resourceType?: 'image' | 'raw' | 'auto';
    publicId?:     string;
    mimeType?:     string; // kept for API compatibility, unused in stream path
  } = {},
): Promise<UploadResult> {
  const resourceType = options.resourceType ?? 'auto';

  // If the source is already a URL/base64 string, fall back to the simple upload() call.
  if (!Buffer.isBuffer(source)) {
    const result = await cloudinary.uploader.upload(source, {
      folder,
      resource_type: resourceType,
      ...(options.publicId ? { public_id: options.publicId, overwrite: true } : {}),
    });
    return {
      publicId: result.public_id,
      url:      result.secure_url,
      format:   result.format,
      bytes:    result.bytes,
    };
  }

  // Buffer → stream upload (no data-URI encoding, works with all account types)
  type CloudResult = { public_id: string; secure_url: string; format: string; bytes: number };

  const result = await new Promise<CloudResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        ...(options.publicId ? { public_id: options.publicId, overwrite: true } : {}),
      },
      (error, res) => {
        if (error || !res) {
          reject(error ?? new Error('Cloudinary upload_stream: no result returned'));
        } else {
          resolve(res as CloudResult);
        }
      },
    );
    stream.end(source);
  });

  return {
    publicId: result.public_id,
    url:      result.secure_url,
    format:   result.format,
    bytes:    result.bytes,
  };
}

/**
 * Delete a file from Cloudinary by its public_id.
 */
export async function deleteFromCloudinary(
  publicId:     string,
  resourceType: 'image' | 'raw' = 'image',
): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
