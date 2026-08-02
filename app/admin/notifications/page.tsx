import { Bell } from '@/components/icons';
import { EmptyState } from '@/components/ui/Primitives';
import { PageHead } from '@/components/shared/PageHead';

export default function ConsoleNotificationsPage() {
  return (
    <>
      <PageHead title="Notifications" subtitle="System-wide alerts across your team." />
      <EmptyState
        icon={<Bell size={24} />}
        title="No notifications"
        description="System alerts and updates will appear here."
      />
    </>
  );
}
