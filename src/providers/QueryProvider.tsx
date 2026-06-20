'use client';

/**
 * ENVOLVE PHARMACEUTICALS — TanStack Query Provider
 *
 * Wraps the app with a QueryClient so hooks work everywhere.
 * The client is created once per browser session using useState
 * to prevent re-creation on every render (Next.js App Router pattern).
 */

import { useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 2 minutes by default.
        // Individual hooks can override this with their own staleTime.
        staleTime: 2 * 60 * 1000,
        // Retry once on failure (network blips), then surface the error.
        retry: 1,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
        // Don't refetch on window focus by default — avoids jarring
        // re-renders. Opt-in per hook where freshness really matters.
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Surface mutation errors in the component via the error state —
        // don't swallow them silently.
        throwOnError: false,
      },
    },
  });
}

// Browser singleton — avoids re-creation across hot reloads in dev
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new client (no singleton on the server)
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

interface Props {
  children: React.ReactNode;
}

export function QueryProvider({ children }: Props) {
  // Use useState so the client isn't recreated on every render
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
