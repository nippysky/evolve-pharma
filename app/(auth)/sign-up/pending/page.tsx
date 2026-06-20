import Link from 'next/link';
import { Clock, CheckCircle, Mail, ArrowRight } from '@/components/icons';

/**
 * Shown after a customer completes registration (status = PENDING_REVIEW),
 * or when a PENDING_REVIEW customer tries to log in.
 * Once admin approves → status becomes APPROVED → customer can sign in.
 */
export default function RegistrationPendingPage() {
  const steps = [
    {
      icon: CheckCircle,
      title: 'Registration complete',
      body: 'Your account and PCN certificate have been submitted successfully.',
      done: true,
    },
    {
      icon: Clock,
      title: 'Compliance review',
      body: 'Our team verifies your PCN certificate and pharmacy registration.',
      done: false,
    },
    {
      icon: Mail,
      title: 'Approval email',
      body: "You'll receive an email once your account is approved and ready to use.",
      done: false,
    },
  ] as const;

  return (
    <div className="w-full max-w-104 text-center">
      {/* Icon */}
      <span className="inline-grid h-16 w-16 place-items-center rounded-full bg-amber-50 text-amber-500 ring-8 ring-amber-50/50">
        <Clock size={28} />
      </span>

      <h1 className="display-serif mt-6 text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-ink">
        Account pending review.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        Thank you for registering with Envolve Pharmaceuticals. Our compliance team is
        reviewing your PCN certificate and pharmacy details — usually within{' '}
        <strong className="font-semibold text-ink">24–48 hours</strong>.
      </p>

      {/* Step tracker */}
      <div className="mt-8 rounded-xl border border-line bg-white p-5 text-left">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
          What happens next
        </p>
        <ol className="mt-4 space-y-4">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3.5">
              <span
                className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                  step.done ? 'bg-leaf-100 text-leaf-700' : 'bg-bg-muted text-ink-3'
                }`}
              >
                <step.icon size={14} />
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${step.done ? 'text-leaf-700' : 'text-ink'}`}>
                  {step.title}
                  {step.done && (
                    <span className="ml-2 rounded-full bg-leaf-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-leaf-700">
                      Done
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Contact */}
      <p className="mt-6 text-sm text-ink-3">
        Questions?{' '}
        <a
          href="mailto:support@envolvepharm.com.ng"
          className="font-medium text-brand-600 hover:underline hover:underline-offset-2"
        >
          support@envolvepharm.com.ng
        </a>
      </p>

      {/* Already approved */}
      <div className="mt-8 border-t border-line-subtle pt-6">
        <p className="text-sm text-ink-2">Already received your approval email?</p>
        <Link
          href="/sign-in"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline hover:underline-offset-2"
        >
          Sign in to your account
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}