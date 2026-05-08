'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Input, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ArrowRight, AlertTriangle } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { agentSelfSignUpAction } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';

const initial: ActionResult = { ok: false, message: '' };

const REGIONS = [
  'Abuja (FCT)', 'Lagos', 'Port Harcourt', 'Kano', 'Kaduna', 'Ibadan', 'Enugu', 'Benin City', 'Other',
];

export default function AgentSignUpPage() {
  const router = useRouter();
  const toast = useToast();
  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await agentSelfSignUpAction(prev, fd);
    if (r.ok) {
      toast.show({
        tone: 'success',
        title: 'Application received',
        description: 'Our agent ops team will be in touch within 48 hours.',
      });
      setTimeout(() => router.push('/'), 800);
    }
    return r;
  }, initial);

  const fieldErrors = !state.ok ? state.fieldErrors : undefined;
  const error = !state.ok && !fieldErrors ? state.message : '';

  return (
    <form action={action} className="w-full max-w-[26rem]" noValidate>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
        Sales agent application
      </span>
      <h1 className="display-serif mt-2 text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-ink">
        Help pharmacies modernize.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Join the Envolve field team. Commission-based earnings with full operational support so
        you can focus on relationships, not paperwork.
      </p>

      <div className="mt-8">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-danger-soft px-3.5 py-3 text-sm text-red-800">
            <AlertTriangle size={14} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" htmlFor="fname" required error={fieldErrors?.fname?.[0]}>
            <Input id="fname" name="fname" autoComplete="given-name" required />
          </Field>
          <Field label="Last name" htmlFor="lname" required error={fieldErrors?.lname?.[0]}>
            <Input id="lname" name="lname" autoComplete="family-name" required />
          </Field>
        </div>

        <Field label="Email" htmlFor="email" required error={fieldErrors?.email?.[0]}>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>

        <Field label="Phone" htmlFor="phone" required error={fieldErrors?.phone?.[0]}>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+234 800 000 0000" required />
        </Field>

        <Field label="Region" htmlFor="region" required error={fieldErrors?.region?.[0]}>
          <Select id="region" name="region" required defaultValue="">
            <option value="" disabled>Select your primary region</option>
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
          </Select>
        </Field>

        <Field label="Referral code (optional)" htmlFor="referral_code">
          <Input id="referral_code" name="referral_code" placeholder="e.g. AMK-22" />
        </Field>

        <Button type="submit" loading={pending} fullWidth size="lg" trailingIcon={<ArrowRight size={16} />}>
          Submit application
        </Button>

        <p className="mt-6 text-center text-sm text-ink-2">
          Looking to onboard your pharmacy instead?{' '}
          <Link href="/sign-up" className="font-medium text-brand-600 hover:underline hover:underline-offset-2">
            Sign up here
          </Link>
        </p>
      </div>
    </form>
  );
}
