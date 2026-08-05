'use client';

import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Eye, EyeOff } from '@/components/icons';

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, required, htmlFor, children }: FieldProps) {
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      {label && (
        <label
          className="text-sm font-medium text-ink tracking-tight"
          htmlFor={htmlFor}
        >
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <span className="inline-flex items-center gap-1 text-xs text-danger">
          <AlertTriangle size={12} />
          {error}
        </span>
      ) : (
        hint && <span className="text-xs text-ink-3">{hint}</span>
      )}
    </div>
  );
}

const inputBase = cn(
  'w-full rounded-md border border-line bg-white px-3 text-sm text-ink',
  'placeholder:text-ink-4',
  'focus:border-brand-500 focus:shadow-glow focus:outline-none',
  'disabled:bg-bg-muted disabled:text-ink-3 disabled:cursor-not-allowed',
  'aria-[invalid=true]:border-danger',
  'transition-[border-color,box-shadow] duration-150',
);

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, type, ...rest },
  ref,
) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const realType = isPassword && show ? 'text' : type;

  return (
    <div className="relative">
      <input
        ref={ref}
        type={realType}
        aria-invalid={invalid}
        className={cn(inputBase, 'h-10', isPassword && 'pr-10', className)}
        {...rest}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink-3 hover:text-ink"
          aria-label={show ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(inputBase, 'min-h-22 py-2.5 leading-relaxed', className)}
        {...rest}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            inputBase,
            'h-10 pr-9 appearance-none bg-no-repeat bg-position-[right_0.75rem_center]',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute inset-y-0 right-3 my-auto h-4 w-4 text-ink-3"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  },
);

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  children?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, children, id, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'inline-flex cursor-pointer items-start gap-2.5 text-sm text-ink-2 leading-relaxed select-none',
        className,
      )}
    >
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={cn(
          'peer mt-0.5 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-line bg-white',
          'checked:border-brand-500 checked:bg-brand-500',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
          'transition-colors duration-150',
        )}
        {...rest}
      />
      <svg
        viewBox="0 0 16 16"
        className="pointer-events-none absolute mt-1 h-4 w-4 opacity-0 peer-checked:opacity-100"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        aria-hidden
      >
        <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children && <span>{children}</span>}
    </label>
  );
});
