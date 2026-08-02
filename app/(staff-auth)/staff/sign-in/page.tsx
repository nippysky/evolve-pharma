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
import { getMe } from '@/lib/api/services/auth.service';

type StaffLoginData = { status: string; role: string; email: string; token?: string };

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
        onSuccess: async (data: StaffLoginData) => {
          // Block inactive accounts before setting any cookie
          if (data.status && data.status.toUpperCase() !== 'ACTIVE') {
            setServerError(
              `Your account is ${data.status.toLowerCase()}. Contact your administrator.`,
            );
            return;
          }

          // Fetch auth/me immediately while the JWT cookie is freshly set.
          // Store the result so the sidebar shows the real name on every page
          // load — even if the background auth/me call in UserContext fails.
          let fullName = '';
          try {
            const me = await getMe();
            fullName = [me.first_name, me.last_name].filter(Boolean).join(' ');
          } catch {
            // auth/me failed — name will still appear once UserContext resolves
          }

          await setStaffSessionAction(data.role, {
            email: data.email,
            ...(fullName ? { full_name: fullName } : {}),
          });

          toast.show({
            tone: 'success',
            title: 'Welcome back',
            description: 'Opening the console…',
          });

          const target =
            data.role.toUpperCase() === 'DRIVER'
              ? '/driver'
              : '/admin/overview';

          router.push(target);
        },
        onError: (err: Error) => {
          const msg = err.message?.toLowerCase() ?? '';

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
            placeholder="you@ece.envolvepharm.com.ng"
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
