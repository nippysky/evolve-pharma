import { redirect }         from 'next/navigation';
import { getSession }        from '@/lib/auth';
import { PageHead }          from '@/components/shared/PageHead';
import AdminDeliveriesClient from './AdminDeliveriesClient';

export const metadata = { title: 'Deliveries' };

export default async function AdminDeliveriesPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role === 'DRIVER') redirect('/driver');

  // Assigning a driver is admin-only. The client component already derives
  // that from `useUser()` and hides the affordance, so only the subtitle needs
  // to know — it shouldn't promise reps something they can't do.
  const isAdmin = session.role === 'ADMIN';

  return (
    <>
      <PageHead
        title="Deliveries"
        subtitle={isAdmin
          ? 'Manage driver assignments and track all outbound deliveries.'
          : 'Track outbound deliveries and move them through dispatch.'}
      />
      <AdminDeliveriesClient />
    </>
  );
}
