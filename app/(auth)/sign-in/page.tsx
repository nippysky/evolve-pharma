'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ArrowRight, AlertTriangle } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { useLoginCustomer } from '@/hooks/auth/useCustomerAuth';
export default function SignInPage() {
  const router = useRouter();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [serverError, setServerError] = useState('');

  const loginMutation = useLoginCustomer();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setServerError('');

    loginMutation.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          // If onSuccess fires, the API has cleared all status gates.
          // (PENDING_REVIEW / OTP_CONFIRMED / REJECTED all return 403 — handled in onError.)
          // Cookies are already set by the API route handler — no manual header needed.
          toast.show({
            tone: 'success',
            title: `Welcome back, ${data.customer.first_name}`,
            description: 'Routing you to your portal…',
          });
          router.push('/portal/catalog');
        },
        onError: (err: Error) => {
          const msg = err.message?.toLowerCase() ?? '';

          // Backend returns this message when the account is PENDING_REVIEW
          if (msg.includes('under review') || msg.includes('pending')) {
            router.push('/sign-up/pending');
            return;
          }

          // Translate technical errors into plain English
          if (msg.includes('incorrect') || msg.includes('invalid') || msg.includes('wrong') ||
              msg.includes('password') || msg.includes('credential') ||
              (err as Error & { status?: number }).status === 401) {
            setServerError('Incorrect email or password. Please double-check and try again.');
            return;
          }

          if (msg.includes('unavailable') || msg.includes('too long') ||
              msg.includes('reach') || msg.includes('network') || msg.includes('connect')) {
            setServerError('Our servers appear to be temporarily unavailable. Please try again in a moment.');
            return;
          }

          if (msg.includes('too many') || msg.includes('429')) {
            setServerError('Too many sign-in attempts. Please wait a few minutes and try again.');
            return;
          }

          setServerError(err.message ?? 'Sign in failed. Please check your details and try again.');
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-104" noValidate>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
        Sign in
      </span>
      <h1 className="display-serif mt-2 text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-ink">
        Welcome back.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Continue where you left off — your basket and order history are waiting.
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

        <Field label="Work email" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@pharmacy.ng"
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
          Sign in
        </Button>

        <p className="mt-6 text-center text-sm text-ink-2">
          New to EnvolveCare Express?{' '}
          <Link href="/sign-up" className="font-medium text-brand-600 hover:underline hover:underline-offset-2">
            Onboard your pharmacy
          </Link>
        </p>
      </div>
    </form>
  );
}
