/**
 * Layout primitives — Container + Section.
 * Container caps width and centers content; Section adds vertical rhythm.
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Container({
  children,
  narrow,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { narrow?: boolean }) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-safe',
        narrow ? 'max-w-[60rem]' : 'max-w-[80rem]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Section({
  children,
  tight,
  className,
}: {
  children: ReactNode;
  tight?: boolean;
  className?: string;
}) {
  return (
    <section className={cn(tight ? 'py-12 sm:py-16' : 'py-16 sm:py-24', className)}>
      {children}
    </section>
  );
}
