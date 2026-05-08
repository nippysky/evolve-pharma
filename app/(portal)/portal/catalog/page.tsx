'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProductCard } from '@/components/shared/ProductCard';
import { PageHead } from '@/components/shared/PageHead';
import { EmptyState } from '@/components/ui/Primitives';
import { Search, Plus, Check, Pill } from '@/components/icons';
import { getAllProducts } from '@/lib/data/products';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { useBasket } from '@/lib/hooks/useBasket';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';

const ALL = 'All';

export default function PortalCatalogPage() {
  const params = useSearchParams();
  const initialQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<string>(ALL);
  const products = getAllProducts();
  const add = useBasket((s) => s.add);
  const has = useBasket((s) => s.hasItem);
  const toast = useToast();

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (category !== ALL && p.category !== category) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.manufacturer.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    });
  }, [products, query, category]);

  return (
    <>
      <PageHead
        title="Catalog"
        subtitle="Browse and add to your basket. Pricing is live; items added stay there until you check out or clear them."
      />

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, manufacturer or SKU"
          aria-label="Search catalog"
          className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-4 text-sm text-ink placeholder:text-ink-4 focus:border-brand-500 focus:shadow-glow focus:outline-none"
        />
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategory(ALL)}
          className={cn(
            'whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
            category === ALL
              ? 'border-ink bg-ink text-white'
              : 'border-line bg-white text-ink-2 hover:border-line-strong hover:text-ink',
          )}
        >
          All categories
        </button>
        {PRODUCT_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              'whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
              category === c
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-white text-ink-2 hover:border-line-strong hover:text-ink',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Pill size={24} />}
            title="No products match"
            description="Try a different search term or category."
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const inBasket = has(p.id);
            return (
              <ProductCard
                key={p.id}
                product={p}
                href={`/portal/catalog/${p.sku}`}
                action={
                  <button
                    type="button"
                    onClick={() => {
                      add(p);
                      toast.show({
                        tone: 'success',
                        title: inBasket ? 'Added another' : 'Added to basket',
                        description: p.name,
                      });
                    }}
                    aria-label={`Add ${p.name} to basket`}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                      inBasket
                        ? 'bg-leaf-100 text-leaf-700 hover:bg-leaf-200'
                        : 'bg-ink text-white hover:bg-brand-700',
                    )}
                  >
                    {inBasket ? <Check size={12} /> : <Plus size={12} />}
                    {inBasket ? 'Added' : 'Basket'}
                  </button>
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}
