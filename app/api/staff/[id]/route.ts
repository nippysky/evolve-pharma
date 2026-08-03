/**
 * DELETE /api/staff/[id] — remove a staff or driver account (Admin only)
 *
 * Hard-deletes the user record (cascades to staff/driver tables via schema).
 * Logs the action to the audit trail.
 */

import { NextRequest } from 'next/server';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiInternalError,
  handlePrismaError,
} from '@/lib/api/response';
import { writeAuditLog } from '@/lib/audit';

export async function DELETE(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session)               return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id < 1) return apiError('Invalid staff ID', 400);

    // Prevent self-deletion
    if (id === session.userId) return apiError('You cannot delete your own account.', 400);

    const user = await db.user.findFirst({
      where: { id, role: { in: ['STAFF', 'DRIVER'] } },
      select: { id: true, first_name: true, last_name: true, email: true, role: true },
    });
    if (!user) return apiError('Staff member not found.', 404);

    await db.user.delete({ where: { id } });

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'DELETE_STAFF',
      description: `Deleted ${user.role} account: ${user.first_name} ${user.last_name} (${user.email})`,
      req,
    });

    return apiSuccess(null, 200, 'Staff member deleted successfully.');
  } catch (err) {
    console.error('[DELETE /api/staff/[id]]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
