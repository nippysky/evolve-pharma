'use client';

/**
 * ENVOLVE PHARMACEUTICALS — User Context
 *
 * • Calls GET auth/me on mount and stores the result in global state.
 * • Silently refreshes the access token on a 10-minute interval AND
 *   whenever the tab regains visibility (fixes browser background throttling).
 * • auth/me never retries autonomously — the Axios interceptor handles any
 *   401 by calling auth/refresh first, then replaying the original request.
 * • Error is only surfaced if auth/me fails AND a manual refresh also fails,
 *   so brief expiry windows during background sleep never kick the user out.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { AUTH } from '@/lib/api/endpoints';
import { getMe } from '@/lib/api/services/auth.service';
import type { MeResponse } from '@/lib/api/types';

// ---------- Constants -------------------------------------------------------

/**
 * Refresh every 10 minutes.
 * The backend access token lives 15 min. 10 min gives a comfortable margin
 * even when the browser throttles setInterval to once per minute in
 * background tabs (Chrome/Firefox both allow at least once/min).
 */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

// ---------- Context type ---------------------------------------------------

interface UserContextValue {
  user: MeResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoading: true,
  error: null,
  refetch: () => {},
});

// ---------- Silent refresh helper ------------------------------------------

/**
 * Call auth/refresh and return true on success, false on failure.
 * Never throws — callers decide what to do with the result.
 */
async function silentRefresh(): Promise<boolean> {
  try {
    await apiClient.post(AUTH.REFRESH);
    return true;
  } catch {
    return false;
  }
}

// ---------- Provider -------------------------------------------------------

export function UserProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  /**
   * Tracks whether we're mid-refresh so the AuthGate can distinguish
   * "error while refreshing (hold on)" from "error after refresh (give up)".
   */
  const [isRefreshingSession, setIsRefreshingSession] = useState(false);

  // ── auth/me ──────────────────────────────────────────────────────────────
  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMe,
    // NO autonomous retries — the Axios interceptor already handles 401 by
    // calling auth/refresh and replaying the request. A second retry from
    // TanStack Query would just race with the interceptor's own retry.
    retry: false,
    staleTime: 5 * 60 * 1000,
    // Disable TanStack's own focus-refetch — we control refetching ourselves
    // via the visibilitychange handler so we can always refresh the token first.
    refetchOnWindowFocus: false,
    throwOnError: false,
  });

  // ── Proactive refresh: interval + visibility ────────────────────────────
  //
  // Two triggers keep the access token alive:
  //   1. setInterval every 10 min (active tab — token never expires naturally)
  //   2. document.visibilitychange (returning after background sleep — interval
  //      may have been throttled; we refresh before auth/me can fire)
  //
  // Both call silentRefresh(), which is a no-op on failure. The Axios
  // interceptor is the last-resort safety net if any request still gets a 401.

  const lastRefreshAt = useRef<number>(Date.now());

  useEffect(() => {
    // Proactively refresh, then invalidate auth/me so the sidebar name stays
    // up-to-date after returning to the tab.
    const refreshAndRefetch = async () => {
      await silentRefresh();
      lastRefreshAt.current = Date.now();
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    };

    // ── Interval: every 10 min ───────────────────────────────────────────
    const timer = setInterval(() => {
      void refreshAndRefetch();
    }, REFRESH_INTERVAL_MS);

    // ── Visibility: tab regains focus ────────────────────────────────────
    // Only refresh if the last refresh was more than 8 minutes ago, so
    // rapidly alt-tabbing doesn't spam the backend.
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const elapsed = Date.now() - lastRefreshAt.current;
      if (elapsed >= 8 * 60 * 1000) {
        void refreshAndRefetch();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [queryClient]);

  // ── Recover from auth/me errors ─────────────────────────────────────────
  //
  // If auth/me fails (interceptor already tried a refresh internally but the
  // refresh token was also expired), surface the error. But first try ONE
  // more explicit refresh attempt — handles the edge case where the interceptor
  // refresh raced with a concurrent request and got confused.
  const recoveryAttemptedRef = useRef(false);

  useEffect(() => {
    if (!error || user) {
      // No error or error cleared — reset the recovery flag.
      recoveryAttemptedRef.current = false;
      return;
    }

    if (recoveryAttemptedRef.current) return; // already tried, give up
    recoveryAttemptedRef.current = true;

    setIsRefreshingSession(true);
    silentRefresh().then((ok) => {
      setIsRefreshingSession(false);
      if (ok) {
        // Refresh worked — retry auth/me.
        void refetch();
      }
      // If refresh also failed, error stays set; ConsoleAuthProvider will redirect.
    });
  }, [error, user, refetch]);

  return (
    <UserContext.Provider
      value={{
        user: user ?? null,
        // Still loading if the initial query is loading OR if we're mid-recovery.
        isLoading: isLoading || isRefreshingSession,
        // Only expose the error once recovery has been attempted and failed.
        error: (error && !isRefreshingSession && recoveryAttemptedRef.current)
          ? (error as Error)
          : null,
        refetch,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

// ---------- Hook -----------------------------------------------------------

export function useUser(): UserContextValue {
  return useContext(UserContext);
}

