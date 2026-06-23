import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { EmptyState } from '@/components/ui/Primitives';
import { Box } from '@/components/icons';

export const metadata = { title: 'Order' };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/sign-in');

  return (
    <>
      <PageHead title={`Order #${id}`} subtitle="Order detail view." />
      <EmptyState
        icon={<Box size={24} />}
        title="Order detail coming soon"
        description="This view will populate once orders API integration is complete."
      />
    </>
  );
}
