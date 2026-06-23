import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { EmptyState } from '@/components/ui/Primitives';
import { Building } from '@/components/icons';

export const metadata = { title: 'Customer' };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/sign-in');

  return (
    <>
      <PageHead title={`Customer #${id}`} subtitle="Customer detail view." />
      <EmptyState
        icon={<Building size={24} />}
        title="Customer detail coming soon"
        description="This view will populate once customer API integration is complete."
      />
    </>
  );
}
