/**
 * Console · Customers (admin + sales_agent). Server-guarded; the
 * interactive table, onboarding, import, and pending review live in the
 * CustomersView client island. Admin-only controls are gated by `role`.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { CustomersView } from '@/components/console/CustomersView';
import { CUSTOMERS } from '@/lib/data/operational';

export const metadata = {
  title: 'Customers',
};

export default async function ConsoleCustomersPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role === 'customer') redirect('/portal/catalog');

  // Fetch point: swap CUSTOMERS for the live API call here.
  return <CustomersView role={session.role} customers={CUSTOMERS} />;
}