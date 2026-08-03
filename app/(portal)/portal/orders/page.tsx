/**
 * Portal — My Orders
 *
 * Server component fetches real orders for the logged-in customer (cached 30 s)
 * and streams them into the client filter/tab UI.
 * Shell renders instantly; data appears < 1 s on cache hit.
 */

import { Suspense }           from 'react';
import { redirect }           from 'next/navigation';
import { getSession }         from '@/lib/auth';
import { getPortalOrders }    from '@/lib/data/orders.server';
import { PageHead }           from '@/components/shared/PageHead';
import { PortalOrdersClient } from '@/components/portal/PortalOrdersClient';

function OrdersSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl border border-line bg-white" />)}
      </div>
      <div className="flex gap-2">
        {[...Array(6)].map((_, i) => <div key={i} className="h-8 w-20 rounded-md bg-bg-muted" />)}
      </div>
      <div className="space-y-3 rounded-xl border border-line bg-white p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 py-1">
            <div className="h-4 w-28 rounded bg-bg-muted" />
            <div className="h-4 w-16 rounded bg-bg-muted" />
            <div className="ml-auto h-4 w-20 rounded bg-bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function OrdersData({ userId }: { userId: number }) {
  const orders = await getPortalOrders(userId);
  return <PortalOrdersClient orders={orders} />;
}

export default async function PortalOrdersPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'CUSTOMER') redirect('/admin/overview');

  return (
    <>
      <PageHead title="My orders" subtitle="Track every shipment from confirmation to delivery." />
      <Suspense fallback={<OrdersSkeleton />}>
        <OrdersData userId={session.userId} />
      </Suspense>
    </>
  );
}
