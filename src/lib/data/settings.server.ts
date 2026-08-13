import { db } from '@/lib/db';

export interface VatSettings {
  enabled: boolean;
  /** Decimal rate e.g. 0.075 for 7.5% */
  rate: number;
}

/**
 * Referral programme terms.
 *
 * All monetary values are NAIRA. The wallet these feed
 * (`Customer.referral_points`) is naira too — it is not a dimensionless point
 * balance, despite the column name.
 */
export interface ReferralSettings {
  /** Credited to the referrer the moment a pharmacy signs up with their code. */
  signupBonus: number;
  /** Paid orders a referee must accumulate before the second award fires. */
  threshold: number;
  /** Credited to the referrer once that threshold is crossed. */
  reward: number;
  /**
   * Whether customers may spend their balance against an order.
   *
   * Defaults to FALSE. Earning runs from day one so balances accrue, but
   * spending stays closed until the business decides to open it — flipping
   * this on is a commercial decision, not a technical one.
   */
  redemptionEnabled: boolean;
  /** Balance a customer must reach before any of it can be spent. */
  minRedemption: number;
}

/**
 * Which customers a STAFF member may place an order on behalf of.
 *   'ALL'      → any active customer (default — covers emergencies/cover)
 *   'ASSIGNED' → only customers assigned to them via assigned_staff_id
 * Admins are never restricted by this setting.
 */
export type StaffOrderScope = 'ALL' | 'ASSIGNED';

/**
 * Read VAT configuration from app_settings.
 * Falls back to enabled=FALSE / 7.5% — VAT disabled by default per pharmaceutical requirement.
 */
export async function getVatSettings(): Promise<VatSettings> {
  try {
    const rows = await db.$queryRaw<Array<{ key: string; value: string }>>`
      SELECT \`key\`, \`value\` FROM app_settings
      WHERE \`key\` IN ('vat_enabled', 'vat_rate')
    `;
    const m: Record<string, string> = {};
    for (const r of rows) m[r.key] = r.value;

    // Default: disabled (pharmaceutical companies are often VAT-exempt on drugs)
    const enabled = m.vat_enabled === 'true';
    const rate    = Math.max(0, parseFloat(m.vat_rate ?? '7.5')) / 100;
    return { enabled, rate };
  } catch {
    return { enabled: false, rate: 0.075 };
  }
}

/**
 * Read referral reward settings from app_settings.
 */
export async function getReferralSettings(): Promise<ReferralSettings> {
  try {
    const rows = await db.$queryRaw<Array<{ key: string; value: string }>>`
      SELECT \`key\`, \`value\` FROM app_settings
      WHERE \`key\` IN (
        'referral_threshold', 'referral_reward', 'referral_signup_bonus',
        'referral_redemption_enabled', 'referral_min_redemption'
      )
    `;
    const m: Record<string, string> = {};
    for (const r of rows) m[r.key] = r.value;

    return {
      // ₦100 matches the flat award the platform has paid on signup since
      // launch; it was previously stored as a dimensionless 100 and is now
      // stated in the unit it always effectively was.
      signupBonus:       Math.max(0, parseFloat(m.referral_signup_bonus ?? '100')),
      threshold:         Math.max(1, parseFloat(m.referral_threshold    ?? '500000')),
      reward:            Math.max(0, parseFloat(m.referral_reward       ?? '500')),
      // Closed until the business opens it.
      redemptionEnabled: m.referral_redemption_enabled === 'true',
      minRedemption:     Math.max(0, parseFloat(m.referral_min_redemption ?? '0')),
    };
  } catch {
    return {
      signupBonus: 100, threshold: 500000, reward: 500,
      redemptionEnabled: false, minRedemption: 0,
    };
  }
}

/**
 * Read the staff on-behalf ordering scope.
 * Defaults to 'ALL' so staff aren't blocked during emergencies or cover.
 * Flip to 'ASSIGNED' in admin settings to restrict them to their own book.
 */
export async function getStaffOrderScope(): Promise<StaffOrderScope> {
  try {
    const rows = await db.$queryRaw<Array<{ key: string; value: string }>>`
      SELECT \`key\`, \`value\` FROM app_settings
      WHERE \`key\` = 'staff_order_scope'
    `;
    return rows[0]?.value === 'ASSIGNED' ? 'ASSIGNED' : 'ALL';
  } catch {
    return 'ALL';
  }
}
