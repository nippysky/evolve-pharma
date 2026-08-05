'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Shield,
  AlertTriangle,
} from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { parseError } from '@/lib/errors';
import { cn } from '@/lib/utils';

type Step = 'email' | 'reset' | 'done';

const pwReqsList = [
  { test: (p: string) => p.length >= 8 && p.length <= 128, label: '8–128 characters' },
  { test: (p: string) => /[A-Z]/.test(p) && /[a-z]/.test(p), label: 'Upper and lowercase letters' },
  { test: (p: string) => /[0-9]/.test(p),                     label: 'At least one number' },
];

export default function StaffForgotPasswordPage() {
  const router = useRouter();
  const toast  = useToast();

  const [step,        setStep]        = useState<Step>('email');
  const [email,       setEmail]       = useState('');
  const [code,        setCode]        = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [resendIn,    setResendIn]    = useState(0);
  const [submitting,  setSubmitting]  = useState(false);
  const [serverError, setServerError] = useState('');
  const [codeError,   setCodeError]   = useState('');
  const [pwError,     setPwError]     = useState('');

  // ── Resend countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // ── Step 1: send OTP ─────────────────────────────────────────────────────
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setServerError('Please enter your email address.'); return; }
    if (!trimmed.includes('@')) { setServerError('Please enter a valid email address.'); return; }

    setServerError('');
    setSubmitting(true);

    try {
      const res  = await fetch('/api/auth/staff/forgot-password', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ email: trimmed }),
      });
      const json = await res.json();

      if (res.ok) {
        setEmail(trimmed);
        setResendIn(60);
        toast.info('Code sent', `If ${trimmed} matches a staff account, check your inbox.`);
        setStep('reset');
      } else {
        setServerError(json?.message ?? parseError(new Error('Request failed')));
      }
    } catch (err) {
      setServerError(parseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Resend ────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendIn > 0 || submitting) return;
    setResendIn(60);
    setCodeError('');
    try {
      await fetch('/api/auth/staff/forgot-password', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ email }),
      });
      toast.info('Code resent', `Sent to ${email} — check your inbox.`);
    } catch {
      toast.error('Could not resend', 'Please try again in a moment.');
      setResendIn(15);
    }
  };

  // ── Step 2: verify OTP + set new password ────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError('');
    setPwError('');
    setServerError('');

    if (code.length !== 6) {
      setCodeError('Please enter all 6 digits of your reset code.');
      return;
    }
    const allPwReqs = pwReqsList.every((r) => r.test(password));
    if (!allPwReqs) {
      setPwError("Your password doesn't meet all the requirements listed above.");
      return;
    }
    if (password !== confirm) {
      setPwError("Passwords don't match. Please retype them carefully.");
      return;
    }

    setSubmitting(true);
    try {
      const res  = await fetch('/api/auth/staff/reset-password', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ email, otp_code: code, new_password: password }),
      });
      const json = await res.json();

      if (!res.ok) {
        const msg = json?.message ?? 'Reset failed. Please try again.';
        const lo  = msg.toLowerCase();
        if (lo.includes('code') || lo.includes('otp') || lo.includes('incorrect') || lo.includes('expired')) {
          setCodeError(msg);
        } else if (lo.includes('password')) {
          setPwError(msg);
        } else {
          setServerError(msg);
        }
        return;
      }

      setStep('done');
    } catch (err) {
      setServerError(parseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[28rem]">

      {/* ── Step 1: Email ───────────────────────────────────────────────── */}
      {step === 'email' && (
        <form onSubmit={handleSendCode} noValidate>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
            <Shield size={12} /> Staff · Reset password
          </span>
          <h1 className="display-serif mt-2 text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-ink">
            Forgot your password?
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Enter your staff email address and we&apos;ll send a 6-digit reset code to your inbox.
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

            <Field label="Staff email" htmlFor="sfp-email" required>
              <Input
                id="sfp-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@ece.envolvepharm.com.ng"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setServerError(''); }}
                required
              />
            </Field>

            <Button type="submit" loading={submitting} fullWidth size="lg" trailingIcon={<ArrowRight size={16} />}>
              Send reset code
            </Button>

            <p className="mt-6 text-center text-sm text-ink-2">
              <Link href="/staff/sign-in" className="font-medium text-brand-600 hover:underline hover:underline-offset-2">
                ← Back to staff sign-in
              </Link>
            </p>
          </div>
        </form>
      )}

      {/* ── Step 2: OTP + new password ──────────────────────────────────── */}
      {step === 'reset' && (
        <form onSubmit={handleReset} noValidate>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
            Staff · Reset password
          </span>
          <h1 className="display-serif mt-2 text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-ink">
            Set a new password.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            We sent a 6-digit code to{' '}
            <strong className="font-semibold text-ink">{email}</strong>.
            Enter it below along with your new password.
          </p>

          <div className="mt-7">
            {serverError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-500" />
                  <p className="text-sm leading-relaxed text-red-800">{serverError}</p>
                </div>
              </div>
            )}

            {/* OTP */}
            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-ink-2">
                Reset code <span className="text-danger">*</span>
              </label>
              <OtpInput value={code} onChange={(v) => { setCode(v); setCodeError(''); }} autoFocus />
              {codeError && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-danger">
                  <AlertTriangle size={12} className="shrink-0" />
                  {codeError}
                </p>
              )}
              <p className="mt-2 text-xs text-ink-3">
                Didn&apos;t receive it?{' '}
                {resendIn > 0 ? (
                  <span className="text-ink-4">Resend in {resendIn}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="font-medium text-brand-600 hover:underline hover:underline-offset-2"
                  >
                    Resend code
                  </button>
                )}
              </p>
            </div>

            {/* New password */}
            <Field label="New password" htmlFor="sfp-pw" required>
              <Input
                id="sfp-pw"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPwError(''); }}
              />
            </Field>

            {/* Strength checklist */}
            <ul className="mb-4 mt-1 space-y-1">
              {pwReqsList.map((r) => (
                <li
                  key={r.label}
                  className={cn(
                    'flex items-center gap-2 text-xs',
                    password ? (r.test(password) ? 'text-leaf-600' : 'text-danger') : 'text-ink-3',
                  )}
                >
                  <span className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    password ? (r.test(password) ? 'bg-leaf-500' : 'bg-danger') : 'bg-line-strong',
                  )} />
                  {r.label}
                </li>
              ))}
            </ul>

            <Field label="Confirm password" htmlFor="sfp-confirm" required error={pwError}>
              <Input
                id="sfp-confirm"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setPwError(''); }}
              />
            </Field>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                leadingIcon={<ArrowLeft size={16} />}
                onClick={() => {
                  setStep('email');
                  setCode(''); setPassword(''); setConfirm('');
                  setServerError(''); setCodeError(''); setPwError('');
                }}
              >
                Back
              </Button>
              <Button type="submit" loading={submitting} fullWidth size="lg" trailingIcon={<ArrowRight size={16} />}>
                Reset password
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* ── Step 3: Done ────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div>
          <span className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-leaf-100 text-leaf-700">
            <CheckCircle size={28} />
          </span>
          <h1 className="display-serif mt-6 text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-ink">
            Password reset!
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Your password has been updated. You can now sign in to the operations console with your new password.
          </p>
          <Button
            type="button"
            fullWidth
            size="lg"
            className="mt-8"
            trailingIcon={<ArrowRight size={16} />}
            onClick={() => router.push('/staff/sign-in')}
          >
            Sign in to console
          </Button>
        </div>
      )}
    </div>
  );
}
