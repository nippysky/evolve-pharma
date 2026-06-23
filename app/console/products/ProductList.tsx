/**
 * Products list (client). Search + category + lifecycle-status filtering.
 * No stock data here — that's the Inventory page.
 */

'use client';

import { useState } from 'react';
import { Search, Pill } from '@/components/icons';
import { EmptyState } from '@/components/ui/Primitives';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { ProductStatus } from '@/types';

const ALL = 'All';

const STATUS_TABS: { value: 'all' | ProductStatus; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'active',       label: 'Active' },
  { value: 'draft',        label: 'Draft' },
  { value: 'discontinued', label: 'Discontinued' },
];

export function ProductsList() {
  const [query, setQuery]       = useState('');
  const [category, setCategory] = useState<string>(ALL);
  const [status, setStatus]     = useState<'all' | ProductStatus>('all');

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-sm flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, SKU, manufacturer"
            aria-label="Search"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="inline-flex rounded-md bg-bg-muted p-0.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setStatus(t.value)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                status === t.value ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategory(ALL)}
          className={cn(
            'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            category === ALL ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-line-strong',
          )}
        >
          All
        </button>
        {PRODUCT_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              category === c ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-line-strong',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <EmptyState
        icon={<Pill size={24} />}
        title="No products yet"
        description="Add your first product or import a catalog to get started."
      />
    </>
  );
}