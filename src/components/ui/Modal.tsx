'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from '@/components/icons';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'md' | 'lg' | 'xl';
  footer?: ReactNode;
  children: ReactNode;
}

const SIZES = { md: 'sm:max-w-md', lg: 'sm:max-w-xl', xl: 'sm:max-w-3xl' };

export function Modal({ open, onClose, title, description, size = 'lg', footer, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-in-up',
          /* cap height so it always fits — leave ~2rem breathing room top + bottom */
          'max-h-[min(90vh,90dvh)]',
          SIZES[size],
        )}
      >
        {/* ── Header (fixed height) ── */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line-subtle px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink-2">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-bg-muted hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        {/* ── Scrollable body ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {/* ── Footer (fixed height) ── */}
        {footer && <div className="shrink-0 border-t border-line-subtle bg-bg-subtle px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}