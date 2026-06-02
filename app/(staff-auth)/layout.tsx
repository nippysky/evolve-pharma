import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/shared/Logo';
import { ArrowLeft } from '@/components/icons';
import { StaffAuthVisual } from './StaffAuthVisual';

export default function StaffAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-dvh overflow-hidden lg:grid-cols-[1fr_1.1fr]">
      <div className="flex h-dvh flex-col p-6 sm:p-10">
        <header className="flex shrink-0 items-center justify-between gap-4">
          <Link href="/" aria-label="Envolve home">
            <Logo />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-ink-3 transition-colors hover:text-ink"
          >
            <ArrowLeft size={14} /> Back to home
          </Link>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center py-10">{children}</div>
        </div>
      </div>
      <StaffAuthVisual />
    </div>
  );
}