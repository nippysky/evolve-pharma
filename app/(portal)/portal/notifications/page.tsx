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

export default function NotificationsPage() {
  const items = NOTIFICATIONS.filter((n) => n.user_id === 1001).sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );

  return (
    <>
      <PageHead
        title="Notifications"
        subtitle="Real-time updates on orders, payments, and shipments."
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Bell size={24} />}
          title="No notifications yet"
          description="When something happens with your account, you'll see it here."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          {items.map((n) => {
            const { Icon, cls } = ICON_BY_TYPE[n.type];
            const Wrapper = (props: { children: React.ReactNode }) =>
              n.link ? (
                <Link
                  href={n.link}
                  className={cn(
                    'relative grid grid-cols-[36px_1fr_auto] gap-3.5 border-b border-line-subtle p-5 transition-colors last:border-b-0 hover:bg-bg-subtle',
                    !n.is_read && 'pl-7',
                  )}
                >
                  {!n.is_read && (
                    <span className="absolute left-2.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand-500" />
                  )}
                  {props.children}
                </Link>
              ) : (
                <div
                  className={cn(
                    'relative grid grid-cols-[36px_1fr_auto] gap-3.5 border-b border-line-subtle p-5 last:border-b-0',
                    !n.is_read && 'pl-7',
                  )}
                >
                  {!n.is_read && (
                    <span className="absolute left-2.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand-500" />
                  )}
                  {props.children}
                </div>
              );
            return (
              <Wrapper key={n.id}>
                <span className={cn('grid h-9 w-9 place-items-center rounded-md', cls)}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0">
                  <div
                    className={cn(
                      'text-sm tracking-tight text-ink',
                      n.is_read ? 'font-medium' : 'font-semibold',
                    )}
                  >
                    {n.title}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{n.message}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-ink-3">{timeAgo(n.created_at)}</span>
              </Wrapper>
            );
          })}
        </div>
      )}
    </>
  );
}
