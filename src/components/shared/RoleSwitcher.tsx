/**
 * RoleSwitcher — demo widget that flips the active session role.
 * Allows previewing Admin, Staff, Driver, and Customer experiences.
 * Remove this component in production (just delete its render in the layout).
 */

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setDemoRole } from '@/lib/actions/role';
import { User, Users, Shield, Truck, ChevronUp } from '@/components/icons';
import type { Role } from '@/types';
import { cn } from '@/lib/utils';

interface RoleSwitcherProps {
  current: Role;
  roles?: Role[];
}

const ALL_ROLES: Role[] = ['admin', 'sales_agent', 'driver', 'customer'];

const OPTIONS: { value: Role; label: string; sub: string; Icon: typeof User; href: string }[] = [
  { value: 'admin',       label: 'Admin',             sub: 'Full access — everything',            Icon: Shield, href: '/console/overview' },
  { value: 'sales_agent', label: 'Staff',             sub: 'Scoped by permission preset',          Icon: Users,  href: '/console/overview' },
  { value: 'driver',      label: 'Driver',            sub: 'My assignments & history',             Icon: Truck,  href: '/console/driver'   },
  { value: 'customer',    label: 'Customer (Pharmacy)', sub: 'Browse catalog, place orders',       Icon: User,   href: '/portal/catalog'   },
];

export function RoleSwitcher({ current, roles = ALL_ROLES }: RoleSwitcherProps) {
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

  const select = (opt: (typeof OPTIONS)[number]) => {
    startTransition(async () => {
      await setDemoRole(opt.value);
      setOpen(false);
      router.push(opt.href);
      router.refresh();
    });
  };

  const currentOption = options.find((o) => o.value === current) ?? options[0]!;

  return (
    <div className="fixed bottom-4 right-4 z-50" ref={wrapRef}>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 mb-2 w-76 origin-bottom-right rounded-xl border border-line bg-white p-2 shadow-xl animate-fade-in-up"
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            Demo · view as
          </div>
          {options.map((opt) => {
            const { value, label, sub, Icon } = opt;
            const active = current === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                disabled={pending}
                onClick={() => select(opt)}
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
                {active && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                )}
              </button>
            );
          })}
          <p className="mt-2 border-t border-line-subtle px-3 py-2 text-xs leading-relaxed text-ink-3">
            Demo mode — switch between all roles. Remove in production.
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
