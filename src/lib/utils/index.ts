import clsx, { type ClassValue } from 'clsx';
import { format, formatDistanceToNow, isAfter, differenceInDays } from 'date-fns';

/** Merge class names — clsx wrapper (no Tailwind merging needed; we use CSS Modules). */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Format Naira amount: 1234567 → "₦1,234,567". */
export function formatNaira(amount: number, opts?: { minimumFractionDigits?: number }): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: opts?.minimumFractionDigits ?? 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Compact number: 12500 → "12.5K", 1500000 → "1.5M". */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatDate(iso: string, pattern = 'd MMM yyyy'): string {
  return format(new Date(iso), pattern);
}

export function formatDateTime(iso: string): string {
  return format(new Date(iso), "d MMM yyyy 'at' h:mm a");
}

export function timeAgo(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function isExpiringSoon(iso: string, withinDays = 90): boolean {
  return differenceInDays(new Date(iso), new Date()) <= withinDays;
}

export function isExpired(iso: string): boolean {
  return !isAfter(new Date(iso), new Date());
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return keys.reduce((acc, k) => {
    if (k in obj) acc[k] = obj[k];
    return acc;
  }, {} as Pick<T, K>);
}

/** Stable sleep — useful for simulating server latency in dev. */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Generate an order number like EVP-2025-00148. */
export function makeOrderNumber(seq: number, year = new Date().getFullYear()): string {
  return `EVP-${year}-${String(seq).padStart(5, '0')}`;
}
