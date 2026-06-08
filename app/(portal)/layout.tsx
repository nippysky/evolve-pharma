import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PortalSidebar } from '@/components/portal/PortalSidebar';
import { PortalTopbar } from '@/components/portal/PortalTopbar';
import { NOTIFICATIONS } from '@/lib/data/operational';

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'customer') redirect('/console/overview');

  /**
   * PCN sticky gate — if the customer hasn't uploaded their certificate yet,
   * send them to the upload page regardless of where they tried to go.
   * This covers:
   *  - Bulk-imported customers who haven't gone through the PCN step yet
   *  - Customers who abandoned the sign-up wizard before uploading
   * Once pcn_uploaded = true we let them through (even if pcn_verified is
   * still pending — they see a "pending review" banner inside the portal).
   */
  if (session.pcn_uploaded === false) {
    redirect('/upload-pcn');
  }

  const unread = NOTIFICATIONS.filter((n) => n.user_id === session.id && !n.is_read).length;

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
