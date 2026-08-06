import { NextRequest }          from 'next/server';
import { z }                    from 'zod';
import bcrypt                   from 'bcryptjs';
import { db }                   from '@/lib/db';
import { verifySetupToken }     from '@/lib/jwt';
import { sendStaffActivationEmail } from '@/lib/mail';
import {
  apiSuccess,
  apiError,
  apiInternalError,
  handlePrismaError,
} from '@/lib/api/response';

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  token:    z.string().min(1, 'Setup token is required'),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const [f, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        errors[f] = msgs as string[];
      }
      return apiError('Please review the fields below.', 422, errors);
    }

    const { password, token } = parsed.data;

    // Verify setup token
    const payload = await verifySetupToken(token);
    if (!payload) {
      return apiError('Your session has expired. Please ask your administrator to resend the invitation.', 401);
    }

    // Find user
    const user = await db.user.findUnique({
      where:  { id: payload.userId },
      select: { id: true, role: true, first_name: true },
    });
    if (!user || !['STAFF', 'DRIVER', 'ADMIN'].includes(user.role)) {
      return apiError('Account not found.', 404);
    }

    // Hash + set password, activate account
    const password_hash = await bcrypt.hash(password, 12);

    const ops: any[] = [
      db.user.update({
        where: { id: user.id },
        data:  { password_hash, status: 'ACTIVE' },
      }),
    ];
    // Mark staff as VERIFIED (STAFF role only; DRIVER has no verification_status)
    if (user.role === 'STAFF') {
      ops.push(
        db.staff.updateMany({
          where: { user_id: user.id },
          data:  { verification_status: 'VERIFIED' },
        }),
      );
    }
    await db.$transaction(ops);

    try {
      await sendStaffActivationEmail({
        to:   payload.email,
        name: user.first_name,
      });
    } catch (mailErr) {
      console.error('[staff/create-password] activation email failed:', mailErr);
    }

    return apiSuccess(
      { email: payload.email },
      200,
      'Account activated. You can now sign in.',
    );
  } catch (err) {
    console.error('[POST /api/auth/staff/create-password]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
