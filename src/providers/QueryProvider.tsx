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
            // Re-fetch when the user returns to the tab. Without this, coming
            // back to a page after switching away serves stale cache and the
            // only way to see current data is a hard refresh.
            refetchOnWindowFocus: true,
            // Re-fetch after the network drops and comes back.
            refetchOnReconnect: true,
            // Re-fetch on mount when data is stale (i.e. on route navigation).
            refetchOnMount: true,
            // Short stale window. Operational data (orders, payments, stock)
            // changes constantly — webhooks flip payment status with no user
            // action at all, so long stale times show wrong information.
            staleTime: 15 * 1000,
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
