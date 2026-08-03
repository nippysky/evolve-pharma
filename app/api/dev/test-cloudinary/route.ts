/**
 * GET /api/dev/test-cloudinary
 *
 * Verifies Cloudinary credentials by pinging the API.
 * Returns 404 in production. Use this to confirm your .env.local
 * CLOUDINARY_* vars are correct before testing registration.
 */

import { NextResponse } from 'next/server';
import { cloudinary }   from '@/lib/cloudinary';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cloudName  = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey     = process.env.CLOUDINARY_API_KEY;
  const apiSecret  = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({
      ok:      false,
      error:   'Missing env vars',
      missing: [
        !cloudName  && 'CLOUDINARY_CLOUD_NAME',
        !apiKey     && 'CLOUDINARY_API_KEY',
        !apiSecret  && 'CLOUDINARY_API_SECRET',
      ].filter(Boolean),
    }, { status: 500 });
  }

  try {
    const result = await cloudinary.api.ping();
    return NextResponse.json({
      ok:         true,
      status:     result.status,
      cloud_name: cloudName,
      api_key:    apiKey.slice(0, 6) + '…' + apiKey.slice(-4),
    });
  } catch (err: unknown) {
    const e = err as { message?: string; http_code?: number };
    return NextResponse.json({
      ok:        false,
      http_code: e.http_code,
      error:     e.message,
      cloud_name: cloudName,
      hint: e.http_code === 401
        ? 'API key or secret is wrong — check your Cloudinary dashboard'
        : e.http_code === 403
        ? 'Account access forbidden — check upload permissions in Cloudinary settings'
        : 'Network or config error',
    }, { status: 502 });
  }
}
