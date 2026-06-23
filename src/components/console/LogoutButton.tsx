'use client';

/**
 * ENVOLVE PHARMACEUTICALS — Logout Button
 *
 * Calls POST auth/logout to terminate the backend session (clears httpOnly
 * cookies), then calls the server action to clear the local role cookie and
 * redirect to the staff sign-in page.
 */

import { useState } from 'react';
import { Logout, Spinner } from '@/components/icons';
import { logoutUser } from '@/lib/api/services/auth.service';
import { signOutAction } from '@/lib/actions/role';

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // 1. Tell the backend to invalidate the session cookie
      await logoutUser();
    } catch {
      // Ignore errors — we log out locally regardless
    } finally {
      // 2. Clear our role cookie + redirect (server action)
      await signOutAction();
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
