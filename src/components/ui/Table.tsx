/**
 * Table primitives — minimal building blocks for data tables.
 * Wraps in a scroll container; rows can be made interactive via onClick.
 */
"use client";

import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-line bg-white', className)}>
      {children}
    </div>
  );
}

export function Table({
  children,
  className,
  compact = false,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <table
      className={cn(
        'w-full border-collapse text-sm',
        compact && '[&_td]:py-2 [&_th]:py-2',
        className,
      )}
    >
      {children}
    </table>
  );
}

export const Tr = ({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) => {
  const interactive = !!onClick;
  return (
    <tr
      onClick={onClick}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={interactive ? 0 : undefined}
      className={cn(
        'border-b border-line-subtle last:border-b-0',
        interactive && 'cursor-pointer hover:bg-bg-subtle focus-visible:bg-bg-subtle',
        className,
      )}
    >
      {children}
    </tr>
  );
};

export const Thead = ({ children }: { children: ReactNode }) => (
  <thead className="bg-bg-subtle">{children}</thead>
);

export const Tbody = ({ children }: { children: ReactNode }) => (
  <tbody>{children}</tbody>
);

export const Th = ({
  children,
  align,
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & {
  align?: 'left' | 'right' | 'center';
}) => (
  <th
    className={cn(
      'whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-ink-3',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      className,
    )}
    {...rest}
  >
    {children}
  </th>
);

export const Td = ({
  children,
  muted,
  num,
  right,
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & {
  muted?: boolean;
  num?: boolean;
  right?: boolean;
}) => (
  <td
    className={cn(
      'px-4 py-3.5 text-sm align-middle',
      muted ? 'text-ink-3' : 'text-ink',
      num && 'num font-medium tabular-nums',
      right && 'text-right',
      className,
    )}
    {...rest}
  >
    {children}
  </td>
);

export const TableEmpty = ({ children, colSpan }: { children: ReactNode; colSpan: number }) => (
  <tr>
    <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-ink-3">
      {children}
    </td>
  </tr>
);
