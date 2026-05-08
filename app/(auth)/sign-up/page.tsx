'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Input, Checkbox } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  AlertTriangle,
  FileText,
  CheckCircle,
} from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { customerSignUpAction } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';

const initial: ActionResult = { ok: false, message: '' };

export default function SignUpPage() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [pcnFileName, setPcnFileName] = useState<string>('');

  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await customerSignUpAction(prev, fd);
    if (r.ok) {
      toast.show({
        tone: 'success',
        title: 'Account created',
        description: 'Verify your email to continue.',
      });
      setTimeout(() => router.push('/verify'), 500);
    }
    return r;
  }, initial);

  const fieldErrors = !state.ok ? state.fieldErrors : undefined;
  const error = !state.ok && !fieldErrors ? state.message : '';

  return (
    <form action={action} className="w-full max-w-[32rem]" noValidate>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
        Onboard pharmacy · Step {step} of 2
      </span>
      <h1 className="display-serif mt-2 text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-ink">
        {step === 1 ? 'Create your account.' : 'Verify your pharmacy.'}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        {step === 1
          ? 'Tell us about you and your pharmacy. Verification typically completes within 24 hours.'
          : 'Upload your PCN certificate. Our compliance team will activate your account once verified.'}
      </p>

      <div className="mt-8">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-danger-soft px-3.5 py-3 text-sm text-red-800">
            <AlertTriangle size={14} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name" htmlFor="fname" required error={fieldErrors?.fname?.[0]}>
                <Input id="fname" name="fname" autoComplete="given-name" placeholder="Amaka" required />
              </Field>
              <Field label="Last name" htmlFor="lname" required error={fieldErrors?.lname?.[0]}>
                <Input id="lname" name="lname" autoComplete="family-name" placeholder="Eze" required />
              </Field>
            </div>

            <Field label="Work email" htmlFor="email" required error={fieldErrors?.email?.[0]}>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@pharmacy.ng" required />
            </Field>

            <Field
              label="Phone"
              htmlFor="phone"
              required
              hint="Include country code (e.g. +234…)"
              error={fieldErrors?.phone?.[0]}
            >
              <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+234 800 000 0000" required />
            </Field>

            <Field label="Pharmacy / company name" htmlFor="company_name" required error={fieldErrors?.company_name?.[0]}>
              <Input id="company_name" name="company_name" placeholder="Greenleaf Pharmacy Ltd." required />
            </Field>

            <Field label="Pharmacy address" htmlFor="company_address" required error={fieldErrors?.company_address?.[0]}>
              <Input id="company_address" name="company_address" placeholder="12 Lagos St., Wuse 2, Abuja" required />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Password"
                htmlFor="password"
                required
                hint="At least 8 chars, include a number"
                error={fieldErrors?.password?.[0]}
              >
                <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="••••••••" required />
              </Field>
              <Field
                label="Confirm password"
                htmlFor="confirm_password"
                required
                error={fieldErrors?.confirm_password?.[0]}
              >
                <Input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" placeholder="••••••••" required />
              </Field>
            </div>

            <Button
              type="button"
              fullWidth
              size="lg"
              trailingIcon={<ArrowRight size={16} />}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <Field
              label="PCN certificate"
              htmlFor="pcn_cert"
              required
              hint="PDF, JPG or PNG. Max 8MB."
              error={fieldErrors?.pcn_cert_url?.[0]}
            >
              <label
                htmlFor="pcn_cert"
                className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-line-strong bg-bg-subtle px-5 py-6 text-center transition-colors hover:border-brand-500 hover:bg-brand-50"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-brand-600">
                  {pcnFileName ? <CheckCircle size={18} /> : <Upload size={18} />}
                </span>
                <span className="text-sm font-medium text-ink">
                  {pcnFileName ? 'File selected' : 'Click to upload your certificate'}
                </span>
                <span className="text-xs text-ink-3">or drag and drop here</span>
                {pcnFileName && (
                  <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-leaf-600">
                    <FileText size={12} />
                    {pcnFileName}
                  </span>
                )}
              </label>
              <input
                id="pcn_cert"
                name="pcn_cert"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setPcnFileName(e.target.files?.[0]?.name ?? '')}
                required
              />
            </Field>

            <div className="my-4">
              <Checkbox name="accept_terms" defaultChecked>
                I confirm I represent a licensed Nigerian pharmacy and accept the{' '}
                <Link href="/legal" className="text-brand-600 underline underline-offset-2">
                  Terms
                </Link>{' '}
                and{' '}
                <Link href="/legal" className="text-brand-600 underline underline-offset-2">
                  Privacy Policy
                </Link>
                .
              </Checkbox>
              {fieldErrors?.accept_terms?.[0] && (
                <p className="mt-1.5 text-xs text-danger">{fieldErrors.accept_terms[0]}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                leadingIcon={<ArrowLeft size={16} />}
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                type="submit"
                loading={pending}
                fullWidth
                size="lg"
                trailingIcon={<ArrowRight size={16} />}
              >
                Submit for verification
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
        <p className="mt-3 text-center text-xs text-ink-4">
          Joining as a sales agent?{' '}
          <Link href="/sign-up/agent" className="text-brand-600 hover:underline">
            Apply here
          </Link>
        </p>
      </div>
    </form>
  );
}
