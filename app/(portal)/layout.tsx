import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { PortalTopbar } from '@/components/portal/PortalTopbar';
import { RoleSwitcher } from '@/components/shared/RoleSwitcher';
import { NOTIFICATIONS } from '@/lib/data/operational';

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'customer') redirect('/console/overview');

  const unread = NOTIFICATIONS.filter((n) => n.user_id === session.id && !n.is_read).length;

  return (
    <div className="flex min-h-dvh bg-bg-subtle">
      <PortalSidebar session={session} notificationCount={unread} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalTopbar notificationCount={unread} />
        <div className="px-safe py-6 sm:py-8">
          <div className="mx-auto max-w-[1280px]">{children}</div>
        </div>
      </div>
      <RoleSwitcher current={session.role} />
    </div>
  );
}
