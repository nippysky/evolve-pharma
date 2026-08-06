'use client';
import type { ReactNode } from 'react';
import { useEffect }      from 'react';
import { UserProvider, useUser } from '@/contexts/UserContext';

function PortalAuthGate({ children }: { children: ReactNode }) {
  const { isLoading, user, error } = useUser();

  // Redirect to customer sign-in once the UserContext confirms session is gone
  useEffect(() => {
    if (!isLoading && error && !user) {
      window.location.href = '/sign-in';
    }
  }, [isLoading, error, user]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg-subtle">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
          <p className="text-sm text-ink-3">Loading…</p>
        </div>
      </div>
    );
  }

  if (error && !user) return null;

  return <>{children}</>;
}

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <PortalAuthGate>{children}</PortalAuthGate>
    </UserProvider>
  );
}
