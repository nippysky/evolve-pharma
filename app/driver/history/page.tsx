/**
 * Driver Portal — Delivery History
 *
 * All completed and past deliveries for the authenticated driver.
 * Data is fetched from /api/deliveries?assigned_to=me&status=delivered in Module 5.
 */

import { PageHead }   from '@/components/shared/PageHead';
import { EmptyState } from '@/components/ui/Primitives';
import { Truck }      from '@/components/icons';

export const metadata = { title: 'Delivery History' };

export default async function DriverHistoryPage() {
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
