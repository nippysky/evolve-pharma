import { Spinner } from '@/components/icons';

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="grid min-h-[60dvh] place-items-center"
    >
      {/* Top progress shimmer */}
      <span
        aria-hidden
        className="fixed inset-x-0 top-0 z-60 h-0.5 overflow-hidden bg-transparent"
      >
        <span className="block h-full w-1/3 -translate-x-full animate-[loadingBar_1.2s_ease-in-out_infinite] bg-linear-to-r from-transparent via-brand-500 to-transparent" />
      </span>

      <div className="flex flex-col items-center gap-3 opacity-0 animate-[loadingFade_240ms_ease-out_180ms_forwards]">
        <Spinner size={22} className="animate-spin text-brand-500" />
        <span className="text-xs tracking-[0.06em] text-ink-3">Loading</span>
      </div>
    </div>
  );
}