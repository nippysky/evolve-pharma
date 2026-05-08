/**
 * PageHead — standard portal/console page header.
 * Pairs a title (and optional subtitle) with optional right-aligned actions.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeadProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHead({ title, subtitle, actions, className }: PageHeadProps) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8', className)}>
      <div className="min-w-0">
        <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
