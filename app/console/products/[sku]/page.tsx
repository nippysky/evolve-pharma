import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { EmptyState } from '@/components/ui/Primitives';
import { Pill } from '@/components/icons';

export const metadata = { title: 'Product' };

export default async function ProductDetailPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const session = await getSession();
  if (!session) redirect('/sign-in');

  return (
    <>
      <PageHead title={sku} subtitle="Product detail view." />
      <EmptyState
        icon={<Pill size={24} />}
        title="Product detail coming soon"
        description="This view will populate once the products API integration is complete."
      />
    </>
  );
}
