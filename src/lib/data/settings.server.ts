import { db } from '@/lib/db';

export interface VatSettings {
  enabled: boolean;
  /** Decimal rate e.g. 0.075 for 7.5% */
  rate: number;
}

/**
 * Read VAT configuration from app_settings.
 * Falls back to enabled=true / 7.5% if the table is missing or unreachable.
 */
export async function getVatSettings(): Promise<VatSettings> {
  try {
    const rows = await db.$queryRaw<Array<{ key: string; value: string }>>`
      SELECT \`key\`, \`value\` FROM app_settings
      WHERE \`key\` IN ('vat_enabled', 'vat_rate')
    `;
    const m: Record<string, string> = {};
    for (const r of rows) m[r.key] = r.value;

    const enabled = (m.vat_enabled ?? 'true') !== 'false';
    const rate    = Math.max(0, parseFloat(m.vat_rate ?? '7.5')) / 100;
    return { enabled, rate };
  } catch {
    return { enabled: true, rate: 0.075 };
  }
}
