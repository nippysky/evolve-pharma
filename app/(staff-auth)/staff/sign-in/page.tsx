'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ArrowRight, AlertTriangle, Shield } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { useLoginStaff } from '@/hooks/staff/useStaff';
import { setStaffSessionAction } from '@/lib/actions';

export default function StaffSignInPage() {
  const router = useRouter();
  const toast = useToast();
  // Dev convenience — pre-filled with the seeded admin account.
  // Clear the field to enter different credentials.
  const [email, setEmail]       = useState('admin@gmail.com');
  const [password, setPassword] = useState('admin');
  const [serverError, setServerError] = useState('');

  const loginMutation = useLoginStaff();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setServerError('');

    loginMutation.mutate(
      { email, password },
      {
        onSuccess: async (data) => {
          // Set the role cookie so the server-rendered console layout resolves
          await setStaffSessionAction(data.role);

          toast.show({
            tone: 'success',
            title: `Welcome back`,
            description: 'Opening the console…',
          });

          // Route by role
          const target =
            data.role.toUpperCase() === 'DRIVER'
              ? '/console/driver'
              : '/console/overview';

          router.push(target);
        },
        onError: (err: Error) => {
          setServerError(err.message ?? 'Sign in failed. Please check your credentials.');
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
        Sign in with your Envolve staff credentials. Access is scoped to your
        role automatically.
      </p>

      <div className="mt-8">
        {serverError && (
          <div className="mb-4 rounded-md border border-red-200 bg-danger-soft px-3.5 py-3 text-sm text-red-800">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{serverError}</span>
            </div>
            {/* "Not found" usually means the backend CORS whitelist doesn't include
                localhost for this endpoint yet — ask the backend dev to add it. */}
            {(serverError.toLowerCase().includes('not found') ||
              serverError.toLowerCase().includes('network') ||
              serverError.toLowerCase().includes('cors')) && (
              <p className="mt-2 pl-5 text-xs text-red-600">
                Tip: open{' '}
                <kbd className="rounded bg-red-100 px-1 py-0.5 font-mono">F12</kbd>{' '}
                → Network tab, find the <code className="font-mono">auth/staff/login</code>{' '}
                request and check its status + response headers. If you see a CORS error in
                the Console tab, ask the backend dev to add{' '}
                <code className="font-mono">localhost:3000</code> to the allowed origins for
                staff routes.
              </p>
            )}
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
            href="/forgot-password"
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
