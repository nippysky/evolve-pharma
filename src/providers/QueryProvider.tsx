'use client';

/**
 * QueryProvider — stub
 *
 * TanStack Query has been removed from this project.
 * Global server state is managed via the UserContext (plain fetch + useState).
 * Per-page data fetching uses Next.js server components + direct API calls.
 *
 * This component is kept as a pass-through so any remaining imports compile
 * without error until they are cleaned up.
 */

import type { ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
