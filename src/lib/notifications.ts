/**
 * notifications.ts
 *
 * In-app notification emitters.
 *
 * Every function here is fire-and-forget and never throws. A notification is a
 * side effect of something more important — placing an order, confirming a
 * payment — and must never be able to fail that operation. Callers use
 * `void notifyX(...)` and carry on.
 *
 * Delivery is in-app only; transactional email is handled separately in
 * lib/mail.ts. The two are deliberately independent.
 */

import { db } from '@/lib/db';

export type NotificationType =
  | 'order'
  | 'payment'
  | 'delivery'
  | 'account'
  | 'referral'
  | 'system';

interface NotifyInput {
  title: string;
  body:  string;
  type:  NotificationType;
  /** In-app destination, e.g. "/portal/orders/12". */
  link?: string | null;
}

/**
 * Send a notification to one user, by user id.
 *
 * Uses raw SQL rather than the Prisma model so the helper keeps working
 * whether or not the client has been regenerated since `link` was added.
 */
export async function notifyUser(userId: number, input: NotifyInput): Promise<void> {
  try {
    await db.$executeRaw`
      INSERT INTO notifications (user_id, title, body, type, link, is_read, created_at)
      VALUES (${userId}, ${input.title.slice(0, 255)}, ${input.body}, ${input.type},
              ${input.link ?? null}, 0, NOW())
    `;
  } catch (err) {
    console.error('[notifications] notifyUser failed', err);
  }
}

/**
 * Send a notification to the user behind a customer record.
 * Accepts a customer id and resolves the linked user itself, so callers that
 * only hold `customer_id` don't have to do the lookup.
 */
export async function notifyCustomer(customerId: number, input: NotifyInput): Promise<void> {
  try {
    const customer = await db.customer.findUnique({
      where:  { id: customerId },
      select: { user_id: true },
    });
    if (!customer) return;
    await notifyUser(customer.user_id, input);
  } catch (err) {
    console.error('[notifications] notifyCustomer failed', err);
  }
}

/**
 * Fan out to every active internal user holding one of the given roles.
 * Used for operational alerts — a new order, a customer awaiting review.
 */
export async function notifyRoles(
  roles: Array<'ADMIN' | 'STAFF' | 'DRIVER'>,
  input: NotifyInput,
): Promise<void> {
  try {
    const users = await db.user.findMany({
      where:  { role: { in: roles }, status: 'ACTIVE' },
      select: { id: true },
    });
    if (users.length === 0) return;

    // Single multi-row INSERT rather than one statement per recipient.
    // Serverless runs a connection pool of 1, so N inserts means N serialised
    // round trips on the hot path of placing an order. This keeps it at one
    // regardless of team size.
    const title  = input.title.slice(0, 255);
    const link   = input.link ?? null;
    const values = users.map(() => '(?, ?, ?, ?, ?, 0, NOW())').join(', ');
    const params = users.flatMap(u => [u.id, title, input.body, input.type, link]);

    await db.$executeRawUnsafe(
      `INSERT INTO notifications (user_id, title, body, type, link, is_read, created_at)
       VALUES ${values}`,
      ...params,
    );
  } catch (err) {
    console.error('[notifications] notifyRoles failed', err);
  }
}

/**
 * Notify the staff member who owns a customer account, falling back to all
 * admins when the customer has no assigned rep. Keeps operational alerts
 * targeted instead of spamming the whole team.
 *
 * `assigned_staff_id` is queried raw — it is a real schema column, but this
 * keeps the helper resilient if the column is missing on an older database.
 */
export async function notifyAssignedStaffOrAdmins(
  customerId: number,
  input: NotifyInput,
): Promise<void> {
  try {
    const rows = await db.$queryRaw<Array<{ assigned_staff_id: number | null }>>`
      SELECT assigned_staff_id FROM customers WHERE id = ${customerId}
    `;
    const staffId = rows[0]?.assigned_staff_id;

    if (staffId) {
      await notifyUser(staffId, input);
      return;
    }
    await notifyRoles(['ADMIN'], input);
  } catch (err) {
    console.error('[notifications] notifyAssignedStaffOrAdmins failed', err);
  }
}

/**
 * Notify a customer AND whoever handles their account, from a single lookup.
 *
 * Calling notifyCustomer() and notifyAssignedStaffOrAdmins() separately costs
 * two resolutions of the same customer row. On serverless (connection pool of
 * 1) those queue on one connection, so on hot paths like the payment webhook
 * it is worth resolving once and reusing.
 */
export async function notifyCustomerAndOwner(
  customerId: number,
  customerInput: NotifyInput,
  ownerInput:    NotifyInput,
): Promise<void> {
  try {
    const rows = await db.$queryRaw<Array<{ user_id: number; assigned_staff_id: number | null }>>`
      SELECT user_id, assigned_staff_id FROM customers WHERE id = ${customerId} LIMIT 1
    `;
    const row = rows[0];
    if (!row) return;

    await notifyUser(row.user_id, customerInput);

    if (row.assigned_staff_id) {
      await notifyUser(row.assigned_staff_id, ownerInput);
    } else {
      await notifyRoles(['ADMIN'], ownerInput);
    }
  } catch (err) {
    console.error('[notifications] notifyCustomerAndOwner failed', err);
  }
}
