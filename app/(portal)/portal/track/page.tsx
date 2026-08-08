'use client';

import { useState, FormEvent } from 'react';
import { PageHead }            from '@/components/shared/PageHead';
import {
  Truck, Search, Package, CheckCircle, Clock, MapPin,
  ClipboardList, RotateCw, AlertTriangle,
} from '@/components/icons';
import { cn } from '@/lib/utils';

// ── Order-status → step mapping ──────────────────────────────────────────────
//   Steps 1-5 cover the full order lifecycle from placement to delivery.
//   delivery_status provides finer granularity once dispatched.

const STEPS = [
  {
    step:   1,
    label:  'Order Placed',
    sub:    'We received your order',
    Icon:   ClipboardList,
    color:  'teal',
  },
  {
    step:   2,
    label:  'Processing',
    sub:    'Confirmed & picking in warehouse',
    Icon:   Package,
    color:  'teal',
  },
  {
    step:   3,
    label:  'Dispatched',
    sub:    'Left our warehouse with a driver',
    Icon:   Truck,
    color:  'teal',
  },
  {
    step:   4,
    label:  'In Transit',
    sub:    'On the way to your location',
    Icon:   MapPin,
    color:  'teal',
  },
  {
    step:   5,
    label:  'Delivered',
    sub:    'Package received',
    Icon:   CheckCircle,
    color:  'green',
  },
] as const;

/**
 * Derive the current completed step from order/delivery status.
 * Returns 0 if cancelled / failed (error state).
 */
function getCurrentStep(orderStatus: string | null, deliveryStatus: string | null): number {
  const os = orderStatus?.toUpperCase();
  const ds = deliveryStatus?.toUpperCase();

  if (os === 'CANCELLED' || ds === 'FAILED' || ds === 'RETURNED') return -1; // error

  if (ds === 'DELIVERED' || os === 'DELIVERED') return 5;
  if (ds === 'OUT_FOR_DELIVERY')                 return 4;
  if (ds === 'IN_TRANSIT' || ds === 'ASSIGNED')  return 3;
  if (os === 'DISPATCHED')                        return 3;
  if (os === 'PROCESSING')                        return 2;
  if (os === 'CONFIRMED')                         return 2;
  if (os === 'PENDING')                           return 1;
  return 1; // default: placed
}

function getStatusLabel(orderStatus: string | null, deliveryStatus: string | null): { label: string; sub: string } {
  const os = orderStatus?.toUpperCase();
  const ds = deliveryStatus?.toUpperCase();
  if (ds === 'DELIVERED' || os === 'DELIVERED')  return { label: 'Delivered',         sub: 'Your order has been received.' };
  if (ds === 'OUT_FOR_DELIVERY')                  return { label: 'Out for delivery',   sub: 'Driver is at your location area.' };
  if (ds === 'IN_TRANSIT')                        return { label: 'In transit',          sub: 'Order is on the road.' };
  if (ds === 'ASSIGNED')                          return { label: 'Driver assigned',    sub: 'A driver is picking up your order.' };
  if (ds === 'AWAITING_DISPATCH' || os === 'DISPATCHED') return { label: 'Dispatched',  sub: 'Left our warehouse.' };
  if (os === 'PROCESSING')                        return { label: 'Processing',          sub: 'Warehouse is picking & packing.' };
  if (os === 'CONFIRMED')                         return { label: 'Order confirmed',    sub: 'Warehouse has been notified.' };
  if (os === 'CANCELLED')                         return { label: 'Order cancelled',    sub: 'This order has been cancelled.' };
  if (ds === 'FAILED')                            return { label: 'Delivery failed',    sub: 'Please contact support.' };
  if (ds === 'RETURNED')                          return { label: 'Returned',           sub: 'Order returned to warehouse.' };
  return { label: 'Order placed', sub: 'Your order has been received.' };
}

interface TrackResult {
  tracking_code:   string;
  delivery_status: string | null;
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

// ── Stepper component ─────────────────────────────────────────────────────────

function OrderStepper({ curStep, isError }: { curStep: number; isError: boolean }) {
  return (
    <div className="relative mt-6">
      {/* Connector line */}
      <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-line" />
      <div
        className="absolute left-5 top-5 w-0.5 bg-teal-500 transition-all duration-700"
        style={{ height: isError ? 0 : `${Math.max(0, ((curStep - 1) / 4) * 100)}%` }}
      />

      <div className="flex flex-col gap-0">
        {STEPS.map((s) => {
          const done    = !isError && curStep >= s.step;
          const current = !isError && curStep === s.step;
          const future  = isError || curStep < s.step;

          return (
            <div key={s.step} className="relative flex items-start gap-4 pb-6 last:pb-0">
              {/* Circle */}
              <div
                className={cn(
                  'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300',
                  done && !current
                    ? 'border-teal-500 bg-teal-500 text-white shadow-[0_0_0_4px_rgba(20,184,166,0.12)]'
                    : current
                    ? 'border-teal-500 bg-white text-teal-600 shadow-[0_0_0_4px_rgba(20,184,166,0.15)]'
                    : 'border-line bg-white text-ink-4',
                )}
              >
                {done && !current ? (
                  <CheckCircle size={18} />
                ) : (
                  <s.Icon size={18} />
                )}
              </div>

              {/* Label */}
              <div className={cn('pt-1.5 transition-opacity', future && 'opacity-40')}>
                <p className={cn(
                  'text-sm font-semibold leading-tight',
                  current ? 'text-teal-700' : done ? 'text-ink' : 'text-ink-3',
                )}>
                  {s.label}
                  {current && (
                    <span className="ml-2 inline-flex h-5 items-center rounded-full bg-teal-100 px-2 text-[10px] font-bold text-teal-700">
                      Current
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-ink-3">{s.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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
        setError(body.message ?? 'Code not found. Please check and try again.');
      } else {
        setResult(body.data);
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const curStep = result
    ? getCurrentStep(result.order_status, result.delivery_status)
    : 0;
  const isError = curStep === -1;
  const { label: statusLabel, sub: statusSub } = result
    ? getStatusLabel(result.order_status, result.delivery_status)
    : { label: '', sub: '' };

  return (
    <>
      <PageHead
        title="Track your order"
        subtitle="Enter your order number (e.g. ENV-2026-000001) or your delivery tracking code."
      />

      <div className="mx-auto max-w-xl">
        {/* ── Search form ── */}
        <form
          onSubmit={handleSubmit}
          className="flex gap-2 rounded-2xl border border-line bg-white p-4 shadow-sm"
        >
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Order number or tracking code…"
            className="flex-1 rounded-xl border border-line bg-bg-muted px-3.5 py-2.5 font-mono text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all',
              'bg-teal-600 hover:bg-teal-700 active:scale-95',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {loading
              ? <><RotateCw size={14} className="animate-spin" /> Searching…</>
              : <><Search size={14} /> Track</>}
          </button>
        </form>

        {/* ── Error ── */}
        {error && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={16} className="shrink-0 text-red-500" />
            {error}
          </div>
        )}

        {/* ── Result ── */}
        {result && (
          <div className="mt-6 space-y-4">

            {/* Status hero card */}
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
              {/* Coloured top strip */}
              <div className={cn('h-1.5', isError ? 'bg-red-400' : 'bg-teal-500')} />

              <div className="p-5">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <span className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                    isError ? 'bg-red-50 text-red-500' : 'bg-teal-50 text-teal-600',
                  )}>
                    {isError ? <AlertTriangle size={22} /> : <Truck size={22} />}
                  </span>
                  <div>
                    <p className={cn(
                      'text-lg font-bold leading-tight',
                      isError ? 'text-red-700' : 'text-ink',
                    )}>
                      {statusLabel}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-3">{statusSub}</p>
                    {result.order_number && (
                      <p className="mt-1 font-mono text-xs text-ink-4">
                        Order {result.order_number}
                        {result.tracking_code && result.tracking_code !== result.order_number
                          ? ` · ${result.tracking_code}`
                          : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stepper */}
                {!isError && <OrderStepper curStep={curStep} isError={false} />}
              </div>
            </div>

            {/* Info cards grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              {result.delivery_city && (
                <InfoCard icon={<MapPin size={16} />} label="Destination">
                  {result.delivery_city}, {result.delivery_state}
                </InfoCard>
              )}
              {result.order_placed_at && (
                <InfoCard icon={<Clock size={16} />} label="Order placed">
                  {fmt(result.order_placed_at)}
                </InfoCard>
              )}
              {result.dispatched_at && (
                <InfoCard icon={<Truck size={16} />} label="Dispatched">
                  {fmt(result.dispatched_at)}
                </InfoCard>
              )}
              {result.delivered_at && (
                <InfoCard icon={<CheckCircle size={16} className="text-green-600" />} label="Delivered">
                  <span className="text-green-700">{fmt(result.delivered_at)}</span>
                </InfoCard>
              )}
            </div>

            <p className="text-center text-xs text-ink-4">
              Tracking reference:{' '}
              <span className="font-mono">{result.tracking_code ?? result.order_number}</span>
            </p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!result && !error && !loading && (
          <div className="mt-12 flex flex-col items-center gap-3 text-center text-ink-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-line bg-bg-subtle">
              <Clock size={28} className="opacity-40" />
            </div>
            <div>
              <p className="font-medium text-ink-2">Track your order</p>
              <p className="mt-1 text-sm">
                Enter your <strong className="text-ink">order number</strong> from the confirmation email,
                or the <strong className="text-ink">tracking code</strong> from your dispatch email.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function InfoCard({
  icon,
  label,
  children,
}: {
  icon:     React.ReactNode;
  label:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-white px-4 py-3.5">
      <span className="mt-0.5 shrink-0 text-ink-3">{icon}</span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-ink">{children}</p>
      </div>
    </div>
  );
}
