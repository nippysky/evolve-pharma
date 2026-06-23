'use client';

import { useState } from 'react';
import { Search, Box, Download } from '@/components/icons';
import { EmptyState } from '@/components/ui/Primitives';
import { Button } from '@/components/ui/Button';
import { PageHead } from '@/components/shared/PageHead';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = [
  { value: 'all',        label: 'All' },
  { value: 'pending',    label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'dispatched', label: 'Dispatch' },
  { value: 'delivered',  label: 'Delivered' },
  { value: 'cancelled',  label: 'Cancelled' },
] as const;

export default function ConsoleOrdersPage() {
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]['value']>('all');
  const [query, setQuery] = useState('');

  return (
    <>
      <PageHead
        title="Orders"
        subtitle="Every order across all customers and statuses."
        actions={
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Download size={14} />}
            disabled
          >
            Export CSV
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="inline-flex flex-wrap rounded-md bg-bg-muted p-0.5">
          {STATUS_FILTERS.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                filter === t.value ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by order # or customer"
            aria-label="Search orders"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      <EmptyState
        icon={<Box size={24} />}
        title="No orders yet"
        description="Customer orders will appear here once they start placing them."
      />
    </>
  );
}
