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

  // Reps read inventory but do not change it — receiving, adjusting and batch
  // edits are all admin-only at the API, so the buttons are hidden for staff.
  return <InventoryView isAdmin={session.role === 'ADMIN'} />;
}