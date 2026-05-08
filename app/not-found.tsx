import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';
import { ArrowRight, ArrowLeft, Search } from '@/components/icons';

export const metadata = {
  title: 'Page not found',
  description: 'The page you’re looking for has moved or never existed.',
};

export default function NotFound() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-bg px-6">
      {/* Ambient gradient */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_50%_-10%,rgba(0,166,212,0.08),transparent_60%),radial-gradient(700px_300px_at_50%_120%,rgba(22,163,74,0.06),transparent_60%)]"
      />

      <div className="w-full max-w-md text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">
          Error 404
        </span>

        <h1 className="display-serif mt-4 text-[clamp(4.5rem,12vw,8rem)] leading-[0.95] tracking-[-0.03em] text-ink">
          Lost the <span className="italic text-brand-600">thread</span>.
        </h1>

        <p className="mx-auto mt-6 max-w-sm text-base leading-relaxed text-ink-2">
          The page you were after has moved, been renamed, or never existed. Let&apos;s get you
          back on familiar ground.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/" trailingIcon={<ArrowRight size={14} />}>
            Go home
          </ButtonLink>
          <ButtonLink href="/products" variant="secondary" leadingIcon={<Search size={14} />}>
            Browse catalog
          </ButtonLink>
        </div>

        <Link
          href="/contact"
          className="mt-8 inline-flex items-center gap-1.5 text-sm text-ink-3 transition-colors hover:text-ink"
        >
          <ArrowLeft size={12} />
          Or contact our team if you think this is broken
        </Link>
      </div>
    </main>
  );
}