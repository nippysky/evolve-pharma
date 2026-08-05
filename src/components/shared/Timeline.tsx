'use client';
import type { ReactNode } from 'react';
import { CheckCircle } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface TimelineStep {
  key: string;
  label: string;
  description?: string;
  when?: string;
  state: 'done' | 'current' | 'pending';
}

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative">
      {/* Connecting line */}
      <span
        aria-hidden
        className="absolute bottom-7 left-[8px] top-7 w-px bg-line"
      />
      {steps.map((s) => (
        <TimelineItem key={s.key} step={s} />
      ))}
    </ol>
  );
}

function TimelineItem({ step }: { step: TimelineStep }) {
  return (
    <li className="relative flex gap-3 py-2.5">
      <span
        className={cn(
          'z-10 mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[1.5px] bg-white',
          step.state === 'done' && 'border-leaf-500 bg-leaf-500 text-white',
          step.state === 'current' && 'border-brand-500 bg-brand-500 text-white',
          step.state === 'pending' && 'border-line',
        )}
      >
        {step.state === 'done' && <CheckCircle size={11} />}
      </span>
      <div className="min-w-0 pb-2">
        <div
          className={cn(
            'text-sm tracking-tight',
            step.state === 'pending' ? 'text-ink-3' : 'font-medium text-ink',
          )}
        >
          {step.label}
        </div>
        {step.description && (
          <div className="mt-0.5 text-xs text-ink-3">{step.description}</div>
        )}
        {step.when && <div className="mt-1 text-xs text-ink-4">{step.when}</div>}
      </div>
    </li>
  );
}

/** Helper for sections that mix a heading with a content body. */
export function SectionPanel({
  title,
  meta,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <header className="flex items-center justify-between border-b border-line-subtle px-5 py-3.5">
        <span className="inline-flex items-center gap-2 text-sm font-medium tracking-tight text-ink">
          {title}
        </span>
        {meta}
      </header>
      <div>{children}</div>
    </section>
  );
}
