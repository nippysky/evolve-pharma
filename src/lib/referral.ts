import { db }                  from '@/lib/db';
import { getReferralSettings } from '@/lib/data/settings.server';
import { notifyCustomer }      from '@/lib/notifications';
import { revalidateProfile }   from '@/lib/revalidate';

/**
 * Referral credit — earning, holding and spending.
 *
 * ## The unit
 *
 * `Customer.referral_points` is **naira**, not dimensionless points. It used to
 * be both at once: signup awarded a flat `100` while crossing the spend
 * threshold awarded `settings.reward` (₦500), and the two were summed into one
 * column. That made the balance impossible to render honestly and impossible to
 * spend. Everything here credits and debits naira.
 *
 * ## The ledger
 *
 * This balance is money the customer can put against an order, so nothing
 * writes it without also writing a `ReferralLedger` row. The balance column is
 * a cache; the ledger is the record. That's what lets anyone answer "where did
 * this come from?" months later, and what makes a disputed redemption
 * resolvable.
 *
 * ## Idempotency
 *
 *   • **Signup bonus** — guarded by the ledger itself. A `SIGNUP_BONUS` row
 *     already naming that referee means it's been paid.
 *   • **Spend threshold** — guarded by a conditional update on the referee's
 *     `referral_threshold_awarded` flag, so two concurrent payment webhooks
 *     settle to exactly one award.
 */

export type LedgerType =
  | 'SIGNUP_BONUS'
  | 'SPEND_THRESHOLD'
  | 'REDEEMED'
  | 'ADJUSTMENT'
  | 'REVERSAL';

export interface ReferralWallet {
  /** Naira available to spend. */
  balance: number;
  /** Whether the business currently allows spending it. */
  redemption_enabled: boolean;
  /** Minimum balance before any redemption is permitted. */
  min_redemption: number;
  /** Naira the customer could actually apply to an order right now. */
  redeemable: number;
}

export interface LedgerEntry {
  id:            number;
  delta:         number;
  balance_after: number;
  type:          LedgerType;
  description:   string;
  order_id:      number | null;
  created_at:    string;
}

/**
 * Move credit and record why.
 *
 * The balance update uses `{ increment }` rather than a read-then-write, so
 * concurrent movements can't clobber each other. Debits go through
 * `updateMany` with the balance in the `where` clause: that makes the
 * sufficient-funds check part of the same statement as the deduction, so the
 * database refuses an overdraft rather than application code losing a race.
 *
 * Returns the new balance, or null when the movement was refused.
 */
export async function moveReferralCredit(params: {
  customerId:  number;
  /** Signed naira. Positive credits, negative debits. */
  delta:       number;
  type:        LedgerType;
  description: string;
  relatedCustomerId?: number;
  orderId?:    number;
}): Promise<number | null> {
  const { customerId, delta, type, description, relatedCustomerId, orderId } = params;
  if (!Number.isFinite(delta) || delta === 0) return null;

  const amount = Math.round(delta);

  try {
    return await db.$transaction(async tx => {
      const result = await tx.customer.updateMany({
        where: {
          id: customerId,
          // Only constrain the balance on a debit. `gte: -amount` reads as
          // "at least this much available" — for a credit it would be a
          // nonsense condition, so it's omitted.
          ...(amount < 0 ? { referral_points: { gte: -amount } } : {}),
        },
        data: { referral_points: { increment: amount } },
      });

      if (result.count === 0) return null;

      const customer = await tx.customer.findUnique({
        where:  { id: customerId },
        select: { referral_points: true },
      });
      const balanceAfter = customer?.referral_points ?? 0;

      await tx.referralLedger.create({
        data: {
          customer_id:         customerId,
          delta:               amount,
          balance_after:       balanceAfter,
          type,
          description,
          related_customer_id: relatedCustomerId ?? null,
          order_id:            orderId ?? null,
        },
      });

      return balanceAfter;
    });
  } catch (err) {
    console.error('[referral] moveReferralCredit failed:', err);
    return null;
  }
}

/** Current wallet state, including whether it can be spent right now. */
export async function getReferralWallet(customerId: number): Promise<ReferralWallet> {
  const settings = await getReferralSettings();

  const customer = await db.customer.findUnique({
    where:  { id: customerId },
    select: { referral_points: true },
  });

  const balance = customer?.referral_points ?? 0;
  const enabled = settings.redemptionEnabled;
  const min     = settings.minRedemption;

  return {
    balance,
    redemption_enabled: enabled,
    min_redemption:     min,
    // Below the minimum the balance exists but can't be touched. Report zero
    // redeemable rather than a figure that would be refused at checkout.
    redeemable: enabled && balance >= min ? balance : 0,
  };
}

/** A customer's credit history, newest first. */
export async function getReferralLedger(customerId: number, limit = 50): Promise<LedgerEntry[]> {
  try {
    const rows = await db.referralLedger.findMany({
      where:   { customer_id: customerId },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take:    limit,
      select: {
        id: true, delta: true, balance_after: true,
        type: true, description: true, order_id: true, created_at: true,
      },
    });

    return rows.map(r => ({
      id:            r.id,
      delta:         r.delta,
      balance_after: r.balance_after,
      type:          r.type as LedgerType,
      description:   r.description,
      order_id:      r.order_id,
      created_at:    r.created_at.toISOString(),
    }));
  } catch (err) {
    console.error('[referral] getReferralLedger failed:', err);
    return [];
  }
}

/**
 * Award the signup bonus to a referrer.
 *
 * Idempotent on (referrer, referee) via the ledger, so a retried registration
 * can't pay twice.
 */
export async function awardSignupBonus(params: {
  referrerCustomerId: number;
  refereeCustomerId:  number;
  refereeName:        string;
}): Promise<void> {
  const { referrerCustomerId, refereeCustomerId, refereeName } = params;

  try {
    const settings = await getReferralSettings();
    const bonus    = Math.round(settings.signupBonus);
    if (bonus <= 0) return;

    const existing = await db.referralLedger.findFirst({
      where: {
        customer_id:         referrerCustomerId,
        type:                'SIGNUP_BONUS',
        related_customer_id: refereeCustomerId,
      },
      select: { id: true },
    });
    if (existing) return;

    const balance = await moveReferralCredit({
      customerId:  referrerCustomerId,
      delta:       bonus,
      type:        'SIGNUP_BONUS',
      description: `${refereeName} signed up with your referral code.`,
      relatedCustomerId: refereeCustomerId,
    });
    if (balance === null) return;

    void notifyCustomer(referrerCustomerId, {
      type:  'referral',
      title: 'You earned referral credit',
      body:  `${refereeName} signed up with your code. ₦${bonus.toLocaleString('en-NG')} `
           + `added to your reward balance (now ₦${balance.toLocaleString('en-NG')}).`,
      link:  '/portal/referral',
    });

    revalidateProfile();
  } catch (err) {
    console.error('[referral] awardSignupBonus failed:', err);
  }
}

/**
 * Award the spend-threshold reward once a referee's paid orders cross the
 * configured amount. Called after any order is marked PAID.
 */
export async function checkAndAwardSpendReward(refereeCustomerId: number): Promise<void> {
  try {
    const referee = await db.customer.findUnique({
      where:  { id: refereeCustomerId },
      select: {
        referred_by_customer_id:    true,
        referral_threshold_awarded: true,
        company_name:               true,
        user: { select: { first_name: true, last_name: true } },
      },
    });

    if (!referee?.referred_by_customer_id) return;
    if (referee.referral_threshold_awarded) return;

    const referrerId = referee.referred_by_customer_id;
    const settings   = await getReferralSettings();

    // Total paid spend. `aggregate` keeps this one indexed query instead of
    // pulling every order row back to sum in JavaScript.
    const spend = await db.order.aggregate({
      where: {
        customer_id:    refereeCustomerId,
        payment_status: 'PAID',
        status:         { not: 'CANCELLED' },
      },
      _sum: { total: true },
    });
    const totalSpend = Number(spend._sum.total ?? 0);
    if (totalSpend < settings.threshold) return;

    // Claim the award atomically. `updateMany` with the flag in the `where`
    // means whoever flips it 0 → 1 pays; everyone else sees count === 0 and
    // stops. Claiming before crediting makes a crash cost an unpaid reward
    // rather than a double payment — the safer direction to fail in.
    const claim = await db.customer.updateMany({
      where: { id: refereeCustomerId, referral_threshold_awarded: false },
      data:  { referral_threshold_awarded: true },
    });
    if (claim.count === 0) return;

    const reward = Math.round(settings.reward);
    if (reward <= 0) return;

    const refereeName = referee.company_name
      ?? `${referee.user.first_name} ${referee.user.last_name}`.trim();

    const balance = await moveReferralCredit({
      customerId:  referrerId,
      delta:       reward,
      type:        'SPEND_THRESHOLD',
      description: `${refereeName} reached ₦${settings.threshold.toLocaleString('en-NG')} in paid orders.`,
      relatedCustomerId: refereeCustomerId,
    });

    if (balance === null) {
      // Credit failed after the flag was claimed. Release it so a later payment
      // retries, rather than silently swallowing the reward.
      await db.customer.update({
        where: { id: refereeCustomerId },
        data:  { referral_threshold_awarded: false },
      });
      return;
    }

    void notifyCustomer(referrerId, {
      type:  'referral',
      title: 'Referral reward earned',
      body:  `${refereeName} reached the qualifying spend. `
           + `₦${reward.toLocaleString('en-NG')} added to your reward balance `
           + `(now ₦${balance.toLocaleString('en-NG')}).`,
      link:  '/portal/referral',
    });

    revalidateProfile();
  } catch (err) {
    console.error('[referral] checkAndAwardSpendReward failed:', err);
  }
}

/**
 * How much credit may be applied to an order of this size.
 *
 * Capped at the order subtotal — referral credit is a discount, not a payout,
 * so it can never produce a negative total or pay out the difference.
 */
export function capRedemption(
  requested: number,
  wallet: ReferralWallet,
  subtotal: number,
): number {
  if (!wallet.redemption_enabled) return 0;
  if (wallet.balance < wallet.min_redemption) return 0;
  if (!Number.isFinite(requested) || requested <= 0) return 0;
  return Math.max(0, Math.min(Math.round(requested), wallet.balance, Math.round(subtotal)));
}

/**
 * Spend credit against an order. Returns the amount actually applied.
 *
 * Re-validates against the live wallet, so a balance that moved between
 * quoting and ordering applies less rather than overdrawing.
 */
export async function redeemReferralCredit(params: {
  customerId:  number;
  requested:   number;
  subtotal:    number;
  orderId:     number;
  orderNumber: string;
}): Promise<number> {
  const { customerId, requested, subtotal, orderId, orderNumber } = params;
  if (requested <= 0) return 0;

  const wallet = await getReferralWallet(customerId);
  const amount = capRedemption(requested, wallet, subtotal);
  if (amount <= 0) return 0;

  const balance = await moveReferralCredit({
    customerId,
    delta:       -amount,
    type:        'REDEEMED',
    description: `Applied to order ${orderNumber}.`,
    orderId,
  });

  return balance === null ? 0 : amount;
}

export interface ReferredCustomer {
  id:            number;
  name:          string;
  status:        string;
  joined_at:     string;
  /** Naira this referral has earned the referrer so far. */
  reward_earned: number;
}

/**
 * Pharmacies this customer referred, with where each has got to.
 *
 * Reads through the `referrals` relation, not the code string — a referrer who
 * changed their code would otherwise lose their history.
 *
 * Two queries rather than a join: the list, then one grouped sum of what each
 * referral earned. Grouping in the database keeps it O(1) round trips no matter
 * how many referrals there are.
 */
export async function getReferredCustomers(customerId: number): Promise<ReferredCustomer[]> {
  try {
    const referred = await db.customer.findMany({
      where:   { referred_by_customer_id: customerId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true, company_name: true, status: true, created_at: true,
        user: { select: { first_name: true, last_name: true } },
      },
    });

    if (referred.length === 0) return [];

    const earned = await db.referralLedger.groupBy({
      by:    ['related_customer_id'],
      where: {
        customer_id:         customerId,
        related_customer_id: { in: referred.map(r => r.id) },
        delta:               { gt: 0 },
      },
      _sum: { delta: true },
    });

    const earnedMap = new Map(
      earned.map(e => [e.related_customer_id, e._sum.delta ?? 0]),
    );

    return referred.map(r => ({
      id:            r.id,
      name:          r.company_name ?? `${r.user.first_name} ${r.user.last_name}`.trim(),
      status:        r.status,
      joined_at:     r.created_at.toISOString(),
      reward_earned: earnedMap.get(r.id) ?? 0,
    }));
  } catch (err) {
    console.error('[referral] getReferredCustomers failed:', err);
    return [];
  }
}

/** Who referred this customer, if anyone. */
export async function getReferrer(customerId: number): Promise<{
  id: number; name: string; code: string | null;
} | null> {
  try {
    const customer = await db.customer.findUnique({
      where:  { id: customerId },
      select: {
        referred_by_customer: {
          select: {
            id: true, company_name: true, referral_code: true,
            user: { select: { first_name: true, last_name: true } },
          },
        },
      },
    });

    const r = customer?.referred_by_customer;
    if (!r) return null;

    return {
      id:   r.id,
      name: r.company_name ?? `${r.user.first_name} ${r.user.last_name}`.trim(),
      code: r.referral_code,
    };
  } catch (err) {
    console.error('[referral] getReferrer failed:', err);
    return null;
  }
}
