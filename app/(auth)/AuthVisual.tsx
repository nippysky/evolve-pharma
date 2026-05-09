/**
 * AuthVisual — the gradient panel rendered on the right of the auth
 * pages on desktop. Holds the brand wordmark, an editorial pull-quote,
 * trust pills, and a glass testimonial card.
 */

import { Logo } from '@/components/shared/Logo';
import { Shield, Truck, Sparkle } from '@/components/icons';

interface AuthVisualProps {
  headline?: React.ReactNode;
  testimonial?: { body: string; author: string; role: string; initial: string };
}

const DEFAULT_HEADLINE = (
  <>
    Wholesale pharmacy procurement, <em className="not-italic text-white/85">quietly modernized</em>.
  </>
);

const DEFAULT_TESTIMONIAL = {
  body:
    "Switching to Envolve cut our procurement admin in half. Pricing is transparent, deliveries are predictable — that's rare in this market.",
  author: 'Adaobi Okonkwo',
  role: 'Owner, Greenleaf Pharmacy · Abuja',
  initial: 'A',
};

export function AuthVisual({
  headline = DEFAULT_HEADLINE,
  testimonial = DEFAULT_TESTIMONIAL,
}: AuthVisualProps = {}) {
  return (
    <aside
      aria-hidden
      className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-brand-500 via-brand-600 to-leaf-700 p-10 text-white lg:flex lg:p-16"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(700px_300px_at_85%_120%,rgba(255,255,255,0.18),transparent_60%),radial-gradient(900px_400px_at_5%_-10%,rgba(255,255,255,0.12),transparent_60%)]"
      />

      <div className="relative">
        <Logo monochrome />
      </div>

      <div className="relative max-w-md">
        <h2
          className="display-serif font-normal leading-[1.15] tracking-tight"
          style={{ fontSize: 'clamp(2rem, 3.4vw, 2.75rem)' }}
        >
          {headline}
        </h2>
        <p className="mt-6 text-sm leading-relaxed text-white/75">
          A B2B pharmaceutical platform for licensed Nigerian pharmacies. Authentic medicines,
          transparent pricing, in-house logistics.
        </p>

        <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/80">
          <li className="inline-flex items-center gap-1.5">
            <Shield size={13} /> NAFDAC verified
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Truck size={13} /> 24h dispatch
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Sparkle size={13} /> 320+ pharmacies
          </li>
        </ul>
      </div>

      <div className="relative max-w-md rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
        <p className="text-sm leading-relaxed text-white/95">&ldquo;{testimonial.body}&rdquo;</p>
        <footer className="mt-4 flex items-center gap-2.5 text-xs text-white/70">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 font-semibold text-white">
            {testimonial.initial}
          </span>
          <span>
            <strong className="block font-semibold text-white">{testimonial.author}</strong>
            {testimonial.role}
          </span>
        </footer>
      </div>
    </aside>
  );
}
