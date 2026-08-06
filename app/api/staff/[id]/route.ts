import { NextRequest } from 'next/server';
import { z }           from 'zod';
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
import { writeAuditLog }   from '@/lib/audit';
import { revalidateStaff } from '@/lib/revalidate';

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession(req);
    if (!session)                    return apiUnauthorized();
    if (session.role !== 'ADMIN')    return apiForbidden();

    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id < 1) return apiError('Invalid staff ID', 400);
    if (id === session.userId) return apiError('You cannot change your own account status.', 400);

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return apiError('status must be ACTIVE or INACTIVE', 400);

    const user = await db.user.findFirst({
      where:  { id, role: { in: ['STAFF', 'DRIVER'] } },
      select: { id: true, first_name: true, last_name: true, email: true, role: true, status: true },
    });
    if (!user) return apiError('Staff member not found.', 404);

    if (user.status === parsed.data.status) {
      return apiSuccess({ id, status: user.status }, 200, 'No change — status already set.');
    }

    await db.user.update({ where: { id }, data: { status: parsed.data.status } });

    const action = parsed.data.status === 'INACTIVE' ? 'DISABLE_STAFF' : 'ENABLE_STAFF';
    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action,
      entityType:  'User',
      entityId:    String(id),
      description: `${parsed.data.status === 'INACTIVE' ? 'Disabled' : 'Re-enabled'} ${user.role.toLowerCase()} account: ${user.first_name} ${user.last_name} (${user.email})`,
      req,
    });

    revalidateStaff();
    return apiSuccess(
      { id, status: parsed.data.status },
      200,
      parsed.data.status === 'INACTIVE'
        ? 'Account disabled. The staff member can no longer sign in.'
        : 'Account re-enabled. The staff member can now sign in.',
    );
  } catch (err) {
    console.error('[PATCH /api/staff/[id]]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession(req);
    if (!session)                 return apiUnauthorized();
    if (session.role !== 'ADMIN') return apiForbidden();

    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id < 1) return apiError('Invalid staff ID', 400);

    if (id === session.userId) return apiError('You cannot delete your own account.', 400);

    const user = await db.user.findFirst({
      where:  { id, role: { in: ['STAFF', 'DRIVER'] } },
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
      entityType:  'User',
      entityId:    String(id),
      description: `Deleted ${user.role} account: ${user.first_name} ${user.last_name} (${user.email})`,
      req,
    });

    revalidateStaff();
    return apiSuccess(null, 200, 'Staff member deleted successfully.');
  } catch (err) {
    console.error('[DELETE /api/staff/[id]]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
