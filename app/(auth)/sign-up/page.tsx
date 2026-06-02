'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Input, Checkbox } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  AlertTriangle,
  FileText,
  CheckCircle,
  Mail,
} from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { customerSignUpAction, requestEmailCode, verifyEmailCode } from '@/lib/actions';
import { customerDetailsSchema, passwordSchema } from '@/lib/schemas';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3 | 4;

const STEPS = ['Details', 'Certificate', 'Verify', 'Password'];

const emptyDetails = {
  first_name: '',
  middle_name: '',
  last_name: '',
  company_name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  country: 'Nigeria',
};

export default function SignUpPage() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<Step>(1);
  const [details, setDetails] = useState(emptyDetails);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof details) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDetails((d) => ({ ...d, [k]: e.target.value }));

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = async () => {
    setResendIn(30);
    setCodeSent(true);
    const r = await requestEmailCode(details.email);
    if (r.ok) {
      toast.show({
        tone: 'info',
        title: 'Code sent',
        description: `We sent a 6-digit code to ${details.email}.`,
      });
    } else {
      setResendIn(0);
      toast.show({ tone: 'error', title: 'Could not send code', description: r.message });
    }
  };

  // ---- step transitions -------------------------------------------------

  const validateDetails = () => {
    const r = customerDetailsSchema.safeParse(details);
    if (r.success) {
      setErrors({});
      return true;
    }
    const fe = r.error.flatten().fieldErrors;
    const e: Record<string, string> = {};
    Object.entries(fe).forEach(([k, msgs]) => {
      if (msgs?.[0]) e[k] = msgs[0];
    });
    setErrors(e);
    return false;
  };

  const next1 = () => {
    if (validateDetails()) setStep(2);
  };

  const next2 = async () => {
    if (!certFile) {
      setErrors({ pcn_cert: 'Please upload your PCN certificate' });
      return;
    }
    setErrors({});
    setStep(3);
    if (!codeSent) await sendCode();
  };

  const verifyStep = async () => {
    if (code.length !== 6) {
      setErrors({ code: 'Enter all 6 digits' });
      return;
    }
    setVerifying(true);
    setErrors({});
    const r = await verifyEmailCode(details.email, code);
    setVerifying(false);
    if (r.ok) {
      toast.show({ tone: 'success', title: 'Email verified' });
      setStep(4);
    } else {
      setErrors({ code: r.message });
    }
  };

  const pwReqs = [
    { ok: password.length >= 8 && password.length <= 72, label: '8–72 characters' },
    { ok: /[A-Z]/.test(password) && /[a-z]/.test(password), label: 'Upper and lowercase letters' },
    { ok: /[0-9]/.test(password), label: 'At least one number' },
    { ok: password.length > 0 && password === confirm, label: 'Passwords match' },
  ];

  const completeRegistration = async () => {
    const e: Record<string, string> = {};
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) e.password = pw.error.issues[0]?.message ?? 'Invalid password';
    if (confirm !== password) e.confirm_password = 'Passwords do not match';
    if (!acceptTerms) e.accept_terms = 'Please accept the terms to continue';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSubmitting(true);
    setServerError('');
    const fd = new FormData();
    Object.entries(details).forEach(([k, v]) => fd.set(k, v));
    if (certFile) fd.set('pcn_cert', certFile);
    fd.set('email_verified', 'true');
    fd.set('password', password);
    fd.set('confirm_password', confirm);
    fd.set('accept_terms', acceptTerms ? 'on' : 'off');

    const r = await customerSignUpAction(null, fd);
    setSubmitting(false);
    if (r.ok) {
      toast.show({
        tone: 'success',
        title: 'Registration submitted',
        description: 'Your account is pending review.',
      });
      setTimeout(() => router.push('/sign-up/pending'), 400);
    } else {
      setServerError(r.message);
      if (r.fieldErrors) {
        const mapped: Record<string, string> = {};
        Object.entries(r.fieldErrors).forEach(([k, msgs]) => {
          if (msgs?.[0]) mapped[k] = msgs[0];
        });
        setErrors((prev) => ({ ...prev, ...mapped }));
      }
    }
  };

  const title =
    step === 1
      ? 'Create your account.'
      : step === 2
        ? 'Verify your pharmacy.'
        : step === 3
          ? 'Confirm your email.'
          : 'Secure your account.';

  const subtitle =
    step === 1
      ? 'Tell us about you and your pharmacy.'
      : step === 2
        ? 'Upload your PCN certificate so our compliance team can verify you.'
        : step === 3
          ? `Enter the 6-digit code we sent to ${details.email}.`
          : 'Set a password to finish your registration.';

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="w-full max-w-136">
      {/* Stepper */}
      <ol className="mb-7 flex items-center gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
              <span
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors',
                  active
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : done
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-line bg-white text-ink-3',
                )}
              >
                {n}
              </span>
              <span
                className={cn(
                  'hidden text-xs font-medium sm:block',
                  active ? 'text-ink' : 'text-ink-3',
                )}
              >
                {label}
              </span>
              {n < STEPS.length && (
                <span className={cn('h-px flex-1', done ? 'bg-brand-600' : 'bg-line')} />
              )}
            </li>
          );
        })}
      </ol>

      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
        Onboard pharmacy · Step {step} of 4
      </span>
      <h1 className="display-serif mt-2 text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-ink">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{subtitle}</p>

      <div className="mt-7">
        {serverError && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-danger-soft px-3.5 py-3 text-sm text-red-800">
            <AlertTriangle size={14} className="mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        {/* STEP 1 — details */}
        {step === 1 && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="First name" htmlFor="first_name" required error={errors.first_name}>
                <Input id="first_name" name="first_name" value={details.first_name} onChange={set('first_name')} autoComplete="given-name" placeholder="Amaka" />
              </Field>
              <Field label="Middle name" htmlFor="middle_name" error={errors.middle_name}>
                <Input id="middle_name" name="middle_name" value={details.middle_name} onChange={set('middle_name')} autoComplete="additional-name" placeholder="Optional" />
              </Field>
              <Field label="Last name" htmlFor="last_name" required error={errors.last_name}>
                <Input id="last_name" name="last_name" value={details.last_name} onChange={set('last_name')} autoComplete="family-name" placeholder="Eze" />
              </Field>
            </div>

            <Field label="Pharmacy / company name" htmlFor="company_name" required error={errors.company_name}>
              <Input id="company_name" name="company_name" value={details.company_name} onChange={set('company_name')} placeholder="Greenleaf Pharmacy Ltd." />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Work email" htmlFor="email" required error={errors.email}>
                <Input id="email" name="email" type="email" value={details.email} onChange={set('email')} autoComplete="email" placeholder="you@pharmacy.ng" />
              </Field>
              <Field label="Phone" htmlFor="phone" required hint="Include country code" error={errors.phone}>
                <Input id="phone" name="phone" type="tel" value={details.phone} onChange={set('phone')} autoComplete="tel" placeholder="+234 800 000 0000" />
              </Field>
            </div>

            <Field label="Street address" htmlFor="address" required error={errors.address}>
              <Input id="address" name="address" value={details.address} onChange={set('address')} autoComplete="street-address" placeholder="12 Lagos St., Wuse 2" />
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="City" htmlFor="city" required error={errors.city}>
                <Input id="city" name="city" value={details.city} onChange={set('city')} autoComplete="address-level2" placeholder="Abuja" />
              </Field>
              <Field label="State" htmlFor="state" required error={errors.state}>
                <Input id="state" name="state" value={details.state} onChange={set('state')} autoComplete="address-level1" placeholder="FCT" />
              </Field>
              <Field label="Country" htmlFor="country" required error={errors.country}>
                <Input id="country" name="country" value={details.country} onChange={set('country')} autoComplete="country-name" placeholder="Nigeria" />
              </Field>
            </div>

            <Button type="button" fullWidth size="lg" trailingIcon={<ArrowRight size={16} />} onClick={next1}>
              Continue
            </Button>
          </>
        )}

        {/* STEP 2 — certificate */}
        {step === 2 && (
          <>
            <Field label="PCN certificate" htmlFor="pcn_cert" required hint="PDF, JPG or PNG. Max 8MB." error={errors.pcn_cert}>
              <label
                htmlFor="pcn_cert"
                className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-line-strong bg-bg-subtle px-5 py-7 text-center transition-colors hover:border-brand-500 hover:bg-brand-50"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-brand-600">
                  {certFile ? <CheckCircle size={18} /> : <Upload size={18} />}
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
                name="pcn_cert"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
              />
            </Field>

            <div className="mt-2 flex gap-2">
              <Button type="button" variant="ghost" leadingIcon={<ArrowLeft size={16} />} onClick={() => { setErrors({}); setStep(1); }}>
                Back
              </Button>
              <Button type="button" fullWidth size="lg" trailingIcon={<ArrowRight size={16} />} onClick={next2}>
                Continue
              </Button>
            </div>
          </>
        )}

        {/* STEP 3 — verify email */}
        {step === 3 && (
          <>
            <div className="mb-5 inline-flex items-center gap-2 rounded-md bg-info-soft px-3 py-2 text-xs text-cyan-800">
              <Mail size={13} />
              A 6-digit code was sent to <strong className="font-semibold">{details.email}</strong>
            </div>

            <OtpInput value={code} onChange={setCode} autoFocus />
            {errors.code && <p className="mt-2 text-xs text-danger">{errors.code}</p>}

            <p className="mt-3 text-xs text-ink-4">Demo: any 6 digits will verify.</p>

            <div className="mt-5 flex gap-2">
              <Button type="button" variant="ghost" leadingIcon={<ArrowLeft size={16} />} onClick={() => { setErrors({}); setStep(2); }}>
                Back
              </Button>
              <Button type="button" loading={verifying} fullWidth size="lg" trailingIcon={<ArrowRight size={16} />} onClick={verifyStep}>
                Verify and continue
              </Button>
            </div>

            <p className="mt-6 text-center text-sm text-ink-2">
              Didn&apos;t get the code?{' '}
              {resendIn > 0 ? (
                <span className="text-ink-3">Resend in {resendIn}s</span>
              ) : (
                <button type="button" onClick={sendCode} className="font-medium text-brand-600 hover:underline hover:underline-offset-2">
                  Resend code
                </button>
              )}
            </p>
          </>
        )}

        {/* STEP 4 — password */}
        {step === 4 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Password" htmlFor="password" required error={errors.password}>
                <Input id="password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
              </Field>
              <Field label="Confirm password" htmlFor="confirm_password" required error={errors.confirm_password}>
                <Input id="confirm_password" name="confirm_password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
              </Field>
            </div>

            <ul className="mt-1 mb-4 space-y-1">
              {pwReqs.map((r) => (
                <li key={r.label} className={cn('flex items-center gap-2 text-xs', r.ok ? 'text-leaf-600' : 'text-ink-3')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', r.ok ? 'bg-leaf-500' : 'bg-line-strong')} />
                  {r.label}
                </li>
              ))}
            </ul>

            <div className="mb-4">
              <Checkbox name="accept_terms" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)}>
                I confirm I represent a licensed Nigerian pharmacy and accept the{' '}
                <Link href="/legal" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline underline-offset-2">
                  Terms
                </Link>{' '}
                and{' '}
                <Link href="/legal" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline underline-offset-2">
                  Privacy Policy
                </Link>
                .
              </Checkbox>
              {errors.accept_terms && <p className="mt-1.5 text-xs text-danger">{errors.accept_terms}</p>}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="ghost" leadingIcon={<ArrowLeft size={16} />} onClick={() => { setErrors({}); setStep(3); }}>
                Back
              </Button>
              <Button type="button" loading={submitting} fullWidth size="lg" trailingIcon={<ArrowRight size={16} />} onClick={completeRegistration}>
                Complete registration
              </Button>
            </div>
          </>
        )}

        <p className="mt-6 text-center text-sm text-ink-2">
          Already have an account?{' '}
          <Link href="/sign-in" className="font-medium text-brand-600 hover:underline hover:underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </form>
  );
}