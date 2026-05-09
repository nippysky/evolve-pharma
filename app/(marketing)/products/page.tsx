'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Container, Section } from '@/components/ui/Layout';
import { ProductCard } from '@/components/shared/ProductCard';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Primitives';
import {
  ArrowRight,
  Basket,
  CheckCircle,
  Pill,
  Search,
  Shield,
  Truck,
} from '@/components/icons';
import { getAllProducts } from '@/lib/data/products';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';

const ALL = 'All';

const CATALOG_FEATURES = [
  {
    label: 'Verified catalog',
    description: 'Organized product discovery for approved buyers.',
    Icon: Shield,
  },
  {
    label: 'Fast fulfillment',
    description: 'Built for practical ordering across Nigeria.',
    Icon: Truck,
  },
  {
    label: 'Clean ordering',
    description: 'Search, filter, review, and proceed with confidence.',
    Icon: Basket,
  },
];

export default function MarketingProductsPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(ALL);

  const products = useMemo(() => getAllProducts(), []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      if (category !== ALL && product.category !== category) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.manufacturer.toLowerCase().includes(normalizedQuery) ||
        product.sku.toLowerCase().includes(normalizedQuery) ||
        product.category.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [products, query, category]);

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(900px_420px_at_12%_-8%,rgba(0,166,212,0.12),transparent_62%),radial-gradient(760px_360px_at_88%_4%,rgba(22,163,74,0.08),transparent_62%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,1)_78%)]"
        />

        <Container>
          <div className="grid gap-8 pb-10 pt-10 sm:pt-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-end lg:gap-14 lg:pb-14 lg:pt-header">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-line-subtle bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl">
                <span className="h-1.5 w-1.5 rounded-full bg-leaf-500" />
                Catalog
              </span>

              <h1 className="display-serif mt-5 max-w-3xl text-[clamp(2.4rem,5.2vw,5rem)] leading-[0.96] tracking-[-0.065em] text-ink">
                Browse what&apos;s available.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-2 sm:text-lg">
                Explore pharmaceuticals, supplements, industrial chemicals, and related supplies in
                one clean catalog. To see order-ready details and complete checkout,{' '}
                <Link
                  href="/sign-up"
                  className="font-semibold text-brand-600 underline-offset-4 transition-colors hover:text-brand-700 hover:underline"
                >
                  create your buyer account
                </Link>
                .
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ButtonLink href="/sign-up" trailingIcon={<ArrowRight size={14} />}>
                  Create account
                </ButtonLink>

                <ButtonLink href="/sign-in" variant="secondary">
                  Sign in
                </ButtonLink>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {CATALOG_FEATURES.map(({ label, description, Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-line-subtle bg-white/78 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.055)] backdrop-blur-xl"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-bg-muted text-ink">
                    <Icon size={17} />
                  </span>

                  <h2 className="mt-3 text-sm font-semibold tracking-[-0.02em] text-ink">
                    {label}
                  </h2>

                  <p className="mt-1 text-xs leading-relaxed text-ink-3">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <Section tight>
        <Container>
          <div className="rounded-[1.65rem] border border-line-subtle bg-white p-3 shadow-[0_20px_70px_rgba(15,23,42,0.07)] sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3"
                />

                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, SKU, category, or manufacturer"
                  className="h-12 w-full rounded-2xl border border-line-subtle bg-bg-subtle pl-11 pr-4 text-sm text-ink transition-colors placeholder:text-ink-4 focus:border-brand-500 focus:bg-white focus:shadow-glow focus:outline-none"
                  aria-label="Search products"
                />
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-line-subtle bg-bg-subtle px-3 py-2 text-xs text-ink-2">
                <CheckCircle size={14} className="text-leaf-500" />
                <span>
                  {filtered.length} {filtered.length === 1 ? 'product' : 'products'} shown
                </span>
              </div>
            </div>

            <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setCategory(ALL)}
                className={cn(
                  'whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200',
                  category === ALL
                    ? 'border-ink bg-ink text-white shadow-[0_10px_28px_rgba(15,23,42,0.18)]'
                    : 'border-line-subtle bg-white text-ink-2 hover:border-line hover:text-ink',
                )}
              >
                All categories
              </button>

              {PRODUCT_CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={cn(
                    'whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200',
                    category === item
                      ? 'border-ink bg-ink text-white shadow-[0_10px_28px_rgba(15,23,42,0.18)]'
                      : 'border-line-subtle bg-white text-ink-2 hover:border-line hover:text-ink',
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
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
            <div className="mt-8 grid gap-4  sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  href={`/products/${product.sku}`}
                />
              ))}
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}