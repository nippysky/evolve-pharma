import Link from 'next/link';
import { Bell, Truck, CreditCard, Box, AlertTriangle, Sparkle } from '@/components/icons';
import { EmptyState } from '@/components/ui/Primitives';
import { PageHead } from '@/components/shared/PageHead';
import { NOTIFICATIONS } from '@/lib/data/operational';
import { timeAgo } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { NotificationType } from '@/types';

const ICON_BY_TYPE: Record<NotificationType, { Icon: typeof Bell; cls: string }> = {
  order: { Icon: Box, cls: 'bg-brand-50 text-brand-700' },
  delivery: { Icon: Truck, cls: 'bg-brand-50 text-brand-700' },
  payment: { Icon: CreditCard, cls: 'bg-leaf-100 text-leaf-700' },
  inventory: { Icon: AlertTriangle, cls: 'bg-warning-soft text-amber-700' },
  system: { Icon: Bell, cls: 'bg-bg-muted text-ink-2' },
  promo: { Icon: Sparkle, cls: 'bg-leaf-100 text-leaf-700' },
};

export default function ConsoleNotificationsPage() {
  const items = [...NOTIFICATIONS].sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );

  return (
    <>
      <PageHead title="Notifications" subtitle="System-wide alerts across your team." />

      {items.length === 0 ? (
        <EmptyState icon={<Bell size={24} />} title="No notifications" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          {items.map((n) => {
            const { Icon, cls } = ICON_BY_TYPE[n.type];
            const inner = (
              <>
                <span className={cn('grid h-9 w-9 place-items-center rounded-md', cls)}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0">
                  <div className={cn('text-sm tracking-tight text-ink', n.is_read ? 'font-medium' : 'font-semibold')}>
                    {n.title}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{n.message}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-ink-3">{timeAgo(n.created_at)}</span>
              </>
            );
            const cls2 = cn(
              'relative grid grid-cols-[36px_1fr_auto] gap-3.5 border-b border-line-subtle p-5 last:border-b-0',
              !n.is_read && 'pl-7',
            );
            const dot = !n.is_read ? (
              <span className="absolute left-2.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand-500" />
            ) : null;

            return n.link ? (
              <Link key={n.id} href={n.link} className={cn(cls2, 'transition-colors hover:bg-bg-subtle')}>
                {dot}
                {inner}
              </Link>
            ) : (
              <div key={n.id} className={cls2}>
                {dot}
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
