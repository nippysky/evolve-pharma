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
 * Upload a Buffer or base64 string to Cloudinary.
 * Returns the public_id and secure URL.
 */
export async function uploadToCloudinary(
  source: Buffer | string,
  folder: UploadFolder,
  options: {
    resourceType?: 'image' | 'raw' | 'auto';
    publicId?:     string;
  } = {},
): Promise<UploadResult> {
  const resourceType = options.resourceType ?? 'image';

  // Convert Buffer to base64 data URI if needed
  const uploadSource =
    Buffer.isBuffer(source)
      ? `data:application/octet-stream;base64,${source.toString('base64')}`
      : source;

  const result = await cloudinary.uploader.upload(uploadSource, {
    folder,
    resource_type: resourceType,
    public_id:     options.publicId,
    overwrite:     !!options.publicId,
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
