import { redirect }          from 'next/navigation';
import { getSession }         from '@/lib/auth';
import { PageHead }           from '@/components/shared/PageHead';
import { AdminOrdersView }    from './AdminOrdersView';

export const metadata = { title: 'Orders' };

export default async function AdminOrdersPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role === 'DRIVER') redirect('/driver');

  return (
    <>
      <PageHead
        title="Orders"
        subtitle="Manage and track all customer orders. Update status, confirm payment, and print invoices."
      />
      <AdminOrdersView />
    </>
  );
}
