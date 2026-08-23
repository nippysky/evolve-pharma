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
 *
 * Everything goes through the typed Prisma client. An earlier version wrote
 * raw INSERTs on the theory that the generated client might not know about the
 * `link` column — but `link` and `assigned_staff_id` are both declared in
 * schema.prisma, so the client always has them and the raw SQL only cost us
 * type safety. `notifyRoles` in particular was building a SQL string by hand
 * and passing it to $executeRawUnsafe; createMany does the same single
 * multi-row INSERT with none of that risk.
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

/** `title` is VarChar(255) — truncate rather than let the driver reject the row. */
function row(userId: number, input: NotifyInput) {
  return {
    user_id: userId,
    title:   input.title.slice(0, 255),
    body:    input.body,
    type:    input.type,
    link:    input.link ?? null,
    is_read: false,
  };
}

/** Send a notification to one user, by user id. */
export async function notifyUser(userId: number, input: NotifyInput): Promise<void> {
  try {
    await db.notification.create({ data: row(userId, input) });
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

    // One multi-row INSERT rather than one statement per recipient. Serverless
    // runs a connection pool of 1, so N inserts means N serialised round trips
    // on the hot path of placing an order. This stays at one regardless of
    // team size.
    await db.notification.createMany({
      data: users.map(u => row(u.id, input)),
    });
  } catch (err) {
    console.error('[notifications] notifyRoles failed', err);
  }
}

/**
 * Notify the staff member who owns a customer account, falling back to all
 * admins when the customer has no assigned rep. Keeps operational alerts
 * targeted instead of spamming the whole team.
 */
export async function notifyAssignedStaffOrAdmins(
  customerId: number,
  input: NotifyInput,
): Promise<void> {
  try {
    const customer = await db.customer.findUnique({
      where:  { id: customerId },
      select: { assigned_staff_id: true },
    });

    if (customer?.assigned_staff_id) {
      await notifyUser(customer.assigned_staff_id, input);
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
    const customer = await db.customer.findUnique({
      where:  { id: customerId },
      select: { user_id: true, assigned_staff_id: true },
    });
    if (!customer) return;

    if (customer.assigned_staff_id) {
      // Both recipients are known, so this is a single multi-row INSERT.
      await db.notification.createMany({
        data: [
          row(customer.user_id, customerInput),
          row(customer.assigned_staff_id, ownerInput),
        ],
      });
      return;
    }

    await notifyUser(customer.user_id, customerInput);
    await notifyRoles(['ADMIN'], ownerInput);
  } catch (err) {
    console.error('[notifications] notifyCustomerAndOwner failed', err);
  }
}
