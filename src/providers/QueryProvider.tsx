'use client';

import { useState }                                from 'react';
import { QueryClient, QueryClientProvider }        from '@tanstack/react-query';
import type { ReactNode }                           from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  // useState so each browser tab gets its own client (avoids shared state between SSR requests)
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't re-fetch on window focus in dev — avoids noisy DB hits while editing
            refetchOnWindowFocus: false,
            // 1 min stale time — server data doesn't change every second
            staleTime: 60 * 1000,
            // Retry once on network errors; don't spam on 4xx
            retry: (failureCount, error) => {
              const status = (error as { status?: number })?.status;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 1;
            },
          },
          mutations: {
            // Don't retry mutations — they might not be idempotent
            retry: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
