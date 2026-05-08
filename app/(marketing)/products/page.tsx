'use client';

import { useMemo, useState } from 'react';
import { Container, Section } from '@/components/ui/Layout';
import { ProductCard } from '@/components/shared/ProductCard';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Primitives';
import { Search, Pill } from '@/components/icons';
import { getAllProducts } from '@/lib/data/products';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';

const ALL = 'All';

export default function MarketingProductsPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(ALL);
  const products = getAllProducts();

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
    <Section tight>
      <Container>
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
            Catalog
          </span>
          <h1 className="display-serif mt-3 text-[clamp(2rem,5vw,3.25rem)] leading-[1.1] tracking-[-0.02em] text-ink">
            What&apos;s available, in real time.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-2">
            A preview of our catalog. To see batch-level pricing, expiry data, and place orders,{' '}
            <a href="/sign-up" className="font-medium text-brand-600 hover:text-brand-700">
              onboard your pharmacy
            </a>
            .
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <div className="relative max-w-md flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, SKU, manufacturer"
              className="h-11 w-full rounded-md border border-line bg-white pl-10 pr-4 text-sm text-ink placeholder:text-ink-4 focus:border-brand-500 focus:shadow-glow focus:outline-none"
              aria-label="Search products"
            />
          </div>
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
          <div className="mt-10">
            <EmptyState
              icon={<Pill size={24} />}
              title="No products match"
              description="Try a different search term or category."
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                href={`/products/${p.sku}`}
                action={
                  <ButtonLink href="/sign-up" size="sm" variant="ghost">
                    Sign in →
                  </ButtonLink>
                }
              />
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
