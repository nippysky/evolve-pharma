import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { CustomersView } from '@/components/admin/CustomersView';

export const metadata = {
  title: 'Customers',
};

export default async function ConsoleCustomersPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role === 'CUSTOMER') redirect('/portal/catalog');

  return <CustomersView role={session.role} />;
}
