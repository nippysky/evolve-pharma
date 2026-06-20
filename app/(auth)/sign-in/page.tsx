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
          const customer = data.customer;

          // Account not yet approved — send to the pending page
          if (customer.status !== 'APPROVED') {
            toast.show({
              tone: 'info',
              title: 'Account pending review',
              description: 'Our team will approve your account shortly.',
            });
            router.push('/sign-up/pending');
            return;
          }

          toast.show({
            tone: 'success',
            title: `Welcome back, ${customer.first_name}`,
            description: 'Routing you to your portal…',
          });

          router.push('/portal/catalog');
        },
        onError: (err: Error) => {
          // Backend returns this message when the account is PENDING_REVIEW
          if (err.message?.toLowerCase().includes('under review') ||
              err.message?.toLowerCase().includes('pending')) {
            router.push('/sign-up/pending');
            return;
          }
          setServerError(err.message ?? 'Sign in failed. Please check your credentials.');
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
          <div className="mb-4 rounded-md border border-red-200 bg-danger-soft px-3.5 py-3 text-sm text-red-800">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{serverError}</span>
            </div>
            {(serverError.toLowerCase().includes('network error') || serverError.toLowerCase().includes('cors')) && (
              <p className="mt-2 pl-5 text-xs text-red-600">
                Tip: open <kbd className="rounded bg-red-100 px-1 py-0.5 font-mono">F12</kbd> → Console for the exact browser error.
              </p>
            )}
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
          New to Envolve?{' '}
          <Link href="/sign-up" className="font-medium text-brand-600 hover:underline hover:underline-offset-2">
            Onboard your pharmacy
          </Link>
        </p>
      </div>
    </form>
  );
}
