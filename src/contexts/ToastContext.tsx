/**
 * ToastProvider + useToast — global toast notifications.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.show({ tone: 'success', title: 'Order placed' });
 *
 * Tones: success | error | warning | info
 */

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle, AlertTriangle, InfoCircle, X, XCircle } from '@/components/icons';
import { cn } from '@/lib/utils';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

interface ToastEntry {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  leaving?: boolean;
}

interface ToastApi {
  show: (input: { tone?: ToastTone; title: string; description?: string; duration?: number }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: number) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

const TONE_STYLE: Record<ToastTone, { ring: string; iconBg: string; iconColor: string }> = {
  success: { ring: 'ring-leaf-200/70', iconBg: 'bg-leaf-100', iconColor: 'text-leaf-700' },
  error: { ring: 'ring-red-200', iconBg: 'bg-danger-soft', iconColor: 'text-red-700' },
  warning: { ring: 'ring-amber-200', iconBg: 'bg-warning-soft', iconColor: 'text-amber-700' },
  info: { ring: 'ring-cyan-200', iconBg: 'bg-info-soft', iconColor: 'text-cyan-800' },
};

const TONE_ICON: Record<ToastTone, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: InfoCircle,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((arr) => arr.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((arr) => arr.filter((t) => t.id !== id)), 220);
  }, []);

  const show: ToastApi['show'] = useCallback(
    ({ tone = 'info', title, description, duration = 4500 }) => {
      const id = ++idRef.current;
      setToasts((arr) => [...arr, { id, tone, title, description }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const api: ToastApi = {
    show,
    success: (title, description) => show({ tone: 'success', title, description }),
    error: (title, description) => show({ tone: 'error', title, description }),
    warning: (title, description) => show({ tone: 'warning', title, description }),
    info: (title, description) => show({ tone: 'info', title, description }),
    dismiss,
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-4 right-4 z-200 flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => {
          const Icon = TONE_ICON[t.tone];
          const style = TONE_STYLE[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-white p-3.5 pr-4 shadow-lg ring-1',
                style.ring,
                t.leaving ? 'animate-out fade-out duration-200' : 'animate-fade-in-up',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full',
                  style.iconBg,
                  style.iconColor,
                )}
              >
                <Icon size={14} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium tracking-tight text-ink">{t.title}</div>
                {t.description && (
                  <div className="mt-0.5 text-xs leading-relaxed text-ink-2">{t.description}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="grid h-6 w-6 place-items-center rounded text-ink-3 hover:bg-bg-muted hover:text-ink"
                aria-label="Dismiss"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
