import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SessionUser } from '@/types';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 min

interface UserContextValue {
  user:      SessionUser | null;
  isLoading: boolean;
  error:     string | null;
  refetch:   () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user:      null,
  isLoading: true,
  error:     null,
  refetch:   async () => {},
});

async function fetchMe(): Promise<SessionUser | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    const body = await res.json() as { status: string; data: { user: SessionUser } };
    return body.status === 'success' ? body.data.user : null;
  } catch {
    return null;
  }
}

async function callRefresh(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method:      'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const lastRefreshAt = useRef<number>(Date.now());

  const refetch = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
    setError(me ? null : 'Session expired');
    setIsLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Proactive refresh + re-fetch
  const refreshAndRefetch = useCallback(async () => {
    await callRefresh();
    lastRefreshAt.current = Date.now();
    await refetch();
  }, [refetch]);

  useEffect(() => {
    const timer = setInterval(() => void refreshAndRefetch(), REFRESH_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const elapsed = Date.now() - lastRefreshAt.current;
      if (elapsed >= 8 * 60 * 1000) void refreshAndRefetch();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshAndRefetch]);

  return (
    <UserContext.Provider value={{ user, isLoading, error, refetch }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  return useContext(UserContext);
}
