'use client';
/**
 * ComboboxField — searchable input with a dropdown suggestion list.
 *
 * - Shows all options on focus (or filters as user types)
 * - "Create new" hint when the typed value doesn't match any option
 * - Keyboard: ArrowUp/Down to navigate, Enter/Tab to select, Escape to close
 */
import { useId, useRef, useState, useEffect, useCallback } from 'react';
import { cn }  from '@/lib/utils';
import { Search, Check, Plus } from '@/components/icons';

export interface ComboboxOption {
  id:    number;
  name:  string;
}

interface ComboboxFieldProps {
  /** All available options */
  options:       ComboboxOption[];
  /** Controlled value (the display name / free-text) */
  value:         string;
  onChange:      (value: string) => void;
  /** Called when the user selects a known option from the list */
  onSelect?:     (option: ComboboxOption) => void;
  label?:        string;
  placeholder?:  string;
  hint?:         string;
  error?:        string;
  required?:     boolean;
  disabled?:     boolean;
  loading?:      boolean;
  /** If true, show a "will be created" hint for unknown values */
  allowCreate?:  boolean;
  /** Label shown on the "create new" hint row, defaults to "Create" */
  createLabel?:  string;
  className?:    string;
}

export function ComboboxField({
  options,
  value,
  onChange,
  onSelect,
  label,
  placeholder,
  hint,
  error,
  required,
  disabled,
  loading,
  allowCreate = true,
  createLabel = 'Create',
  className,
}: ComboboxFieldProps) {
  const id              = useId();
  const containerRef    = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLInputElement>(null);
  const listRef         = useRef<HTMLUListElement>(null);

  const [open,    setOpen]    = useState(false);
  const [focused, setFocused] = useState(-1);   // highlighted list index

  // ── Filtering ──────────────────────────────────────────────────────────────

  const q = value.trim().toLowerCase();

  const filtered = q
    ? options.filter(o => o.name.toLowerCase().includes(q))
    : options;                                  // show all on blank / focus

  const exactMatch = options.some(o => o.name.toLowerCase() === q);
  const showCreate = allowCreate && value.trim().length > 0 && !exactMatch;

  // Combine filtered + optional create row; create row index = filtered.length
  const totalRows = filtered.length + (showCreate ? 1 : 0);

  // ── Scroll highlighted row into view ─────────────────────────────────────

  useEffect(() => {
    if (focused < 0 || !listRef.current) return;
    const el = listRef.current.querySelectorAll('[role="option"]')[focused] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [focused]);

  // ── Close on outside click ────────────────────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(-1);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Keyboard navigation ───────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setOpen(true);
        setFocused(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'Escape') { setOpen(false); setFocused(-1); return; }
    if (e.key === 'ArrowDown') {
      setFocused(f => Math.min(f + 1, totalRows - 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setFocused(f => Math.max(f - 1, 0));
      e.preventDefault();
    } else if ((e.key === 'Enter' || e.key === 'Tab') && focused >= 0) {
      if (focused < filtered.length) {
        selectOption(filtered[focused]!);
      }
      // If focused is on the "create" row, just close — the typed value is kept
      if (e.key === 'Enter') e.preventDefault();
      setOpen(false);
      setFocused(-1);
    }
  }

  // ── Selecting ────────────────────────────────────────────────────────────

  const selectOption = useCallback((opt: ComboboxOption) => {
    onChange(opt.name);
    onSelect?.(opt);
    setOpen(false);
    setFocused(-1);
    inputRef.current?.focus();
  }, [onChange, onSelect]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={cn('mb-4 flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink tracking-tight">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}

      <div ref={containerRef} className="relative">
        {/* Search icon */}
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3">
          <Search size={13} />
        </span>

        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          autoComplete="off"
          value={value}
          disabled={disabled || loading}
          placeholder={loading ? 'Loading…' : (placeholder ?? 'Search or type to create…')}
          onChange={e => {
            onChange(e.target.value);
            setOpen(true);
            setFocused(-1);
          }}
          onFocus={() => { setOpen(true); setFocused(-1); }}
          onKeyDown={handleKeyDown}
          className={cn(
            'h-9 w-full rounded-md border pl-8 pr-3 text-sm transition-colors placeholder:text-ink-4',
            'focus:outline-none focus:ring-1',
            error
              ? 'border-red-400 focus:border-red-400 focus:ring-red-300'
              : 'border-line focus:border-brand-500 focus:ring-brand-200',
            (disabled || loading) && 'cursor-not-allowed bg-bg-subtle text-ink-3',
          )}
        />

        {/* Dropdown */}
        {open && totalRows > 0 && (
          <ul
            ref={listRef}
            id={`${id}-listbox`}
            role="listbox"
            aria-label={label}
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-xl"
          >
            {filtered.map((opt, i) => {
              const isHighlighted = i === focused;
              const isSelected    = opt.name.toLowerCase() === q;
              return (
                <li
                  key={opt.id}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={() => selectOption(opt)}
                  onMouseEnter={() => setFocused(i)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors',
                    isHighlighted ? 'bg-brand-50 text-brand-700' : 'text-ink hover:bg-bg-subtle',
                  )}
                >
                  <span className="flex-1 truncate">{opt.name}</span>
                  {isSelected && <Check size={12} className="shrink-0 text-brand-500" />}
                </li>
              );
            })}

            {showCreate && (
              <li
                role="option"
                aria-selected={false}
                onMouseDown={() => { setOpen(false); setFocused(-1); }}
                onMouseEnter={() => setFocused(filtered.length)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 border-t border-line px-3 py-2 text-sm transition-colors',
                  focused === filtered.length
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-3 hover:bg-bg-subtle',
                )}
              >
                <Plus size={12} className="shrink-0" />
                <span>
                  {createLabel} <strong className="text-ink">&ldquo;{value.trim()}&rdquo;</strong>
                </span>
              </li>
            )}
          </ul>
        )}
      </div>

      {hint && !error && (
        <p className="text-xs text-ink-4">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
