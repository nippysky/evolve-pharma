/**
 * PATCH /api/customers/[id]/assign-staff
 *
 * Assigns (or unassigns) a customer to a specific staff member.
 * Admin-only. The assigned staff user must have role = STAFF.
 *
 * Body:  { staff_user_id: number | null }
 *
 * NOTE: requires the `assigned_staff_id` column on the `customers` table.
 * Apply prisma/migrations/manual/add_assigned_staff_to_customers.sql first.
 */
import { NextRequest } from 'next/server';
import { z }           from 'zod';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';
import { writeAuditLog }       from '@/lib/audit';
import { revalidateCustomers } from '@/lib/revalidate';

const schema = z.object({
  /** Pass null to remove the assignment */
  staff_user_id: z.number().int().positive().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session)                return apiUnauthorized();
    if (session.role !== 'ADMIN') return apiForbidden('Only admins can assign customers to staff.');

    const { id }     = await params;
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) return apiNotFound('Customer');

    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Invalid body', 400);

    const { staff_user_id } = parsed.data;

    // Verify customer exists
    const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) return apiNotFound('Customer');

    // Verify staff exists and has STAFF role (if not null)
    if (staff_user_id !== null) {
      const staffUser = await db.user.findUnique({
        where:  { id: staff_user_id },
        select: { id: true, role: true, first_name: true, last_name: true },
      });
      if (!staffUser || staffUser.role !== 'STAFF') {
        return apiError('User not found or is not a staff member.', 404);
      }
    }

    // Update via raw SQL since Prisma types may not include assigned_staff_id yet
    await db.$executeRaw`
      UPDATE customers
      SET    assigned_staff_id = ${staff_user_id}
      WHERE  id = ${customerId}
    `;

    // Fetch updated customer for response
    const updated = await db.$queryRaw<Array<{
      assigned_staff_id: number | null;
    }>>`
      SELECT assigned_staff_id FROM customers WHERE id = ${customerId}
    `;

    let assignedStaff: { id: number; first_name: string; last_name: string; email: string } | null = null;
    if (staff_user_id !== null) {
      const u = await db.user.findUnique({
        where:  { id: staff_user_id },
        select: { id: true, first_name: true, last_name: true, email: true },
      });
      if (u) assignedStaff = u;
    }

    await writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      'CUSTOMER_ASSIGN_STAFF',
      entityType:  'Customer',
      entityId:    String(customerId),
      description: `Assigned customer #${customerId} to staff user #${staff_user_id ?? 'none'}`,
    });

    revalidateCustomers();

    return apiSuccess({
      customer_id:    customerId,
      assigned_staff: assignedStaff,
    });

  } catch (err) {
    console.error('[PATCH /api/customers/[id]/assign-staff]', err);
    return apiInternalError();
  }
}
