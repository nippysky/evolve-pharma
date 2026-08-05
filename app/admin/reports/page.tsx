import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/types';
import { PageHead } from '@/components/shared/PageHead';
import type { SessionUser } from '@/types';
import ReportsClient from './ReportsClient';

async function getSessionWithPermCheck(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role === 'CUSTOMER') redirect('/portal/catalog');
  if (session.role === 'DRIVER') redirect('/driver');
  if (session.role !== 'ADMIN' && session.role !== 'STAFF' && !hasPermission(session, 'view_reports')) redirect('/admin/overview');
  return session;
}

export const metadata = { title: 'Reports' };

export default async function ReportsPage() {
  await getSessionWithPermCheck();

  return (
    <>
      <PageHead title="Reports" subtitle="Operational and commercial metrics across the business." />
      <ReportsClient />
    </>
  );
}
