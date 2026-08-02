/**
 * Admin — Deliveries
 * Live data wired in Module 5.
 */

import { redirect }  from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead }   from '@/components/shared/PageHead';
import { EmptyState } from '@/components/ui/Primitives';
import { Truck }      from '@/components/icons';

export const metadata = { title: 'Deliveries' };

export default async function AdminDeliveriesPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role === 'DRIVER') redirect('/driver');

  return (
    <>
      <PageHead title="Deliveries" subtitle="Track and manage all outbound deliveries." />
      <EmptyState
        icon={<Truck size={24} />}
        title="No deliveries in progress"
        description="Active and scheduled deliveries will appear here."
      />
    </>
  );
}
