/**
 * Admin — Orders
 * Live data wired in Module 5.
 */

import { redirect }   from 'next/navigation';
import { getSession }  from '@/lib/auth';
import { PageHead }    from '@/components/shared/PageHead';
import { EmptyState }  from '@/components/ui/Primitives';
import { Box }         from '@/components/icons';

export const metadata = { title: 'Orders' };

export default async function AdminOrdersPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role === 'DRIVER') redirect('/driver');

  return (
    <>
      <PageHead title="Orders" subtitle="Manage and track all customer orders." />
      <EmptyState
        icon={<Box size={24} />}
        title="No orders yet"
        description="Orders will appear here once customers start placing them."
      />
    </>
  );
}
