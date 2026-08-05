import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn, initials } from '@/lib/utils';

export function Card({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-line bg-white',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex items-center justify-between border-b border-line-subtle px-5 py-4', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <h3 className={cn('text-base font-medium tracking-tight text-ink', className)}>{children}</h3>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('border-t border-line-subtle bg-bg-subtle px-5 py-3', className)}>{children}</div>
  );
}

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand' | 'accent';

const BADGE: Record<BadgeTone, { wrap: string; dot: string }> = {
  neutral: { wrap: 'bg-bg-muted text-ink-2', dot: 'bg-ink-3' },
  info: { wrap: 'bg-info-soft text-cyan-800', dot: 'bg-info' },
  success: { wrap: 'bg-success-soft text-green-800', dot: 'bg-success' },
  warning: { wrap: 'bg-warning-soft text-amber-800', dot: 'bg-warning' },
  danger: { wrap: 'bg-danger-soft text-red-800', dot: 'bg-danger' },
  brand: { wrap: 'bg-brand-50 text-brand-800', dot: 'bg-brand-500' },
  accent: { wrap: 'bg-leaf-100 text-leaf-800', dot: 'bg-leaf-500' },
};

export function Badge({
  tone = 'neutral',
  noDot,
  children,
  className,
}: {
  tone?: BadgeTone;
  noDot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const t = BADGE[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium tracking-tight',
        t.wrap,
        className,
      )}
    >
      {!noDot && <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} aria-hidden />}
      {children}
    </span>
  );
}

export function Skeleton({
  className,
  height,
  width,
}: {
  className?: string;
  height?: number | string;
  width?: number | string;
}) {
  const style: CSSProperties = {};
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  return <div className={cn('shimmer rounded-md', className)} style={style} aria-hidden />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return <Skeleton className="rounded-full" height={size} width={size} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-0 border-t border-line-subtle', className)} />;
}

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        {label}
      </span>
      <span className="num font-display text-3xl tracking-tight text-ink leading-none">{value}</span>
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </div>
  );
}

export function Avatar({
  name,
  size = 36,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-grid place-items-center rounded-full bg-linear-to-br from-brand-500 to-leaf-500 font-semibold text-white shrink-0',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

interface EmptyProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center">
      {icon && (
        <span className="grid h-12 w-12 place-items-center rounded-full bg-bg-muted text-ink-3">
          {icon}
        </span>
      )}
      <span className="display-serif text-xl text-ink">{title}</span>
      {description && <span className="max-w-sm text-sm text-ink-2">{description}</span>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
