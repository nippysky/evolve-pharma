import { redirect }          from 'next/navigation';
import { getSession }         from '@/lib/auth';
import { PageHead }           from '@/components/shared/PageHead';
import DriverHistoryClient    from './DriverHistoryClient';

export const metadata = { title: 'Delivery History' };

export default async function DriverHistoryPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role !== 'DRIVER') redirect('/admin');

  return (
    <>
      <PageHead
        title="Delivery history"
        subtitle="All completed and past deliveries."
      />
      <DriverHistoryClient />
    </>
  );
}
