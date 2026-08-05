'use client';

import { forwardRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from 'react';
import Link from 'next/link';
import { Spinner } from '@/components/icons';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  iconOnly?: boolean;
  className?: string;
  children?: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-ink-3',
  secondary:
    'bg-white text-ink border border-line hover:border-line-strong hover:bg-bg-subtle disabled:bg-bg-muted',
  ghost: 'bg-transparent text-ink-2 hover:bg-bg-muted hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-90 active:brightness-95',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-md',
  lg: 'h-12 px-5 text-sm gap-2 rounded-md',
};

const ICON_ONLY_SIZE: Record<Size, string> = {
  sm: 'h-8 w-8 p-0',
  md: 'h-10 w-10 p-0',
  lg: 'h-12 w-12 p-0',
};

function classes({
  variant = 'primary',
  size = 'md',
  fullWidth,
  iconOnly,
}: Pick<CommonProps, 'variant' | 'size' | 'fullWidth' | 'iconOnly'>) {
  return cn(
    'inline-flex items-center justify-center font-medium tracking-tight whitespace-nowrap select-none',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:cursor-not-allowed disabled:opacity-60',
    'active:scale-[0.98]',
    iconOnly ? ICON_ONLY_SIZE[size] : SIZE[size],
    VARIANT[variant],
    fullWidth && 'w-full',
  );
}

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    CommonProps {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant,
    size,
    fullWidth,
    loading,
    leadingIcon,
    trailingIcon,
    iconOnly,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(classes({ variant, size, fullWidth, iconOnly }), className)}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 18 : 14} className="animate-spin" />
      ) : (
        leadingIcon
      )}
      {!iconOnly && children}
      {!loading && trailingIcon}
    </button>
  );
});

export interface ButtonLinkProps extends Omit<ComponentProps<typeof Link>, 'children'>, CommonProps {
  external?: boolean;
}

export function ButtonLink({
  variant,
  size,
  fullWidth,
  leadingIcon,
  trailingIcon,
  iconOnly,
  className,
  children,
  external,
  ...rest
}: ButtonLinkProps) {
  const cls = cn(classes({ variant, size, fullWidth, iconOnly }), className);
  if (external) {
    return (
      <a
        href={typeof rest.href === 'string' ? rest.href : '#'}
        target="_blank"
        rel="noreferrer"
        className={cls}
      >
        {leadingIcon}
        {!iconOnly && children}
        {trailingIcon}
      </a>
    );
  }
  return (
    <Link className={cls} {...rest}>
      {leadingIcon}
      {!iconOnly && children}
      {trailingIcon}
    </Link>
  );
}