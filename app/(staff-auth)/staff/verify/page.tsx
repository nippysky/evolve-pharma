'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Field, Input } from '@/components/ui/Field';
import { Button }       from '@/components/ui/Button';
import { CheckCircle, AlertTriangle, Shield, ArrowRight } from '@/components/icons';
import { cn } from '@/lib/utils';

type Stage = 'verifying' | 'password' | 'error' | 'done';

const pwReqsList = [
  { test: (p: string) => p.length >= 8 && p.length <= 128,             label: '8–128 characters' },
  { test: (p: string) => /[A-Z]/.test(p) && /[a-z]/.test(p),          label: 'Upper and lowercase letters' },
  { test: (p: string) => /[0-9]/.test(p),                              label: 'At least one number' },
];

export default function StaffVerifyPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const urlToken     = searchParams.get('token') ?? '';

  const [stage,      setStage]      = useState<Stage>('verifying');
  const [setupToken, setSetupToken] = useState('');
  const [staffName,  setStaffName]  = useState('');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [pwError,    setPwError]    = useState('');
  const [saving,     setSaving]     = useState(false);

  // ── Step 1: verify token on mount ────────────────────────────────────────
  useEffect(() => {
    if (!urlToken) {
      setErrorMsg('No verification token found in the link. Please use the exact link from your invitation email.');
      setStage('error');
      return;
    }

    (async () => {
      try {
        const res  = await fetch(`/api/auth/staff/verify-email?token=${encodeURIComponent(urlToken)}`);
        const json = await res.json();

        if (!res.ok) {
          setErrorMsg(json?.message ?? 'Verification failed. This link may have expired or already been used.');
          setStage('error');
          return;
        }

        setSetupToken(json.data?.token ?? '');
        setStaffName(json.data?.name  ?? '');
        setStage('password');
      } catch {
        setErrorMsg('Network error. Please check your connection and try again.');
        setStage('error');
      }
    })();
  }, [urlToken]);

  // ── Step 2: create password ───────────────────────────────────────────────
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');

    const allReqsMet = pwReqsList.every((r) => r.test(password));
    if (!allReqsMet) { setPwError('Password does not meet all requirements.'); return; }
    if (password !== confirm) { setPwError('Passwords do not match.'); return; }

    setSaving(true);
    try {
      const res  = await fetch('/api/auth/staff/create-password', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ password, token: setupToken }),
      });
      const json = await res.json();

      if (!res.ok) {
        setPwError(json?.message ?? 'Could not set password. Please try again.');
        return;
      }

      setStage('done');
      setTimeout(() => router.push('/staff/sign-in'), 2500);
    } catch {
      setPwError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-md">
      {/* ── Verifying ─────────────────────────────────────────────────────── */}
      {stage === 'verifying' && (
        <div className="text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-brand-50">
            <Shield size={24} className="animate-pulse text-brand-600" />
          </div>
          <h1 className="text-xl font-bold text-ink">Verifying your link…</h1>
          <p className="mt-2 text-sm text-ink-3">This only takes a moment.</p>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {stage === 'error' && (
        <div className="text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-danger/10">
            <AlertTriangle size={24} className="text-danger" />
          </div>
          <h1 className="text-xl font-bold text-ink">Link not valid</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-3">{errorMsg}</p>
          <p className="mt-5 text-sm text-ink-3">
            Contact your administrator to resend the invitation email.
          </p>
          <a
            href="mailto:support@envolvepharm.com.ng"
            className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            support@envolvepharm.com.ng
          </a>
        </div>
      )}

      {/* ── Done ──────────────────────────────────────────────────────────── */}
      {stage === 'done' && (
        <div className="text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-leaf-100">
            <CheckCircle size={24} className="text-leaf-600" />
          </div>
          <h1 className="text-xl font-bold text-ink">Account activated!</h1>
          <p className="mt-2 text-sm text-ink-3">
            Redirecting you to the sign-in page…
          </p>
        </div>
      )}

      {/* ── Password form ─────────────────────────────────────────────────── */}
      {stage === 'password' && (
        <>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
            Account setup
          </span>
          <h1 className="display-serif mt-2 text-[clamp(1.75rem,4vw,2.25rem)] leading-[1.1] tracking-[-0.02em] text-ink">
            Set your password.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            {staffName ? `Welcome, ${staffName}! ` : ''}
            Choose a strong password to activate your EnvolveCare staff account.
          </p>

          <form onSubmit={handleSetPassword} className="mt-7 space-y-0" noValidate>
            <Field label="Password" htmlFor="pw" required>
              <Input
                id="pw"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPwError(''); }}
              />
            </Field>

            {/* Password strength checklist */}
            <ul className="mb-4 mt-1 space-y-1">
              {pwReqsList.map((r) => (
                <li key={r.label} className={cn('flex items-center gap-2 text-xs',
                  password ? (r.test(password) ? 'text-leaf-600' : 'text-danger') : 'text-ink-3',
                )}>
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full',
                    password ? (r.test(password) ? 'bg-leaf-500' : 'bg-danger') : 'bg-line-strong',
                  )} />
                  {r.label}
                </li>
              ))}
            </ul>

            <Field label="Confirm password" htmlFor="confirm" required error={pwError}>
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setPwError(''); }}
              />
            </Field>

            <Button
              type="submit"
              loading={saving}
              fullWidth
              size="lg"
              trailingIcon={<ArrowRight size={16} />}
            >
              Activate my account
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
