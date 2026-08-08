import { redirect }          from 'next/navigation';
import Link                  from 'next/link';
import { getSession }         from '@/lib/auth';
import { PageHead }           from '@/components/shared/PageHead';
import { Plus }               from '@/components/icons';
import { AdminOrdersView }    from './AdminOrdersView';

export const metadata = { title: 'Orders' };

export default async function AdminOrdersPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role === 'DRIVER') redirect('/driver');

  const canPlaceOrders = session.role === 'ADMIN' || session.role === 'STAFF';

  return (
    <>
      <PageHead
        title="Orders"
        subtitle="Manage and track all customer orders. Update status, confirm payment, and print invoices."
        actions={
          canPlaceOrders ? (
            <Link
              href="/admin/orders/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              <Plus size={14} />
              New order
            </Link>
          ) : undefined
        }
      />
      <AdminOrdersView />
    </>
  );
}
