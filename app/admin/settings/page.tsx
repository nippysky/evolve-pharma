/**
 * Console · Settings (ADMIN only).
 *
 * Server component — reads persisted settings from DB and hydrates the form.
 * Uses raw SQL so it works before `prisma generate` is re-run after schema change.
 */

import { redirect }    from 'next/navigation';
import { getSession }  from '@/lib/auth';
import { db }          from '@/lib/db';
import { PageHead }    from '@/components/shared/PageHead';
import { SITE }        from '@/lib/constants';
import { SettingsForm } from './SettingsForm';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session)                 redirect('/staff/sign-in');
  if (session.role !== 'ADMIN') redirect('/admin/overview');

  // Ensure table exists + load persisted settings
  let saved: Record<string, string> = {};
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS app_settings (
        \`key\`     VARCHAR(100) NOT NULL PRIMARY KEY,
        \`value\`   TEXT         NOT NULL,
        updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const rows = await db.$queryRaw<Array<{ key: string; value: string }>>`
      SELECT \`key\`, \`value\` FROM app_settings
    `;
    for (const r of rows) saved[r.key] = r.value;
  } catch {
    // If DB is unreachable, fall through to constants defaults
  }

  const defaults = {
    company_name:        saved.company_name        ?? SITE.name,
    company_email:       saved.company_email       ?? SITE.email,
    company_phone:       saved.company_phone       ?? SITE.phone,
    hq_address:          saved.hq_address          ?? SITE.address,
    currency:            saved.currency            ?? 'NGN',
    timezone:            saved.timezone            ?? 'Africa/Lagos',
    email_audit_summary: saved.email_audit_summary ?? 'true',
    auto_logout:         saved.auto_logout         ?? 'true',
  };

  return (
    <>
      <PageHead
        title="Settings"
        subtitle="Company information and security preferences."
      />
      <SettingsForm defaults={defaults} />
    </>
  );
}
