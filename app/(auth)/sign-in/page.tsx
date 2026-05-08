'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ArrowRight, AlertTriangle } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { signInAction } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';

const initial: ActionResult = { ok: false, message: '' };

export default function SignInPage() {
  const router = useRouter();
  const toast = useToast();
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await signInAction(prev, fd);
    if (r.ok) {
      toast.show({
        tone: 'success',
        title: 'Welcome back',
        description: 'Routing you to your portal…',
      });
      setTimeout(() => router.push('/portal/catalog'), 500);
    }
    return r;
  }, initial);

  const fieldErrors = !state.ok ? state.fieldErrors : undefined;
  const error = !state.ok && !fieldErrors ? state.message : '';

  return (
    <form action={action} className="w-full max-w-104" noValidate>
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
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-danger-soft px-3.5 py-3 text-sm text-red-800">
            <AlertTriangle size={14} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <Field label="Work email" htmlFor="email" required error={fieldErrors?.email?.[0]}>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@pharmacy.ng"
            autoComplete="email"
            defaultValue="amaka@greenleaf.ng"
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

        <Field label="Password" htmlFor="password" required error={fieldErrors?.password?.[0]}>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            defaultValue="demoPass123"
            required
          />
        </Field>

        <Button
          type="submit"
          loading={pending}
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
        <p className="mt-3 text-center text-xs text-ink-4">
          Sales agent or admin? Use this same form with your staff credentials, then flip the
          demo role switcher.
        </p>
      </div>
    </form>
  );
}
