import { redirect }         from 'next/navigation';
import { getSession }        from '@/lib/auth';
import { PageHead }          from '@/components/shared/PageHead';
import AdminDeliveriesClient from './AdminDeliveriesClient';

export const metadata = { title: 'Deliveries' };

export default async function AdminDeliveriesPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role === 'DRIVER') redirect('/driver');

  return (
    <>
      <PageHead
        title="Deliveries"
        subtitle="Manage driver assignments and track all outbound deliveries."
      />
      <AdminDeliveriesClient />
    </>
  );
}
