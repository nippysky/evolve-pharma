import type { ReactNode }     from 'react';
import { redirect }            from 'next/navigation';
import { headers }             from 'next/headers';
import { getSession }          from '@/lib/auth';
import { AdminSidebar }      from '@/components/admin/AdminSidebar';
import { AdminTopbar }       from '@/components/admin/AdminTopbar';
import { AdminAuthProvider } from '@/providers/AdminAuthProvider';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session) {
    const h        = await headers();
    const pathname = h.get('x-pathname') ?? '/admin/overview';
    redirect(`/staff/sign-in?redirect=${encodeURIComponent(pathname)}`);
  }
  if (session.role === 'CUSTOMER') redirect('/portal/catalog');
  if (session.role === 'DRIVER')   redirect('/driver');

  return (
    <AdminAuthProvider>
      <div className="flex min-h-dvh bg-bg-subtle">
        <AdminSidebar session={session} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopbar role={session.role} />
          <div className="px-safe py-6 sm:py-8">
            <div className="mx-auto max-w-330">{children}</div>
          </div>
        </div>
      </div>
    </AdminAuthProvider>
  );
}
