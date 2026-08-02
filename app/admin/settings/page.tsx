/**
 * Console · Settings (admin-only).
 *
 * The page itself is a server component that gates access by role.
 * The interactive form lives in `SettingsForm.tsx` (client) and receives
 * its initial values from the shared `SITE` constants on the server.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { SITE } from '@/lib/constants';
import { SettingsForm } from './SettingsForm';

export const metadata = {
  title: 'Settings',
};

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'ADMIN') redirect('/admin/overview');

  return (
    <>
      <PageHead
        title="Settings"
        subtitle="Company information, notification preferences, and security."
      />

      <SettingsForm
        defaults={{
          companyName: SITE.name + ' Ltd.',
          companyEmail: SITE.email,
          companyPhone: SITE.phone,
          headquarters: SITE.address,
        }}
      />
    </>
  );
}