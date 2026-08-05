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
  handlePrismaError,
} from '@/lib/api/response';
import { writeAuditLog } from '@/lib/audit';
import { sendCustomerApprovalEmail, sendCustomerRejectionEmail } from '@/lib/mail';

const schema = z.object({
  decision:    z.enum(['approve', 'reject']),
  review_note: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();
    if (!['ADMIN', 'STAFF'].includes(session.role)) return apiForbidden();

    const { id } = await params;
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) return apiNotFound('Customer');

    const customer = await db.customer.findUnique({
      where:   { id: customerId },
      include: { user: { select: { first_name: true, last_name: true, email: true } } },
    });
    if (!customer) return apiNotFound('Customer');

    // Staff can only action PENDING_REVIEW customers.
    // Admins can additionally re-review APPROVED or REJECTED customers.
    const reviewableByStaff  = customer.status === 'PENDING_REVIEW';
    const reviewableByAdmin  = ['PENDING_REVIEW', 'APPROVED', 'REJECTED'].includes(customer.status);
    const canReview          = session.role === 'ADMIN' ? reviewableByAdmin : reviewableByStaff;

    if (!canReview) {
      return apiError(
        session.role === 'ADMIN'
          ? `Cannot review a customer with status ${customer.status}.`
          : `Staff members can only review customers in PENDING_REVIEW status. This customer is ${customer.status}.`,
        422,
      );
    }

    let body: unknown;
    try { body = await req.json(); }
    catch { return apiError('Invalid JSON body', 400); }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const [field, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        errors[field] = msgs as string[];
      }
      return apiError('Please review the fields below.', 422, errors);
    }

    const { decision, review_note } = parsed.data;

    if (decision === 'reject' && !review_note?.trim()) {
      return apiError('A review note is required when rejecting an account.', 422, {
        review_note: ['Review note is required for rejection'],
      });
    }

    const newStatus = decision === 'approve' ? 'APPROVED' : 'REJECTED';

    await db.customer.update({
      where: { id: customerId },
      data:  {
        status:          newStatus,
        // Mark PCN as verified when approving, un-mark on rejection.
        pcn_verified:    decision === 'approve',
        review_note:     review_note ?? null,
        reviewed_by_id:  session.userId,
        reviewed_at:     new Date(),
      },
    });

    const name = `${customer.user.first_name} ${customer.user.last_name}`;

    if (decision === 'approve') {
      void sendCustomerApprovalEmail({
        to:   customer.user.email,
        name: customer.user.first_name,
      }).catch((e) => console.error('[review] approval email failed:', e));
    } else {
      void sendCustomerRejectionEmail({
        to:         customer.user.email,
        name:       customer.user.first_name,
        reviewNote: review_note ?? 'No reason provided.',
      }).catch((e) => console.error('[review] rejection email failed:', e));
    }

    void writeAuditLog({
      userId:      session.userId,
      userType:    session.role,
      userName:    `${session.first_name} ${session.last_name}`,
      email:       session.email,
      action:      decision === 'approve' ? 'APPROVE_CUSTOMER' : 'REJECT_CUSTOMER',
      entityType:  'Customer',
      entityId:    String(customerId),
      description: `${decision === 'approve' ? 'Approved' : 'Rejected'} customer ${name} (${customer.user.email})${review_note ? `: ${review_note}` : ''}`,
      req,
    });

    return apiSuccess(
      { customer_id: customerId, status: newStatus },
      200,
      `Customer ${decision === 'approve' ? 'approved' : 'rejected'} successfully`,
    );
  } catch (err) {
    console.error('[PATCH /api/customers/[id]/review]', err);
    return handlePrismaError(err) ?? apiInternalError();
  }
}
