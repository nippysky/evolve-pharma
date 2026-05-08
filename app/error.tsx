'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { AlertTriangle, ArrowLeft, RotateCw } from '@/components/icons';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error(error);
    }
    // In production: forward to Sentry/Datadog here.
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-full bg-danger-soft text-danger">
          <AlertTriangle size={26} />
        </span>

        <h1 className="display-serif text-[clamp(2rem,4vw,2.75rem)] leading-[1.1] tracking-[-0.02em] text-ink">
          Something went sideways.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          We hit an unexpected error rendering this page. Our team has been notified — please try
          again in a moment.
        </p>

        {error.digest && (
          <code className="mt-5 inline-block rounded-md border border-line bg-bg-subtle px-2.5 py-1 font-mono text-xs text-ink-3">
            ref: {error.digest}
          </code>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button onClick={reset} leadingIcon={<RotateCw size={14} />}>
            Try again
          </Button>
          <ButtonLink href="/" variant="ghost" leadingIcon={<ArrowLeft size={14} />}>
            Go home
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}