import Link                    from 'next/link';
import { getSession }           from '@/lib/auth';
import { redirect }             from 'next/navigation';
import { PageHead }             from '@/components/shared/PageHead';
import DriverAssignmentsClient  from './DriverAssignmentsClient';

export const metadata = { title: 'My Assignments' };

export default async function DriverAssignmentsPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role !== 'DRIVER') redirect('/admin');

  return (
    <>
      <PageHead
        title={`Hi, ${session.first_name}.`}
        subtitle="Your current delivery assignments."
      />

      <DriverAssignmentsClient />

      <div className="mt-6 flex justify-end">
        <Link
          href="/driver/history"
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          View delivery history →
        </Link>
      </div>
    </>
  );
}
