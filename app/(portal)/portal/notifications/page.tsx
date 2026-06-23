import { Bell } from '@/components/icons';
import { EmptyState } from '@/components/ui/Primitives';
import { PageHead } from '@/components/shared/PageHead';

export default function NotificationsPage() {
  // TODO: wire to real notifications API when backend ships
  return (
    <>
      <PageHead
        title="Notifications"
        subtitle="Real-time updates on orders, payments, and shipments."
      />
      <EmptyState
        icon={<Bell size={24} />}
        title="No notifications yet"
        description="When something happens with your account, you'll see it here."
      />
    </>
  );
}
