export const dynamic = 'force-dynamic';

import { redirect }          from 'next/navigation';
import { getSession }        from '@/lib/auth';
import { PageHead }          from '@/components/shared/PageHead';
import { NotificationsList } from '@/components/shared/NotificationsList';

export const metadata = { title: 'Notifications' };

export default async function ConsoleNotificationsPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (session.role === 'CUSTOMER') redirect('/portal/notifications');

  return (
    <>
      <PageHead
        title="Notifications"
        subtitle="Orders, payments and accounts that need your attention."
      />
      <NotificationsList />
    </>
  );
}
