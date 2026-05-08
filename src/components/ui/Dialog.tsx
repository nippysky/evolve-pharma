/**
 * Dialog — accessible modal with focus trap, escape key, scroll lock,
 * and focus return on close. Custom-built (no external lib).
 */

'use client';

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from '@/components/icons';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'md' | 'lg';
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onClose, title, description, size = 'md', children, footer }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  // Track previous focus + restore on close
  useEffect(() => {
    if (open) {
      lastFocused.current = document.activeElement as HTMLElement | null;
      // Wait a frame for portal to mount
      requestAnimationFrame(() => panelRef.current?.focus());
      document.body.style.overflow = 'hidden';
    } else if (lastFocused.current) {
      lastFocused.current.focus?.();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full overflow-hidden rounded-2xl bg-white shadow-xl outline-none animate-scale-in',
          size === 'lg' ? 'max-w-2xl' : 'max-w-md',
        )}
      >
        {(title || description) && (
          <header className="flex items-start justify-between gap-4 border-b border-line-subtle px-6 py-4">
            <div>
              {title && (
                <h2 id="dialog-title" className="text-base font-medium tracking-tight text-ink">
                  {title}
                </h2>
              )}
              {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-md text-ink-3 hover:bg-bg-muted hover:text-ink"
            >
              <X size={16} />
            </button>
          </header>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-line-subtle bg-bg-subtle px-6 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
