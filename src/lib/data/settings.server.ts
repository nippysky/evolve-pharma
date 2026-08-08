import { db } from '@/lib/db';

export interface VatSettings {
  enabled: boolean;
  /** Decimal rate e.g. 0.075 for 7.5% */
  rate: number;
}

export interface ReferralSettings {
  /** Minimum total purchase (kobo/naira) by a referee to trigger reward */
  threshold: number;
  /** Naira amount credited to the referrer when threshold is reached */
  reward: number;
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
      WHERE \`key\` IN ('referral_threshold', 'referral_reward')
    `;
    const m: Record<string, string> = {};
    for (const r of rows) m[r.key] = r.value;

    return {
      threshold: Math.max(1, parseFloat(m.referral_threshold ?? '500000')),
      reward:    Math.max(0, parseFloat(m.referral_reward    ?? '500')),
    };
  } catch {
    return { threshold: 500000, reward: 500 };
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
