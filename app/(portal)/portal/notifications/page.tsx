export const dynamic = 'force-dynamic';

import { PageHead }          from '@/components/shared/PageHead';
import { NotificationsList } from '@/components/shared/NotificationsList';

export const metadata = { title: 'Notifications' };

export default function NotificationsPage() {
  return (
    <>
      <PageHead
        title="Notifications"
        subtitle="Updates on your orders, payments and account."
      />
      <NotificationsList />
    </>
  );
}
