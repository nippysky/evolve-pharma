'use client';

/**
 * Assign Driver Popover — appears in the driver cell for unassigned deliveries.
 * Admin / operations_lead clicks the "+ Assign" button, picks a driver, submits.
 */

import { useActionState, useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { assignDriverAction } from '@/lib/actions';
import type { Driver } from '@/types';
import type { ActionResult } from '@/lib/actions';
import { cn } from '@/lib/utils';

const initial: ActionResult = { ok: false, message: '' };

interface Props {
  deliveryId: number;
  drivers: Driver[];
}

export function AssignDriverPopover({ deliveryId, drivers }: Props) {
  const [open, setOpen]         = useState(false);
  const [selected, setSelected] = useState<Driver | null>(null);
  const [assigned, setAssigned] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const toast   = useToast();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const availableDrivers = drivers.filter(
    (d) => d.driver_status === 'available' && d.user.status === 'active',
  );

  const [, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await assignDriverAction(prev, fd);
    if (r.ok) {
      toast.show({ tone: 'success', title: 'Driver assigned', description: `${selected?.user.fname} ${selected?.user.lname} is on it.` });
      setAssigned(true);
      setOpen(false);
    } else {
      toast.show({ tone: 'error', title: r.message || 'Failed to assign driver' });
    }
    return r;
  }, initial);

  if (assigned && selected) {
    return (
      <span className="text-sm font-medium text-ink">
        {selected.user.fname} {selected.user.lname}
      </span>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:border-amber-400 hover:bg-amber-100 transition-colors"
      >
        <Plus size={11} />
        Assign
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-line bg-white shadow-xl animate-fade-in-up">
          <div className="border-b border-line-subtle px-4 py-3">
            <p className="text-xs font-semibold text-ink">Assign a driver</p>
            <p className="text-xs text-ink-3">Available drivers only.</p>
          </div>

          {availableDrivers.length === 0 ? (
            <p className="px-4 py-4 text-xs text-ink-3">No available drivers right now.</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto p-1">
              {availableDrivers.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(d)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                      selected?.id === d.id ? 'bg-brand-50' : 'hover:bg-bg-subtle',
                    )}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                      {d.user.fname[0]}{d.user.lname[0]}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-ink">{d.user.fname} {d.user.lname}</div>
                      <div className="text-xs text-ink-3">{d.vehicle_type} · {d.vehicle_plate} · {d.region}</div>
                    </div>
                    {selected?.id === d.id && (
                      <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selected && (
            <div className="border-t border-line-subtle p-3">
              <form action={action}>
                <input type="hidden" name="delivery_id" value={deliveryId} />
                <input type="hidden" name="driver_id"   value={selected.id} />
                <Button type="submit" size="sm" fullWidth loading={pending}>
                  Confirm assignment
                </Button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
