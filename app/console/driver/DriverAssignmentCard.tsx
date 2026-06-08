'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Primitives';
import { MapPin, Clock, CheckCircle, Truck, Box } from '@/components/icons';
import { acknowledgeAssignmentAction, updateDeliveryStatusAction } from '@/lib/actions';
import { DELIVERY_STATUS_LABEL, DELIVERY_STATUS_TONE } from '@/lib/constants';
import { formatDate, formatNaira } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';
import type { Delivery, Order, CustomerWithUser } from '@/types';
import type { ActionResult } from '@/lib/actions';
import { cn } from '@/lib/utils';

interface Props {
  delivery: Delivery;
  order: Order | null;
  customer: CustomerWithUser | null;
}

const initial: ActionResult = { ok: false, message: '' };

/**
 * Driver status progression (as client requested):
 *   awaiting_dispatch  →  [acknowledge]  →  assigned
 *   assigned           →  [start delivery]  →  in_transit
 *   in_transit         →  [mark delivered]  →  delivered
 */
const STATUS_TRANSITIONS: Partial<Record<string, { label: string; next: string; icon: typeof Truck }>> = {
  assigned:   { label: 'Start delivery',  next: 'in_transit', icon: Truck },
  in_transit: { label: 'Mark delivered',  next: 'delivered',  icon: Box },
};

export function DriverAssignmentCard({ delivery, order, customer }: Props) {
  const toast = useToast();
  const [localStatus, setLocalStatus] = useState(delivery.status);
  const [acknowledged, setAcknowledged] = useState(
    // Already acknowledged if status is past awaiting_dispatch
    delivery.status !== 'awaiting_dispatch' || !!delivery.acknowledged_at,
  );

  const tone = DELIVERY_STATUS_TONE[localStatus] as 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';
  const transition = STATUS_TRANSITIONS[localStatus];

  // ── Acknowledge action ───────────────────────────────────────────────────
  const [, ackAction, ackPending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await acknowledgeAssignmentAction(prev, fd);
    if (r.ok) {
      toast.show({ tone: 'success', title: 'Assignment acknowledged', description: 'Status updated to Assigned.' });
      setAcknowledged(true);
      // Transition status to 'assigned'
      setLocalStatus('assigned');
    } else {
      toast.show({ tone: 'error', title: 'Could not acknowledge', description: r.message });
    }
    return r;
  }, initial);

  // ── Status progression action ────────────────────────────────────────────
  const [, statusAction, statusPending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await updateDeliveryStatusAction(prev, fd);
    if (r.ok && r.data) {
      const next = (r.data as { status: string }).status as typeof localStatus;
      setLocalStatus(next as typeof delivery.status);
      toast.show({
        tone: 'success',
        title: 'Status updated',
        description: DELIVERY_STATUS_LABEL[next as keyof typeof DELIVERY_STATUS_LABEL],
      });
    } else if (!r.ok) {
      toast.show({ tone: 'error', title: 'Update failed', description: r.message });
    }
    return r;
  }, initial);

  const isDone = localStatus === 'delivered' || localStatus === 'failed' || localStatus === 'returned';

  return (
    <div className={cn(
      'overflow-hidden rounded-xl border bg-white transition-opacity',
      isDone ? 'border-line opacity-70' : 'border-line',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-line-subtle bg-bg-subtle px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs font-medium text-ink-3">{delivery.tracking_code}</span>
          {localStatus === 'awaiting_dispatch' && !acknowledged && (
            <span className="inline-flex h-5 items-center rounded-full bg-amber-100 px-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              New — needs acknowledgement
            </span>
          )}
        </div>
        <Badge tone={tone} noDot>
          {DELIVERY_STATUS_LABEL[localStatus]}
        </Badge>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          {/* Customer */}
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.1em] text-ink-4">Deliver to</div>
            <div className="mt-0.5 text-base font-semibold tracking-tight text-ink">
              {customer?.company_name ?? '—'}
            </div>
            {customer?.address && (
              <div className="mt-0.5 flex items-start gap-1.5 text-sm text-ink-2">
                <MapPin size={12} className="mt-0.5 shrink-0 text-ink-3" />
                {customer.address}
              </div>
            )}
          </div>

          {/* Order info */}
          {order && (
            <div className="flex flex-wrap gap-4 text-sm text-ink-2">
              <span>
                <span className="font-medium text-ink">{order.items.length}</span>{' '}
                item{order.items.length !== 1 ? 's' : ''}
              </span>
              <span className="num font-medium text-ink">{formatNaira(order.total_amount)}</span>
              <span className="text-ink-3">{order.order_number}</span>
            </div>
          )}

          {/* ETA */}
          {delivery.estimated_arrival && (
            <div className="flex items-center gap-1.5 text-sm text-ink-2">
              <Clock size={13} className="text-ink-3" />
              <span>
                ETA <span className="font-medium text-ink">{formatDate(delivery.estimated_arrival)}</span>
              </span>
            </div>
          )}

          {/* Status timeline */}
          <div className="mt-2 flex items-center gap-1.5">
            {(['awaiting_dispatch', 'assigned', 'in_transit', 'delivered'] as const).map((s, i, arr) => {
              const statuses: typeof delivery.status[] = ['awaiting_dispatch', 'assigned', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'];
              const currentIdx = statuses.indexOf(localStatus);
              const thisIdx = statuses.indexOf(s);
              const done = currentIdx > thisIdx;
              const active = s === localStatus;
              return (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={cn(
                    'h-2 w-2 rounded-full transition-colors',
                    active ? 'bg-brand-500 ring-2 ring-brand-200' : done ? 'bg-leaf-500' : 'bg-line-strong',
                  )} />
                  <span className={cn(
                    'text-[10px] font-medium',
                    active ? 'text-ink' : done ? 'text-leaf-600' : 'text-ink-4',
                  )}>
                    {DELIVERY_STATUS_LABEL[s]}
                  </span>
                  {i < arr.length - 1 && <span className={cn('mx-0.5 text-ink-5', done ? 'text-leaf-400' : '')}>›</span>}
                </div>
              );
            })}
          </div>

          {/* Event log */}
          {delivery.events.length > 0 && (
            <div className="mt-1 space-y-1">
              {[...delivery.events].reverse().slice(0, 3).map((ev, i) => (
                <div key={i} className={cn('flex items-start gap-2 text-xs', i === 0 ? 'text-ink' : 'text-ink-3')}>
                  <span className={cn('mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full', i === 0 ? 'bg-brand-500' : 'bg-ink-5')} />
                  <span>{ev.description}{ev.location ? ` — ${ev.location}` : ''}</span>
                  <span className="ml-auto shrink-0 text-ink-4">{formatDate(ev.occurred_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 sm:items-end sm:justify-start">
          {/* Step 1: Acknowledge (only when awaiting + not yet acknowledged) */}
          {localStatus === 'awaiting_dispatch' && !acknowledged && (
            <form action={ackAction}>
              <input type="hidden" name="delivery_id" value={delivery.id} />
              <Button type="submit" size="sm" loading={ackPending} leadingIcon={<CheckCircle size={14} />}>
                Acknowledge
              </Button>
            </form>
          )}

          {/* Steps 2+: Status progression (assigned → in_transit → delivered) */}
          {transition && (
            <form action={statusAction}>
              <input type="hidden" name="delivery_id" value={delivery.id} />
              <input type="hidden" name="status" value={transition.next} />
              <Button
                type="submit"
                size="sm"
                variant={localStatus === 'in_transit' ? 'primary' : 'secondary'}
                loading={statusPending}
                leadingIcon={<transition.icon size={14} />}
              >
                {transition.label}
              </Button>
            </form>
          )}

          {isDone && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-leaf-600">
              <CheckCircle size={12} />
              Completed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
