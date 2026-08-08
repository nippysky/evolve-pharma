/**
 * referral-reward.ts
 *
 * When a referee's total paid purchases cross the admin-configured threshold
 * (default ₦500,000), their referrer earns a configurable cash reward
 * (default ₦500), credited as referral_points.
 *
 * Idempotent: each referee can only trigger the reward once.
 * The `referral_threshold_awarded` column (TINYINT on customers) tracks this.
 *
 * Apply prisma/migrations/manual/add_referral_threshold_awarded.sql first.
 */

import { db }                   from '@/lib/db';
import { getReferralSettings }  from '@/lib/data/settings.server';
import { writeAuditLog }        from '@/lib/audit';

type RawRow = { referral_threshold_awarded: number };
type SumRow = { total_spend: string | null };

/**
 * Called after any order is marked PAID.
 *
 * @param customerId  The customer whose payment was just confirmed.
 */
export async function checkAndAwardReferralReward(customerId: number): Promise<void> {
  try {
    // 1. Load the customer's referred_by and the threshold-awarded flag
    const rows = await db.$queryRaw<Array<{
      referred_by:                  string | null;
      referral_threshold_awarded:   number;
    }>>`
      SELECT referred_by, referral_threshold_awarded
      FROM customers
      WHERE id = ${customerId}
    `;

    const customer = rows[0];
    if (!customer) return;

    // Only proceed if:
    //  a) this customer was referred by someone
    //  b) the reward hasn't been awarded yet
    if (!customer.referred_by || customer.referral_threshold_awarded) return;

    // 2. Load the threshold + reward from admin settings
    const settings = await getReferralSettings();

    // 3. Compute this customer's total paid spend (all time)
    const spendRows = await db.$queryRaw<SumRow[]>`
      SELECT CAST(SUM(total) AS CHAR) AS total_spend
      FROM orders
      WHERE customer_id    = ${customerId}
        AND payment_status = 'PAID'
        AND status        != 'CANCELLED'
    `;
    const totalSpend = parseFloat(spendRows[0]?.total_spend ?? '0') || 0;

    // 4. Check threshold
    if (totalSpend < settings.threshold) return;

    // 5. Find the referrer by their referral_code
    const referrerRows = await db.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM customers WHERE referral_code = ${customer.referred_by} LIMIT 1
    `;
    const referrerId = referrerRows[0]?.id;
    if (!referrerId) return;

    // 6. Award the reward to the referrer (atomic increment)
    const rewardPoints = Math.round(settings.reward); // stored as integer naira
    await db.$executeRaw`
      UPDATE customers
      SET referral_points = referral_points + ${rewardPoints}
      WHERE id = ${referrerId}
    `;

    // 7. Mark this referee as awarded (idempotent guard)
    await db.$executeRaw`
      UPDATE customers
      SET referral_threshold_awarded = 1
      WHERE id = ${customerId}
    `;

    console.log(
      `[referral-reward] Referee #${customerId} crossed ₦${settings.threshold.toLocaleString()} threshold. ` +
      `Referrer #${referrerId} awarded ₦${rewardPoints}.`,
    );

    // Audit — this credits real value to an account with no human involved,
    // so it needs a permanent trail, not just a server log.
    writeAuditLog({
      userType:    'SYSTEM',
      userName:    'Referral Engine',
      action:      'REFERRAL_REWARD_AWARDED',
      entityType:  'Customer',
      entityId:    String(referrerId),
      description: `Referrer #${referrerId} credited ₦${rewardPoints.toLocaleString('en-NG')} ` +
                   `after referee #${customerId} reached ₦${settings.threshold.toLocaleString('en-NG')} ` +
                   `total paid spend (actual: ₦${totalSpend.toLocaleString('en-NG')}). ` +
                   `Referral code: ${customer.referred_by}.`,
    });

  } catch (err) {
    // Never throw — payment processing must not be blocked by referral logic.
    console.error('[referral-reward] checkAndAwardReferralReward error', err);
  }
}
