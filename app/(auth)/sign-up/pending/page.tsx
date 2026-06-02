import Link from 'next/link';
import { CheckCircle, ArrowLeft } from '@/components/icons';

export default function RegistrationPendingPage() {
  return (
    <div className="w-full max-w-104 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-leaf-100 text-leaf-700">
        <CheckCircle size={26} />
      </span>

      <h1 className="display-serif mt-5 text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-ink">
        Registration submitted.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        Thanks for registering your pharmacy with Envolve. Because we supply prescription-grade
        products, every new account is reviewed by our compliance team before it&apos;s activated —
        so you won&apos;t be able to sign in just yet.
      </p>

      <div className="mt-6 rounded-xl border border-line bg-bg-subtle p-4 text-left text-sm text-ink-2">
        <p className="font-medium text-ink">What happens next</p>
        <ol className="mt-2 space-y-1.5">
          <li>1. An admin verifies your PCN certificate and business details.</li>
          <li>2. You&apos;ll get an email once your account is approved — usually within 24 hours.</li>
          <li>3. Sign in and start ordering.</li>
        </ol>
      </div>

      <p className="mt-6 text-sm text-ink-2">
        Questions?{' '}
        <a href="mailto:orders@envolvepharm.com.ng" className="font-medium text-brand-600 hover:underline">
          orders@envolvepharm.com.ng
        </a>
      </p>

      <div className="mt-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 transition-colors hover:text-ink">
          <ArrowLeft size={14} /> Back to home
        </Link>
      </div>
    </div>
  );
}