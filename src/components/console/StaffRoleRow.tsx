'use client';

/**
 * StaffRoleRow — Inline permission preset selector for the staff table.
 *
 * Admin clicks the dropdown → picks a preset → fires updateStaffPermissionAction.
 * The badge updates optimistically; a toast confirms the change.
 *
 * Permissions implied by each preset are shown as a tooltip-like pill list
 * beneath the dropdown so admins understand the impact without guessing.
 */

import { useState, useTransition } from 'react';
import { ChevronDown, CheckCircle } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { updateStaffPermissionAction } from '@/lib/actions';
import {
  STAFF_PRESET_PERMISSIONS,
  STAFF_PRESET_LABELS,
  type StaffPermissionPreset,
  type StaffPermissionKey,
} from '@/types';
import { cn } from '@/lib/utils';

const PERMISSION_LABELS: Record<StaffPermissionKey, string> = {
  onboard_customers: 'Onboard customers',
  manage_products:   'Manage products',
  manage_inventory:  'Manage inventory',
  assign_drivers:    'Assign drivers',
  view_reports:      'View reports',
};

const PRESETS = Object.keys(STAFF_PRESET_LABELS) as StaffPermissionPreset[];

const PRESET_COLOR: Record<StaffPermissionPreset, string> = {
  sales_rep:       'bg-blue-50 text-blue-700 border-blue-200',
  product_manager: 'bg-purple-50 text-purple-700 border-purple-200',
  operations_lead: 'bg-amber-50 text-amber-700 border-amber-200',
  senior_staff:    'bg-brand-50 text-brand-700 border-brand-200',
};

interface Props {
  staffId: number;
  currentPreset: StaffPermissionPreset;
}

export function StaffRoleRow({ staffId, currentPreset }: Props) {
  const [preset, setPreset]   = useState<StaffPermissionPreset>(currentPreset);
  const [open, setOpen]       = useState(false);
  const [pending, start]      = useTransition();
  const toast                 = useToast();

  const changePreset = (next: StaffPermissionPreset) => {
    if (next === preset) { setOpen(false); return; }
    start(async () => {
      const fd = new FormData();
      fd.append('staff_id', String(staffId));
      fd.append('preset', next);
      const r = await updateStaffPermissionAction(undefined, fd);
      if (r.ok) {
        setPreset(next);
        toast.show({ tone: 'success', title: 'Role updated', description: `${STAFF_PRESET_LABELS[next]} applied.` });
      } else {
        toast.show({ tone: 'error', title: 'Failed to update role' });
      }
      setOpen(false);
    });
  };

  const perms = STAFF_PRESET_PERMISSIONS[preset];

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
          PRESET_COLOR[preset],
          'hover:opacity-80',
        )}
      >
        {pending ? '…' : STAFF_PRESET_LABELS[preset]}
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-line bg-white p-1.5 shadow-xl animate-fade-in-up">
          {PRESETS.map((p) => {
            const active = p === preset;
            return (
              <button
                key={p}
                type="button"
                onClick={() => changePreset(p)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                  active ? 'bg-brand-50 text-brand-700' : 'text-ink hover:bg-bg-subtle',
                )}
              >
                <span className="flex-1 font-medium">{STAFF_PRESET_LABELS[p]}</span>
                {active && <CheckCircle size={13} className="text-brand-500" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Permission pills */}
      <div className="mt-1.5 flex flex-wrap gap-1">
        {perms.map((p) => (
          <span key={p} className="rounded bg-bg-muted px-1.5 py-0.5 text-[10px] text-ink-3">
            {PERMISSION_LABELS[p]}
          </span>
        ))}
      </div>
    </div>
  );
}
