/**
 * Console · Inventory (admin-only). The stock ledger: quantities, batches,
 * and expiry across catalog SKUs. Catalog editing lives on the Products page.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { InventoryView } from './InventoryView';

export const metadata = {
  title: 'Inventory',
};

export default async function ConsoleInventoryPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (!['ADMIN', 'STAFF'].includes(session.role)) redirect('/admin/overview');

  return <InventoryView />;
}