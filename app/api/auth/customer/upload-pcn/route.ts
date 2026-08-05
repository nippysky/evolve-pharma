import { NextRequest }         from 'next/server';
import { db }                  from '@/lib/db';
import { getSession }          from '@/lib/auth';
import { uploadToCloudinary }  from '@/lib/cloudinary';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
} from '@/lib/api/response';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session)                      return apiUnauthorized();
    if (session.role !== 'CUSTOMER')   return apiForbidden();

    let formData: FormData;
    try { formData = await req.formData(); }
    catch { return apiError('Multipart form data required', 400); }

    const file = formData.get('file') as File | null;
    if (!file) return apiError('No file uploaded', 400);

    const name = file.name.toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.jpg') &&
        !name.endsWith('.jpeg') && !name.endsWith('.png')) {
      return apiError('Only PDF, JPG, or PNG files are accepted', 415);
    }

    if (file.size > 8 * 1024 * 1024) {
      return apiError('File must be under 8 MB', 413);
    }

    // Upload to Cloudinary
    const buffer = Buffer.from(await file.arrayBuffer());
    const isPdf  = name.endsWith('.pdf');
    const result = await uploadToCloudinary(buffer, 'evolve/pcn', {
      resourceType: isPdf ? 'raw' : 'image',
    });

    // Find the customer record and update it
    const user = await db.user.findUnique({
      where:  { id: session.userId },
      select: { id: true, customer: { select: { id: true } } },
    });

    if (!user?.customer) return apiError('Customer record not found', 404);

    await db.customer.update({
      where: { id: user.customer.id },
      data:  { pcn_certificate_url: result.url },
    });

    return apiSuccess({ url: result.url }, 200, 'Certificate uploaded successfully.');
  } catch (err) {
    console.error('[POST /api/auth/customer/upload-pcn]', err);
    return apiInternalError();
  }
}
