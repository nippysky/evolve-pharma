'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ArrowRight, ArrowLeft, CheckCircle, Mail } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { sleep } from '@/lib/utils';

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    await sleep(900);
    setSent(true);
    setSubmitting(false);
    toast.show({ tone: 'success', title: 'Reset link sent', description: 'Check your inbox.' });
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-[26rem]" noValidate>
      {sent ? (
        <>
          <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-leaf-100 text-leaf-700">
            <CheckCircle size={28} />
          </span>
          <h1 className="display-serif text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-ink">
            Check your inbox.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            If the email matches an account, we&apos;ve sent a password reset link. The link
            expires in 30 minutes.
          </p>
          <Link
            href="/sign-in"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline hover:underline-offset-2"
          >
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
            <Mail size={12} /> Reset password
          </span>
          <h1 className="display-serif mt-2 text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-ink">
            Forgot your password?
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Enter the email on your account. We&apos;ll send you a reset link.
          </p>

          <div className="mt-8">
            <Field label="Work email" htmlFor="email" required>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@pharmacy.ng" required />
            </Field>

            <Button type="submit" loading={submitting} fullWidth size="lg" trailingIcon={<ArrowRight size={16} />}>
              Send reset link
            </Button>

            <p className="mt-6 text-center text-sm text-ink-2">
              <Link href="/sign-in" className="font-medium text-brand-600 hover:underline hover:underline-offset-2">
                Remembered? Back to sign in
              </Link>
            </p>
          </div>
        </>
      )}
    </form>
  );
}
