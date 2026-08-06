import { NextRequest }   from 'next/server';
import { v4 as uuidv4 }  from 'uuid';
import { db }             from '@/lib/db';
import { getSession }     from '@/lib/auth';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
  handlePrismaError,
} from '@/lib/api/response';
import { sendStaffVerificationEmail } from '@/lib/mail';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const { id: idStr } = await params;
    const userId = parseInt(idStr, 10);
    if (isNaN(userId) || userId < 1) return apiError('Invalid staff ID', 400);

    // Fetch user — must be STAFF or DRIVER role and must NOT be verified yet
    const user = await db.user.findFirst({
      where: { id: userId, role: { in: ['STAFF', 'DRIVER'] } },
      select: {
        id:         true,
        first_name: true,
        email:      true,
        role:       true,
        staff:      { select: { verification_status: true } },
      },
    });

    if (!user) return apiNotFound('Staff member');

    // Prevent resend if already verified
    if (user.staff?.verification_status === 'VERIFIED') {
      return apiError('This staff member has already verified their email.', 400);
    }

    // Invalidate all existing EMAIL_VERIFICATION tokens for this user
    await db.otpToken.updateMany({
      where: {
        user_id:  userId,
        type:     'EMAIL_VERIFICATION',
        used_at:  null,
      },
      data: { used_at: new Date() },
    });

    // Create a fresh 24-hour token
    const verifyToken = uuidv4();
    const expiresAt   = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.otpToken.create({
      data: {
        user_id:    userId,
        token:      verifyToken,
        type:       'EMAIL_VERIFICATION',
        expires_at: expiresAt,
      },
    });

    const frontendUrl     = process.env.FRONTEND_URL ?? 'https://www.envolvepharm.com.ng';
    const verificationUrl = `${frontendUrl}/staff/verify?token=${verifyToken}`;

    try {
      await sendStaffVerificationEmail({
        to:              user.email,
        name:            user.first_name,
        verificationUrl,
      });
    } catch (mailErr) {
      console.error('[resend-invite] email failed:', mailErr);
      return apiError('Staff record updated but the email failed to send. Check SMTP configuration.', 500);
    }

    return apiSuccess(
      { user_id: userId, email: user.email },
      200,
      'Invitation resent successfully.',
    );
  } catch (err) {
    console.error('[POST /api/staff/[id]/resend-invite]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
