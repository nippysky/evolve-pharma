'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ProductCard } from '@/components/shared/ProductCard';
import { EmptyState } from '@/components/ui/Primitives';
import { Search, CheckCircle, Pill, X } from '@/components/icons';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';

const ALL = 'All';

interface ProductsCatalogProps {
  products: Product[];
  initialCategory?: string;
}

export function ProductsCatalog({ products, initialCategory }: ProductsCatalogProps) {
  const [query,    setQuery]    = useState('');
  const [category, setCategory] = useState<string>(initialCategory ?? ALL);

  const usedCategories = useMemo(
    () => [ALL, ...PRODUCT_CATEGORIES.filter((c) => products.some((p) => p.category === c))],
    [products],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== ALL && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.generic_name.toLowerCase().includes(q) ||
        p.manufacturer.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, query, category]);

  return (
    <>
      {/* Search + filter bar */}
      <div className="rounded-[1.65rem] border border-line-subtle bg-white p-3 shadow-[0_20px_70px_rgba(15,23,42,0.07)] sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, SKU, category, or manufacturer"
              className="h-12 w-full rounded-2xl border border-line-subtle bg-bg-subtle pl-11 pr-10 text-sm text-ink transition-colors placeholder:text-ink-4 focus:border-teal-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(45,212,191,0.12)] focus:outline-none"
              aria-label="Search products"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-line-subtle bg-bg-subtle px-3 py-2 text-xs text-ink-2">
            <CheckCircle size={14} className="text-leaf-500" />
            <span>
              <strong className="font-semibold text-ink">{filtered.length}</strong>{' '}
              {filtered.length === 1 ? 'product' : 'products'} shown
            </span>
          </div>
        </div>

        {/* Category pills */}
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
          {usedCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                'whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200',
                category === cat
                  ? 'border-[#042a36] bg-[#042a36] text-white shadow-[0_8px_20px_rgba(4,42,54,0.22)]'
                  : 'border-line-subtle bg-white text-ink-2 hover:border-line hover:text-ink',
              )}
            >
              {cat === ALL ? 'All categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<Pill size={24} />}
            title="No products match"
            description="Try a different search term or category."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              href={`/products/${product.sku}`}
            />
          ))}
        </div>
      )}
    </>
  );
}
