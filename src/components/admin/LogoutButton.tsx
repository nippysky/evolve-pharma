import { useState } from 'react';
import { Logout, Spinner } from '@/components/icons';
import { logoutUser } from '@/lib/api/services/auth.service';

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Clears httpOnly cookies via Set-Cookie on the API response
      await logoutUser();
    } catch {
      // Network error — cookies may not be cleared server-side,
      // but we still navigate away so the client state is reset.
    } finally {
      // Hard navigation: forces a full page load so the middleware
      // re-evaluates (no cookie → redirects cleanly to staff sign-in).
      window.location.href = '/staff/sign-in';
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="grid h-7 w-7 place-items-center rounded text-white/55 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
      aria-label="Sign out"
    >
      {loading ? (
        <Spinner size={14} className="animate-spin" />
      ) : (
        <Logout size={14} />
      )}
    </button>
  );
}
