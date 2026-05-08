/**
 * Logo — Envolve wordmark + leaf mark.
 *
 * Variants:
 *   - 'full' (default): mark + wordmark
 *   - 'mark': just the leaf circle (square format, useful for favicons/apps)
 *
 * The `monochrome` prop renders white-on-current for use against dark
 * backgrounds (auth visual panel, console sidebar).
 */

import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'full' | 'mark';
  monochrome?: boolean;
  className?: string;
}

export function Logo({ variant = 'full', monochrome = false, className }: LogoProps) {
  const wordColor = monochrome ? 'text-white' : 'text-ink';
  const markBg = monochrome ? 'bg-white/15' : 'bg-leaf-100';
  const markFg = monochrome ? 'text-white' : 'text-leaf-600';

  const Mark = (
    <span
      className={cn(
        'inline-grid h-8 w-8 shrink-0 place-items-center rounded-full',
        markBg,
        markFg,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <path
          d="M12 21c-4.5 0-7-2.5-7-7 0-4 2.5-7 7-7 .5 0 1 .05 1.5.15-.5 4-2.5 6-5.5 7 1 0 5-1 7.5-4.5 1 4-1.5 11.35-3.5 11.35z"
          fill="currentColor"
        />
        <path
          d="M19 4c-1 1.5-2.5 2.5-4 3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );

  if (variant === 'mark') return <span className={className}>{Mark}</span>;

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {Mark}
      <span
        className={cn(
          'text-lg font-medium tracking-[-0.02em]',
          wordColor,
        )}
        style={{ letterSpacing: '-0.025em' }}
      >
        envolve
        <span className={monochrome ? 'text-white/60' : 'text-brand-500'}>.</span>
      </span>
    </span>
  );
}
