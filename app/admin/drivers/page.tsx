/**
 * Admin — Drivers
 * Live data wired in Module 6.
 */

import { redirect }  from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead }   from '@/components/shared/PageHead';
import { EmptyState } from '@/components/ui/Primitives';
import { Truck }      from '@/components/icons';

export const metadata = { title: 'Drivers' };

export default async function AdminDriversPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role !== 'ADMIN') redirect('/admin/overview');

  return (
    <>
      <PageHead title="Drivers" subtitle="Manage your driver team and assignments." />
      <EmptyState
        icon={<Truck size={24} />}
        title="No drivers registered"
        description="Driver accounts created from the staff sign-up flow will appear here."
      />
    </>
  );
}
