'use client';

/**
 * ENVOLVE PHARMACEUTICALS — Logout Button (admin / staff)
 *
 * Flow:
 *  1. POST /api/auth/logout — backend invalidates the refresh token in DB
 *     and sets Set-Cookie headers that clear ep_access + ep_refresh in the browser.
 *  2. window.location.href = '/staff/sign-in' — hard navigation so React state
 *     is fully reset and the middleware sees the now-absent cookies immediately.
 *
 * Why NOT a Server Action redirect:
 *  next/navigation redirect() throws a special NEXT_REDIRECT internally.
 *  When awaited inside a client-side try/finally it escapes the React Server
 *  Action interceptor and surfaces as "An unexpected response was received
 *  from the server." — the error overlay the user sees. Hard-navigating on
 *  the client after the API call is simpler and avoids this entirely.
 */

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
