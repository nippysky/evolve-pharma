/**
 * Driver Portal — Delivery History
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { EmptyState } from '@/components/ui/Primitives';
import { Truck } from '@/components/icons';

export const metadata = { title: 'Delivery History' };

export default async function DriverHistoryPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role !== 'driver') redirect('/console/overview');

  return (
    <>
      <PageHead
        title="Delivery history"
        subtitle="All completed and past deliveries."
      />
      <EmptyState
        icon={<Truck size={24} />}
        title="No delivery history yet"
        description="Completed deliveries will appear here."
      />
    </>
  );
}
