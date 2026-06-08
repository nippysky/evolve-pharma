import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ConsoleSidebar } from '@/components/console/ConsoleSidebar';
import { ConsoleTopbar } from '@/components/console/ConsoleTopbar';
import { RoleSwitcher } from '@/components/shared/RoleSwitcher';

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role === 'customer') redirect('/portal/catalog');
  // Drivers land on their own assignments page, not the admin overview
  // (The /console/driver/* pages are still rendered inside this layout)

  return (
    <div className="flex min-h-dvh bg-bg-subtle">
      <ConsoleSidebar session={session} />
      <div className="flex min-w-0 flex-1 flex-col">
        <ConsoleTopbar role={session.role} permissions={session.permissions ?? []} notificationCount={2} />
        <div className="px-safe py-6 sm:py-8">
          <div className="mx-auto max-w-330">{children}</div>
        </div>
      </div>
      <RoleSwitcher current={session.role} />
    </div>
  );
}
