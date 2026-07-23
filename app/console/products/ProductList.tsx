/**
 * Products list (client). Search + category + lifecycle-status filtering.
 * Synced to DUMMY_PRODUCTS — the same catalog the customer portal sees.
 */

'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search } from '@/components/icons';
import { Badge } from '@/components/ui/Primitives';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { DUMMY_PRODUCTS } from '@/lib/data/dummy-products';
import { DUMMY_INVENTORY } from '@/lib/data/dummy-console';
import { cn, formatNaira } from '@/lib/utils';
import type { ProductStatus } from '@/types';

const ALL = 'All';

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';

const STATUS_TABS: { value: 'all' | ProductStatus; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'active',       label: 'Active' },
  { value: 'draft',        label: 'Draft' },
  { value: 'discontinued', label: 'Discontinued' },
];

function statusBadge(s: ProductStatus): { label: string; tone: BadgeTone } {
  if (s === 'active')       return { label: 'Active',        tone: 'success' };
  if (s === 'draft')        return { label: 'Draft',         tone: 'neutral' };
  if (s === 'discontinued') return { label: 'Discontinued',  tone: 'danger' };
  return { label: s, tone: 'neutral' };
}

// Build a quick lookup: productId → inventory snapshot
const INV_LOOKUP = Object.fromEntries(
  DUMMY_INVENTORY.map((s) => [s.product.id, s])
);

export function ProductsList() {
  const [query, setQuery]       = useState('');
  const [category, setCategory] = useState<string>(ALL);
  const [status, setStatus]     = useState<'all' | ProductStatus>('all');

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return DUMMY_PRODUCTS.filter((p) => {
      const matchQuery    = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.manufacturer.toLowerCase().includes(q) || p.generic_name.toLowerCase().includes(q);
      const matchCategory = category === ALL || p.category === category;
      const matchStatus   = status === 'all' || p.status === status;
      return matchQuery && matchCategory && matchStatus;
    });
  }, [query, category, status]);

  return (
    <>
      {/* Search + status tabs */}
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

      {/* Category pills */}
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

      {/* Table */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center">
          <span className="display-serif text-xl text-ink">No products found</span>
          <span className="text-sm text-ink-2">Try adjusting your search or filter.</span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-subtle bg-bg-subtle text-left">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Product</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">SKU</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Category</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Price</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Stock</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Form</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Status</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {visible.map((p) => {
                  const inv = INV_LOOKUP[p.id];
                  const b   = statusBadge(p.status);
                  return (
                    <tr key={p.id} className="group hover:bg-bg-subtle/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <Image
                              src={p.image_url}
                              alt={p.name}
                              width={36}
                              height={36}
                              className="h-9 w-9 shrink-0 rounded-md border border-line object-contain"
                            />
                          ) : (
                            <span className="h-9 w-9 shrink-0 rounded-md border border-line bg-bg-muted" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{p.name}</p>
                            <p className="truncate text-xs text-ink-3">{p.generic_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-ink-2">{p.sku}</td>
                      <td className="px-5 py-3.5 text-ink-2">{p.category}</td>
                      <td className="px-5 py-3.5">
                        <span className="num font-medium text-ink">{formatNaira(p.selling_price)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {inv ? (
                          <span className={cn(
                            'num text-sm font-medium',
                            inv.is_low_stock ? 'text-danger' : 'text-ink',
                          )}>
                            {inv.total_quantity}
                            {inv.is_low_stock && <span className="ml-1 text-[10px] text-danger">LOW</span>}
                          </span>
                        ) : (
                          <span className="text-ink-4">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-ink-2">{p.form} · {p.strength}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={b.tone}>{b.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/console/products/${encodeURIComponent(p.sku)}`}
                          className="invisible rounded-md border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink-2 hover:border-brand-400 hover:text-brand-600 transition-colors group-hover:visible"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line-subtle bg-bg-subtle px-5 py-3 text-xs text-ink-3">
            Showing {visible.length} of {DUMMY_PRODUCTS.length} products
          </div>
        </div>
      )}
    </>
  );
}
