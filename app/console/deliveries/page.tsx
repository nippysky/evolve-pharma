'use client';

import { useState } from 'react';
import { Search, Truck } from '@/components/icons';
import { EmptyState } from '@/components/ui/Primitives';
import { PageHead } from '@/components/shared/PageHead';
import { cn } from '@/lib/utils';

const TABS = [
  { value: 'all' as const,               label: 'All' },
  { value: 'awaiting_dispatch' as const,  label: 'Awaiting dispatch' },
  { value: 'in_transit' as const,         label: 'In transit' },
  { value: 'out_for_delivery' as const,   label: 'Out for delivery' },
  { value: 'delivered' as const,          label: 'Delivered' },
];

export default function ConsoleDeliveriesPage() {
  const [tab, setTab]     = useState<(typeof TABS)[number]['value']>('all');
  const [query, setQuery] = useState('');

  return (
    <>
      <PageHead
        title="Deliveries"
        subtitle="Active and recent shipments. Assign drivers to unassigned deliveries."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="inline-flex flex-wrap rounded-md bg-bg-muted p-0.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                tab === t.value ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
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
            placeholder="Search by tracking, customer, driver"
            aria-label="Search"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      <EmptyState
        icon={<Truck size={24} />}
        title="No deliveries yet"
        description="Shipments will appear here once orders are dispatched."
      />
    </>
  );
}
