'use client';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { UserProvider, useUser } from '@/contexts/UserContext';

function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, user, error } = useUser();

  // Only redirect once the UserContext has exhausted its own recovery attempt
  // (refresh → retry auth/me). By the time `error` is non-null here the
  // session is truly gone. Hard-navigate so React state fully resets and
  // the middleware re-evaluates — no server action needed, the cookies are
  // already stale/absent and the middleware will gate the page correctly.
  useEffect(() => {
    if (!isLoading && error && !user) {
      window.location.href = '/staff/sign-in';
    }
  }, [isLoading, error, user]);

  // Still fetching or mid-recovery — show a full-page skeleton that mirrors
  // the sidebar + content layout.
  if (isLoading) {
    return (
      <div className="flex min-h-dvh bg-bg-subtle">
        {/* Sidebar skeleton */}
        <aside className="hidden h-dvh w-sidebar shrink-0 flex-col bg-slate-900 px-4 pb-4 pt-5 lg:flex">
          {/* Logo */}
          <div className="border-b border-white/8 pb-4">
            <div className="h-7 w-24 animate-pulse rounded-md bg-white/10" />
            <div className="mt-2.5 h-5 w-16 animate-pulse rounded-full bg-white/8" />
          </div>
          {/* Nav items */}
          <div className="mt-4 flex flex-1 flex-col gap-1">
            {[...Array(3)].map((_, g) => (
              <div key={g} className="mt-3">
                <div className="mb-2 h-2.5 w-14 animate-pulse rounded bg-white/20" />
                {[...Array(g === 0 ? 4 : g === 1 ? 3 : 2)].map((_, i) => (
                  <div key={i} className="mb-1 h-9 w-full animate-pulse rounded-md bg-white/6" />
                ))}
              </div>
            ))}
            <div className="flex-1" />
            {/* User card */}
            <div className="mt-3 h-14 w-full animate-pulse rounded-xl bg-white/6" />
          </div>
        </aside>

        {/* Main content skeleton */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <div className="flex h-14 items-center gap-4 border-b border-line-subtle bg-white px-6">
            <div className="h-9 w-72 animate-pulse rounded-full bg-bg-muted" />
            <div className="ml-auto h-9 w-9 animate-pulse rounded-full bg-bg-muted" />
          </div>
          {/* Cards */}
          <div className="px-safe py-8">
            <div className="mx-auto max-w-330">
              <div className="mb-2 h-8 w-64 animate-pulse rounded-lg bg-bg-muted" />
              <div className="mb-8 h-4 w-80 animate-pulse rounded bg-bg-muted" />
              <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-white shadow-sm" />
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
                <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // auth/me failed — useEffect above will clear the cookie and redirect to
  // sign-in. Show the skeleton while the redirect processes.
  if (error && !user) {
    return null;
  }

  return <>{children}</>;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <AuthGate>{children}</AuthGate>
    </UserProvider>
  );
}
