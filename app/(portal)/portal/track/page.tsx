'use client';

import { useState, FormEvent }    from 'react';
import { PageHead }               from '@/components/shared/PageHead';
import { Truck, Search, Package, CheckCircle, Clock, MapPin } from '@/components/icons';
import { cn }                     from '@/lib/utils';

// ── Status display helpers ────────────────────────────────────────────────────

const DELIVERY_STATUS_META: Record<string, { label: string; color: string; step: number }> = {
  AWAITING_DISPATCH: { label: 'Awaiting dispatch',  color: 'text-amber-600',  step: 1 },
  ASSIGNED:          { label: 'Driver assigned',    color: 'text-blue-600',   step: 2 },
  IN_TRANSIT:        { label: 'In transit',          color: 'text-teal-600',   step: 3 },
  OUT_FOR_DELIVERY:  { label: 'Out for delivery',   color: 'text-teal-600',   step: 4 },
  DELIVERED:         { label: 'Delivered',           color: 'text-green-600',  step: 5 },
  FAILED:            { label: 'Delivery failed',    color: 'text-red-600',    step: 0 },
  RETURNED:          { label: 'Returned',            color: 'text-red-600',    step: 0 },
};

const STEPS = [
  { step: 1, label: 'Order placed' },
  { step: 2, label: 'Dispatched' },
  { step: 3, label: 'In transit' },
  { step: 4, label: 'Out for delivery' },
  { step: 5, label: 'Delivered' },
];

interface TrackResult {
  tracking_code:   string;
  delivery_status: string;
  order_number:    string | null;
  order_status:    string | null;
  delivery_city:   string | null;
  delivery_state:  string | null;
  dispatched_at:   string | null;
  delivered_at:    string | null;
  order_placed_at: string | null;
}

function fmt(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function TrackOrderPage() {
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [result,  setResult]  = useState<TrackResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res  = await fetch(`/api/track/${encodeURIComponent(trimmed)}`);
      const body = await res.json();
      if (!res.ok || body.status !== 'success') {
        setError(body.message ?? 'Tracking code not found.');
      } else {
        setResult(body.data);
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const meta    = result ? DELIVERY_STATUS_META[result.delivery_status] ?? null : null;
  const curStep = meta?.step ?? 0;

  return (
    <>
      <PageHead
        title="Track your order"
        subtitle="Enter the tracking code from your dispatch email or order detail page."
      />

      {/* Search card */}
      <div className="mx-auto max-w-xl">
        <form
          onSubmit={handleSubmit}
          className="flex gap-2 rounded-2xl border border-line bg-white p-4 shadow-sm"
        >
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="e.g. EP-1234567890-ABCD"
            className="flex-1 rounded-lg border border-line bg-bg-muted px-3 py-2 font-mono text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors',
              'bg-teal-600 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Search size={14} />
            {loading ? 'Searching…' : 'Track'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Result */}
        {result && meta && (
          <div className="mt-6 space-y-4">
            {/* Status hero */}
            <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className={cn('mt-0.5 rounded-full bg-teal-50 p-2', meta.color)}>
                  <Truck size={20} />
                </span>
                <div>
                  <p className={cn('text-base font-semibold', meta.color)}>{meta.label}</p>
                  {result.order_number && (
                    <p className="mt-0.5 text-xs text-ink-3">Order #{result.order_number}</p>
                  )}
                  <p className="mt-0.5 font-mono text-xs text-ink-3">{result.tracking_code}</p>
                </div>
              </div>

              {/* Progress steps */}
              {curStep > 0 && (
                <div className="mt-5">
                  <div className="relative flex items-center justify-between">
                    {/* connector line */}
                    <div className="absolute left-0 right-0 top-3 h-0.5 bg-line" />
                    <div
                      className="absolute left-0 top-3 h-0.5 bg-teal-500 transition-all"
                      style={{ width: `${Math.max(0, ((curStep - 1) / 4) * 100)}%` }}
                    />
                    {STEPS.map(s => (
                      <div key={s.step} className="relative z-10 flex flex-col items-center gap-1">
                        <span
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors',
                            s.step < curStep
                              ? 'border-teal-500 bg-teal-500 text-white'
                              : s.step === curStep
                              ? 'border-teal-500 bg-white text-teal-600'
                              : 'border-line bg-white text-ink-3',
                          )}
                        >
                          {s.step < curStep ? '✓' : s.step}
                        </span>
                        <span className="hidden text-center text-[9px] text-ink-3 sm:block">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Info cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              {result.delivery_city && (
                <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-3">
                  <MapPin size={16} className="text-ink-3 shrink-0" />
                  <div>
                    <p className="text-[10px] text-ink-3">Destination</p>
                    <p className="text-sm font-medium">{result.delivery_city}, {result.delivery_state}</p>
                  </div>
                </div>
              )}
              {result.order_placed_at && (
                <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-3">
                  <Package size={16} className="text-ink-3 shrink-0" />
                  <div>
                    <p className="text-[10px] text-ink-3">Order placed</p>
                    <p className="text-sm font-medium">{fmt(result.order_placed_at)}</p>
                  </div>
                </div>
              )}
              {result.dispatched_at && (
                <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-3">
                  <Truck size={16} className="text-ink-3 shrink-0" />
                  <div>
                    <p className="text-[10px] text-ink-3">Dispatched</p>
                    <p className="text-sm font-medium">{fmt(result.dispatched_at)}</p>
                  </div>
                </div>
              )}
              {result.delivered_at && (
                <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-3">
                  <CheckCircle size={16} className="text-green-600 shrink-0" />
                  <div>
                    <p className="text-[10px] text-ink-3">Delivered</p>
                    <p className="text-sm font-medium text-green-700">{fmt(result.delivered_at)}</p>
                  </div>
                </div>
              )}
            </div>

            <p className="text-center text-xs text-ink-3">
              Tracking code: <span className="font-mono">{result.tracking_code}</span>
            </p>
          </div>
        )}

        {/* Empty state (no search yet) */}
        {!result && !error && !loading && (
          <div className="mt-10 flex flex-col items-center gap-3 text-center text-ink-3">
            <Clock size={36} className="opacity-30" />
            <p className="text-sm">Enter your tracking code above to see real-time delivery status.</p>
            <p className="text-xs opacity-60">
              You can find your tracking code in the dispatch email or on your order detail page.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
