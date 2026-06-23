import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { PortalTopbar } from '@/components/portal/PortalTopbar';
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'customer') redirect('/console/overview');

  /**
   * PCN sticky gate — redirect if pcn_uploaded is explicitly false.
   * Undefined means data unavailable (customer logged in without cookie),
   * so we let them through (they uploaded during sign-up).
   */
  if (session.pcn_uploaded === false) {
    redirect('/upload-pcn');
  }

  // TODO: fetch real unread notification count from notifications API
  const unread = 0;

  return (
    <div className="flex min-h-dvh bg-bg-subtle">
      <PortalSidebar session={session} notificationCount={unread} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalTopbar notificationCount={unread} />
        <div className="px-safe py-6 sm:py-8">
          {/* PCN verification pending banner */}
          {session.pcn_uploaded && !session.pcn_verified && (
            <div className="mx-auto mb-6 max-w-7xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong className="font-semibold">PCN certificate under review.</strong>{' '}
              Our compliance team is verifying your documents. You can browse the catalog but won&apos;t be able to place orders until verification is complete — usually within 24 hours.
            </div>
          )}
          <div className="mx-auto max-w-7xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
