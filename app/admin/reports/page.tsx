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

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReportsPage({ searchParams }: Props) {
  const session = await getSessionWithPermCheck();
  const sp = await searchParams;

  const isStaff = session.role === 'STAFF';
  const title    = isStaff ? 'My Reports' : 'Reports';
  const subtitle = isStaff
    ? 'Revenue and activity for your assigned customers.'
    : 'Operational and commercial metrics across the business.';

  // Allow admin to pre-select a staff member via ?staff_id=X (e.g. from staff list page)
  const rawStaffId = sp['staff_id'];
  const initialStaffId = !isStaff && rawStaffId
    ? parseInt(String(Array.isArray(rawStaffId) ? rawStaffId[0] : rawStaffId), 10) || null
    : null;

  return (
    <>
      <PageHead title={title} subtitle={subtitle} />
      <ReportsClient
        role={session.role as 'ADMIN' | 'STAFF'}
        userId={session.userId}
        initialStaffId={initialStaffId}
      />
    </>
  );
}
