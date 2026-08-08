import { redirect }    from 'next/navigation';
import { getSession }  from '@/lib/auth';
import { PageHead }    from '@/components/shared/PageHead';
import NewOrderClient  from './NewOrderClient';

export const metadata = { title: 'New order' };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewOrderPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role === 'CUSTOMER') redirect('/portal/catalog');
  if (session.role === 'DRIVER')   redirect('/driver');
  if (session.role !== 'ADMIN' && session.role !== 'STAFF') redirect('/admin/overview');

  const sp = await searchParams;
  const raw = sp['customer_id'];
  const presetCustomerId = raw
    ? parseInt(String(Array.isArray(raw) ? raw[0] : raw), 10) || null
    : null;

  return (
    <>
      <PageHead
        title="New order"
        subtitle="Place an order on behalf of a customer."
      />
      <NewOrderClient
        actorName={`${session.first_name} ${session.last_name}`}
        actorRole={session.role as 'ADMIN' | 'STAFF'}
        presetCustomerId={presetCustomerId}
      />
    </>
  );
}
