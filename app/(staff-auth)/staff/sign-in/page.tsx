'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ArrowRight, AlertTriangle, Shield, Users, Truck } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { staffSignInAction } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';
import { cn } from '@/lib/utils';

const initial: ActionResult = { ok: false, message: '' };

type StaffRole = 'admin' | 'sales_agent' | 'driver';

const ROLE_OPTIONS: { value: StaffRole; label: string; sub: string; Icon: typeof Shield }[] = [
  { value: 'admin',       label: 'Admin',  sub: 'Full access',    Icon: Shield },
  { value: 'sales_agent', label: 'Staff',  sub: 'Scoped access',  Icon: Users },
  { value: 'driver',      label: 'Driver', sub: 'My assignments', Icon: Truck },
];

export default function StaffSignInPage() {
  const router = useRouter();
  const toast = useToast();
  const [role, setRole] = useState<StaffRole>('admin');

  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await staffSignInAction(prev, fd);
    if (r.ok) {
      toast.show({ tone: 'success', title: 'Signed in', description: 'Opening the console…' });
      // Drivers land on their assignments page
      const target = role === 'driver' ? '/console/driver' : '/console/overview';
      setTimeout(() => router.push(target), 500);
    }
    return r;
  }, initial);

  const fieldErrors = !state.ok ? state.fieldErrors : undefined;
  const error = !state.ok && !fieldErrors ? state.message : '';

  return (
    <form action={action} className="w-full max-w-104" noValidate>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
        Staff access
      </span>
      <h1 className="display-serif mt-2 text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-ink">
        Operations console.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Sign in with your Envolve credentials. Access is scoped to your role.
      </p>

      <div className="mt-8">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-danger-soft px-3.5 py-3 text-sm text-red-800">
            <AlertTriangle size={14} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-5">
          <span className="mb-1.5 block text-sm font-medium text-ink">Sign in as</span>
          <div className="grid grid-cols-3 gap-2">
            {ROLE_OPTIONS.map(({ value, label, sub, Icon }) => {
              const active = role === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRole(value)}
                  className={cn(
                    'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    active
                      ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-100'
                      : 'border-line bg-white hover:border-line-strong',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md',
                      active ? 'bg-brand-100 text-brand-700' : 'bg-bg-muted text-ink-3',
                    )}
                  >
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{label}</span>
                    <span className="block text-xs text-ink-3">{sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <input type="hidden" name="role" value={role} />
          <p className="mt-2 text-xs text-ink-4">
            Demo only — real sign-in resolves your role from the backend automatically.
          </p>
        </div>

        <Field label="Staff email" htmlFor="email" required error={fieldErrors?.email?.[0]}>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@envolvepharm.com.ng"
            autoComplete="email"
            defaultValue="ops@envolvepharm.com.ng"
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
