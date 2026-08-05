'use client';
import Link                from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams }    from 'next/navigation';
import { Field, Input }     from '@/components/ui/Field';
import { Button }           from '@/components/ui/Button';
import { OtpInput }         from '@/components/ui/OtpInput';
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Mail,
  Shield,
} from '@/components/icons';
import { useToast }     from '@/contexts/ToastContext';
import { useVerifyOtp, useResendOtp } from '@/hooks/auth/useCustomerAuth';
import { passwordSchema }             from '@/lib/schemas';
import { cn }                         from '@/lib/utils';

type Step = 1 | 2 | 3;
const STEPS = ['Upload PCN', 'Verify email', 'Set password'];

function StepHeader({ step, email }: { step: Step; email: string }) {
  const titles = [
    'Upload your PCN certificate.',
    'Verify your email.',
    'Secure your account.',
  ] as const;
  const subtitles = [
    'Your pharmacy account is ready. Upload your PCN certificate so our compliance team can verify your licence.',
    `We sent a 6-digit verification code to ${email || 'your email'}. Enter it below to confirm your identity.`,
    'Set a strong password to complete your account activation.',
  ] as const;

  return (
    <>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
        Complete registration · Step {step} of 3
      </span>
      <h1 className="display-serif mt-2 text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-ink">
        {titles[step - 1]}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{subtitles[step - 1]}</p>
    </>
  );
}

function InvitedPageInner() {
  const router       = useRouter();
  const toast        = useToast();
  const params       = useSearchParams();
  const email        = params.get('email') ?? '';

  // ── State ──────────────────────────────────────────────────────────────────
  const [step,        setStep]        = useState<Step>(1);
  const [certFile,    setCertFile]    = useState<File | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [code,        setCode]        = useState('');
  const [resendIn,    setResendIn]    = useState(0);
  const [otpToken,    setOtpToken]    = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [settling,    setSettling]    = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');

  const verifyOtpMutation = useVerifyOtp();
  const resendOtpMutation = useResendOtp();

  // ── Resend countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // ── Guard: if no email in URL, show error ─────────────────────────────────
  if (!email) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-red-50">
          <AlertTriangle size={24} className="text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-ink">Invalid invitation link</h2>
        <p className="max-w-xs text-sm text-ink-3">
          This link appears to be incomplete or has expired.
          Please use the exact link from your invitation email, or contact support.
        </p>
        <Link href="/sign-in" className="mt-2 text-sm font-medium text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  // ── Step 1 — upload PCN ────────────────────────────────────────────────────
  const handlePcnUpload = async () => {
    if (!certFile) {
      setErrors({ pcn_cert: 'Please select your PCN certificate file first.' });
      return;
    }
    setErrors({});
    setServerError('');
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append('email', email);
      fd.append('file', certFile);

      const res  = await fetch('/api/auth/customer/invited-pcn', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message ?? 'Upload failed. Please try again.');
      }

      // Fire a fresh OTP immediately after PCN upload — the one in the
      // invitation email may be old or overlooked. The resend endpoint
      // invalidates any previous tokens and issues a new 10-minute code.
      try {
        await fetch('/api/auth/customer/resend-otp', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email }),
        });
      } catch {
        // Non-blocking — if this fails the user can still use the resend button on step 2
        console.warn('[invited] Auto-OTP send failed; user can resend manually.');
      }

      toast.show({
        tone:        'success',
        title:       'Certificate uploaded',
        description: `A verification code has been sent to ${email}.`,
      });
      setResendIn(30); // start cooldown so user doesn't immediately double-send
      setStep(2);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Step 2 — verify OTP ───────────────────────────────────────────────────
  const handleVerify = () => {
    if (code.length !== 6) {
      setErrors({ code: 'Enter all 6 digits.' });
      return;
    }
    setErrors({});
    setServerError('');

    verifyOtpMutation.mutate(
      { email, otp_code: code },
      {
        onSuccess: (data: { token: string }) => {
          setOtpToken(data.token);
          toast.show({ tone: 'success', title: 'Email verified' });
          setStep(3);
        },
        onError: (err: Error) => setErrors({ code: err.message }),
      },
    );
  };

  const handleResend = () => {
    if (resendOtpMutation.isPending) return;
    setResendIn(60);
    resendOtpMutation.mutate(email, {
      onSuccess: () =>
        toast.show({ tone: 'info', title: 'Code resent', description: `Sent to ${email}` }),
      onError: () => {
        setResendIn(15);
        toast.show({ tone: 'error', title: 'Could not resend', description: 'Please try again in a moment.' });
      },
    });
  };

  // ── Step 3 — set password ─────────────────────────────────────────────────
  const pwReqs = [
    { ok: password.length >= 8 && password.length <= 72, label: '8–72 characters' },
    { ok: /[A-Z]/.test(password) && /[a-z]/.test(password), label: 'Upper and lowercase letters' },
    { ok: /[0-9]/.test(password), label: 'At least one number' },
    { ok: password.length > 0 && password === confirm, label: 'Passwords match' },
  ];

  const handleSetPassword = async () => {
    const e: Record<string, string> = {};
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) e.password = pw.error.issues[0]?.message ?? 'Invalid password';
    if (confirm !== password) e.confirm_password = 'Passwords do not match';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSettling(true);
    setServerError('');
    try {
      const res  = await fetch('/api/auth/customer/create-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password, token: otpToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'Could not set password.');

      toast.show({
        tone:        'success',
        title:       'Account activated!',
        description: 'Your account is pending review by our compliance team.',
      });
      setTimeout(() => router.push('/sign-up/pending'), 400);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not set password. Please try again.');
    } finally {
      setSettling(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-136">
      {/* Stepper */}
      <ol className="mb-7 flex items-center gap-2">
        {STEPS.map((label, i) => {
          const n      = (i + 1) as Step;
          const done   = n < step;
          const active = n === step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
              <span className={cn(
                'grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors',
                active ? 'border-brand-600 bg-brand-600 text-white'
                  : done ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-line bg-white text-ink-3',
              )}>
                {done ? <CheckCircle size={13} /> : n}
              </span>
              <span className={cn('hidden text-xs font-medium sm:block', active ? 'text-ink' : 'text-ink-3')}>
                {label}
              </span>
              {n < STEPS.length && (
                <span className={cn('h-px flex-1', done ? 'bg-brand-600' : 'bg-line')} />
              )}
            </li>
          );
        })}
      </ol>

      <StepHeader step={step} email={email} />

      <div className="mt-7">
        {serverError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm leading-relaxed text-red-800">{serverError}</p>
            </div>
          </div>
        )}

        {/* ── STEP 1: PCN Upload ─────────────────────────────────────────── */}
        {step === 1 && (
          <>
            {/* Context pill */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800">
              <Shield size={13} />
              Registering as&nbsp;<strong className="font-semibold">{email}</strong>
            </div>

            <Field
              label="PCN certificate"
              htmlFor="pcn_cert"
              required
              hint="PDF, JPG or PNG. Max 8 MB."
              error={errors.pcn_cert}
            >
              <label
                htmlFor="pcn_cert"
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed bg-bg-subtle px-5 py-7 text-center transition-colors',
                  certFile
                    ? 'border-leaf-400 bg-leaf-50/40'
                    : 'border-line-strong hover:border-brand-500 hover:bg-brand-50',
                )}
              >
                <span className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-brand-600">
                  {certFile ? <CheckCircle size={18} className="text-leaf-600" /> : <Upload size={18} />}
                </span>
                <span className="text-sm font-medium text-ink">
                  {certFile ? 'File selected' : 'Click to upload your certificate'}
                </span>
                <span className="text-xs text-ink-3">or drag and drop here</span>
                {certFile && (
                  <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-leaf-600">
                    <FileText size={12} />
                    {certFile.name}
                  </span>
                )}
              </label>
              <input
                id="pcn_cert"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => { setCertFile(e.target.files?.[0] ?? null); setErrors({}); }}
              />
            </Field>

            <Button
              type="button"
              fullWidth
              size="lg"
              trailingIcon={<ArrowRight size={16} />}
              loading={uploading}
              className="mt-2"
              onClick={() => { void handlePcnUpload(); }}
            >
              Upload and continue
            </Button>
          </>
        )}

        {/* ── STEP 2: OTP Verify ─────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <div className="mb-5 inline-flex items-center gap-2 rounded-md bg-info-soft px-3 py-2 text-xs text-cyan-800">
              <Mail size={13} />
              A verification code was sent to&nbsp;<strong className="font-semibold">{email}</strong>
            </div>

            <OtpInput value={code} onChange={setCode} autoFocus />
            {errors.code && <p className="mt-2 text-xs text-danger">{errors.code}</p>}

            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                leadingIcon={<ArrowLeft size={16} />}
                onClick={() => { setErrors({}); setCode(''); setStep(1); }}
              >
                Back
              </Button>
              <Button
                type="button"
                loading={verifyOtpMutation.isPending}
                fullWidth
                size="lg"
                trailingIcon={<ArrowRight size={16} />}
                onClick={handleVerify}
              >
                Verify and continue
              </Button>
            </div>

            <p className="mt-6 text-center text-sm text-ink-2">
              Didn&apos;t get the code?{' '}
              {resendIn > 0 ? (
                <span className="text-ink-3">Resend in {resendIn}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendOtpMutation.isPending}
                  className="font-medium text-brand-600 hover:underline hover:underline-offset-2 disabled:opacity-50"
                >
                  Resend code
                </button>
              )}
            </p>
          </>
        )}

        {/* ── STEP 3: Set Password ───────────────────────────────────────── */}
        {step === 3 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Password" htmlFor="password" required error={errors.password}>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </Field>
              <Field label="Confirm password" htmlFor="confirm_password" required error={errors.confirm_password}>
                <Input
                  id="confirm_password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </Field>
            </div>

            <ul className="mt-1 mb-5 space-y-1">
              {pwReqs.map((r) => (
                <li key={r.label} className={cn('flex items-center gap-2 text-xs', r.ok ? 'text-leaf-600' : 'text-ink-3')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', r.ok ? 'bg-leaf-500' : 'bg-line-strong')} />
                  {r.label}
                </li>
              ))}
            </ul>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                leadingIcon={<ArrowLeft size={16} />}
                onClick={() => { setErrors({}); setStep(2); }}
              >
                Back
              </Button>
              <Button
                type="button"
                loading={settling}
                fullWidth
                size="lg"
                trailingIcon={<ArrowRight size={16} />}
                onClick={() => { void handleSetPassword(); }}
              >
                Complete activation
              </Button>
            </div>
          </>
        )}

        <p className="mt-6 text-center text-sm text-ink-2">
          Already activated?{' '}
          <Link href="/sign-in" className="font-medium text-brand-600 hover:underline hover:underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function InvitedPage() {
  return (
    <Suspense fallback={
      <div className="flex w-full max-w-136 flex-col gap-4 animate-pulse">
        <div className="h-6 w-48 rounded bg-bg-muted" />
        <div className="h-10 w-3/4 rounded bg-bg-muted" />
        <div className="h-4 w-2/3 rounded bg-bg-muted" />
      </div>
    }>
      <InvitedPageInner />
    </Suspense>
  );
}
