/**
 * RoleSwitcher — demo widget that flips the active session role.
 *
 * Now scoped to STAFF roles only (Admin ⇄ Sales Agent). Customers don't
 * get a switcher — they're just customers — so this is rendered solely in
 * the console shell. To re-enter a customer demo session, sign in at
 * /sign-in; to re-enter staff, sign in at /staff/sign-in.
 *
 * In production, this is removed (just delete its render in the layout).
 */

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setDemoRole } from '@/lib/actions/role';
import { User, Users, Shield, ChevronUp } from '@/components/icons';
import type { Role } from '@/types';
import { cn } from '@/lib/utils';

interface RoleSwitcherProps {
  current: Role;
  /**
   * Which roles this switcher may flip between. Defaults to staff roles —
   * customer is intentionally excluded.
   */
  roles?: Role[];
}

const STAFF_ROLES: Role[] = ['admin', 'sales_agent'];

const OPTIONS: { value: Role; label: string; sub: string; Icon: typeof User }[] = [
  { value: 'admin', label: 'Admin', sub: 'Full access — products, agents, reports', Icon: Shield },
  { value: 'sales_agent', label: 'Sales Agent', sub: 'Onboard customers, track orders', Icon: Users },
  { value: 'customer', label: 'Customer (Pharmacy)', sub: 'Browse catalog, place orders', Icon: User },
];

export function RoleSwitcher({ current, roles = STAFF_ROLES }: RoleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const options = OPTIONS.filter((o) => roles.includes(o.value));

  const select = (role: Role) => {
    startTransition(async () => {
      await setDemoRole(role);
      setOpen(false);
      router.push(role === 'customer' ? '/portal/catalog' : '/console/overview');
      router.refresh();
    });
  };

  const currentOption = options.find((o) => o.value === current) ?? options[0]!;

  return (
    <div className="fixed bottom-4 right-4 z-50" ref={wrapRef}>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 mb-2 w-72 origin-bottom-right rounded-xl border border-line bg-white p-2 shadow-xl animate-fade-in-up"
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            Demo · view as
          </div>
          {options.map(({ value, label, sub, Icon }) => {
            const active = current === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                disabled={pending}
                onClick={() => select(value)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                  active ? 'bg-brand-50 text-ink' : 'text-ink hover:bg-bg-subtle',
                )}
              >
                <span
                  className={cn(
                    'grid h-7 w-7 shrink-0 place-items-center rounded-md',
                    active ? 'bg-brand-100 text-brand-700' : 'bg-bg-muted text-ink-3',
                  )}
                >
                  <Icon size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{label}</span>
                  <span className="block truncate text-xs text-ink-3">{sub}</span>
                </span>
              </button>
            );
          })}
          <p className="mt-2 border-t border-line-subtle px-3 py-2 text-xs leading-relaxed text-ink-3">
            Staff demo switcher — flip between Admin and Sales Agent. Real auth uses signed sessions.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-2 pl-2.5 pr-3 text-xs font-medium text-ink-2 shadow-md transition-colors hover:border-line-strong hover:text-ink"
      >
        <span className="relative inline-block h-2 w-2 rounded-full bg-leaf-500 ring-2 ring-leaf-100" aria-hidden />
        <span>Demo · {currentOption.label}</span>
        <ChevronUp size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
    </div>
  );
}