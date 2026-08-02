import type { ReactNode } from 'react';
import { redirect }       from 'next/navigation';
import { getSession }     from '@/lib/auth';
import { PortalSidebar }  from '@/components/portal/PortalSidebar';
import { PortalTopbar }   from '@/components/portal/PortalTopbar';

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  // Not logged in → sign-in
  if (!session) redirect('/sign-in');

  // Wrong role → their dashboard
  if (session.role !== 'CUSTOMER') redirect('/admin');

  /**
   * PCN gate — in Module 2 we'll fetch pcn_verified from DB here.
   * For now the gate is enforced via the API routes (customer can browse
   * but can't checkout without PCN approval).
   */

  return (
    <div className="flex min-h-dvh bg-bg-subtle">
      <PortalSidebar session={session} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalTopbar />
        <div className="px-safe py-6 sm:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
