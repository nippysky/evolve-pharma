'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ArrowRight, AlertTriangle, Shield } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { useLoginStaff } from '@/hooks/staff/useStaff';
import { getMe } from '@/lib/api/services/auth.service';
import { classifyLoginError } from '@/lib/errors';

type StaffLoginData = { status: string; role: string; email: string };

function getRedirectTarget(role: string): string {
  const defaultPath = role.toUpperCase() === 'DRIVER' ? '/driver' : '/admin/overview';
  if (typeof window === 'undefined') return defaultPath;
  const p = new URLSearchParams(window.location.search).get('redirect') ?? '';
  return p.startsWith('/') ? p : defaultPath;
}

export default function StaffSignInPage() {
  const router = useRouter();
  const toast  = useToast();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [serverError, setServerError] = useState('');

  const loginMutation = useLoginStaff();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setServerError('');

    loginMutation.mutate(
      { email: email.trim().toLowerCase(), password },
      {
        onSuccess: async (data: StaffLoginData) => {
          // The API already gates INACTIVE/SUSPENDED accounts with a 403.
          // This is a belt-and-suspenders check in case the status leaks through.
          if (data.status && data.status.toUpperCase() !== 'ACTIVE') {
            setServerError(
              `Your account is ${data.status.toLowerCase()}. Please contact your administrator for assistance.`,
            );
            return;
          }

          // Prefetch auth/me while the JWT cookie is freshly set so the
          // sidebar shows the real name immediately — even before UserContext resolves.
          try {
            await getMe();
          } catch {
            // auth/me will resolve later through UserContext — not fatal
          }

          toast.success('Welcome back', 'Opening the console…');

          router.push(getRedirectTarget(data.role));
        },

        onError: (err: Error) => {
          const { kind, message } = classifyLoginError(err);

          // INACTIVE / SUSPENDED — the API returns these as 403 with a plain message
          if (kind === 'suspended') {
            setServerError(message);
            return;
          }

          setServerError(message);
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-104" noValidate>
      {/* Header */}
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
        <Shield size={12} />
        Staff access
      </span>
      <h1 className="display-serif mt-2 text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-ink">
        Operations console.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Sign in with your EnvolveCare Express staff credentials. Access is scoped to your
        role automatically.
      </p>

      <div className="mt-8">
        {serverError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm leading-relaxed text-red-800">{serverError}</p>
            </div>
          </div>
        )}

        <Field label="Staff email" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@envolvepharm.com.ng"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>

        <div className="mb-1 flex items-center justify-end">
          <Link
            href="/staff/forgot-password"
            className="text-xs font-medium text-brand-600 hover:underline hover:underline-offset-2"
          >
            Forgot password?
          </Link>
        </div>

        <Field label="Password" htmlFor="password" required>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <Button
          type="submit"
          loading={loginMutation.isPending}
          fullWidth
          size="lg"
          trailingIcon={<ArrowRight size={16} />}
        >
          Sign in to console
        </Button>

        <p className="mt-6 text-center text-sm text-ink-2">
          Not staff?{' '}
          <Link
            href="/sign-in"
            className="font-medium text-brand-600 hover:underline hover:underline-offset-2"
          >
            Customer sign-in
          </Link>
        </p>
      </div>
    </form>
  );
}
