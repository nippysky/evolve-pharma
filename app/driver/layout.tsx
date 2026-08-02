import type { ReactNode }     from 'react';
import { redirect }            from 'next/navigation';
import { getSession }          from '@/lib/auth';
import { ConsoleSidebar }      from '@/components/console/ConsoleSidebar';
import { ConsoleTopbar }       from '@/components/console/ConsoleTopbar';
import { ConsoleAuthProvider } from '@/providers/ConsoleAuthProvider';

export default async function DriverLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session)                   redirect('/staff/sign-in');
  if (session.role === 'CUSTOMER') redirect('/portal/catalog');
  if (session.role !== 'DRIVER')   redirect('/admin/overview');

  return (
    <ConsoleAuthProvider>
      <div className="flex min-h-dvh bg-bg-subtle">
        <ConsoleSidebar session={session} />
        <div className="flex min-w-0 flex-1 flex-col">
          <ConsoleTopbar role={session.role} />
          <div className="px-safe py-6 sm:py-8">
            <div className="mx-auto max-w-330">{children}</div>
          </div>
        </div>
      </div>
    </ConsoleAuthProvider>
  );
}
