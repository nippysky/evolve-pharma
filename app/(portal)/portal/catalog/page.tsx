'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Search, Plus, Check, X, Pill, ArrowRight, ShoppingCart } from '@/components/icons';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { DUMMY_PRODUCTS } from '@/lib/data/dummy-products';
import { useBasket } from '@/lib/hooks/useBasket';
import { useToast } from '@/contexts/ToastContext';
import { formatNaira, cn } from '@/lib/utils';
import type { ProductDTO } from '@/lib/api/types';

const ALL = 'All';

function CatalogProductCard({ product }: { product: ProductDTO }) {
  const add = useBasket((s) => s.add);
  const has = useBasket((s) => s.hasItem);
  const getQty = useBasket((s) => s.getQuantity);
  const toast = useToast();
  const inBasket = has(product.id);
  const qty = getQty(product.id);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    add(product);
    toast.show({
      tone: 'success',
      title: inBasket ? `Added another · ${qty + 1} total` : 'Added to basket',
      description: product.brand_name,
    });
  };

  const imageUrl = product.images[0]?.url ?? '';
  const categoryName = product.category?.name ?? '';

  return (
    <article className={cn(
      'group relative flex flex-col overflow-hidden rounded-2xl border border-line-subtle bg-white',
      'shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.04)]',
      'transition-all duration-300',
      'hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_8px_30px_rgba(4,42,54,0.10)]',
    )}>
      <Link href={`/portal/catalog/${product.sku}`} className="block aspect-[4/3] overflow-hidden bg-bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.brand_name}
            width={480}
            height={360}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-4">
            <Pill size={40} />
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-600">
          {categoryName}
        </span>

        <Link
          href={`/portal/catalog/${product.sku}`}
          className="mt-1.5 line-clamp-2 text-[14px] font-semibold leading-snug tracking-tight text-ink transition-colors hover:text-teal-700"
        >
          {product.brand_name}
        </Link>

        <p className="mt-1 line-clamp-1 text-[11px] text-ink-3">
          {product.generic_name}
          {product.product_strength && product.product_strength !== '—' ? ` · ${product.product_strength}` : ''}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-4">Per pack</p>
            <span className="num mt-0.5 block font-display text-[1.2rem] leading-none tracking-[-0.03em] text-ink">
              {formatNaira(parseFloat(product.selling_price))}
            </span>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            aria-label={`${inBasket ? 'Add more' : 'Add'} ${product.brand_name} to basket`}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200',
              inBasket
                ? 'bg-teal-50 text-teal-600 hover:bg-teal-100 ring-1 ring-teal-200'
                : 'bg-[#042a36] text-white hover:opacity-80 shadow-sm',
            )}
          >
            {inBasket ? <Check size={15} /> : <Plus size={15} />}
          </button>
        </div>

        {inBasket && (
          <div className="mt-2 flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1">
            <ShoppingCart size={11} className="text-teal-500" />
            <span className="text-[11px] font-medium text-teal-600">{qty} in basket</span>
          </div>
        )}
      </div>
    </article>
  );
}

export default function PortalCatalogPage() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [category, setCategory] = useState<string>(ALL);

  // Sync when URL search param changes (topbar debounced search)
  useEffect(() => {
    setQuery(params.get('q') ?? '');
  }, [params]);

  const usedCategories = useMemo(
    () => [ALL, ...PRODUCT_CATEGORIES.filter((c) => DUMMY_PRODUCTS.some((p) => p.category?.name === c))],
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DUMMY_PRODUCTS.filter((p) => {
      if (category !== ALL && p.category?.name !== category) return false;
      if (!q) return true;
      return (
        p.brand_name.toLowerCase().includes(q) ||
        p.generic_name.toLowerCase().includes(q) ||
        (p.manufacturer?.name ?? '').toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category?.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  const countFor = (cat: string) => {
    const q = query.trim().toLowerCase();
    return DUMMY_PRODUCTS.filter((p) => {
      if (cat !== ALL && p.category?.name !== cat) return false;
      if (!q) return true;
      return (
        p.brand_name.toLowerCase().includes(q) ||
        p.generic_name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    }).length;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Product Catalogue</h1>
        <p className="mt-1 text-sm text-ink-3">
          Browse our full range of pharmaceutical products. All prices are per pack — bulk discounts available on request.
        </p>
      </div>

      {/* Mobile search */}
      <div className="relative mb-4 lg:hidden">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, generic, SKU…"
          aria-label="Search catalogue"
          className={cn(
            'h-10 w-full rounded-full border bg-white pl-9 pr-9 text-sm text-ink placeholder:text-ink-3',
            'focus:border-teal-400 focus:shadow-[0_0_0_3px_rgba(45,212,191,0.12)] focus:outline-none transition-all duration-150',
            query ? 'border-teal-400/60' : 'border-line',
          )}
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Category pills */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {usedCategories.map((cat) => {
          const active = category === cat;
          const count = countFor(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-150',
                active
                  ? 'border-[#042a36] bg-[#042a36] text-white shadow-sm'
                  : 'border-line bg-white text-ink-2 hover:border-teal-300 hover:text-[#042a36]',
              )}
            >
              {cat === ALL ? 'All' : cat}
              <span className={cn(
                'rounded-full px-1.5 py-px text-[10px] font-semibold leading-none',
                active ? 'bg-white/20 text-white' : 'bg-bg-muted text-ink-3',
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Results meta */}
      <div className="mt-4 mb-3 flex items-center justify-between">
        <p className="text-xs text-ink-3">
          {filtered.length === 0 ? 'No products found' : `${filtered.length} product${filtered.length !== 1 ? 's' : ''}${query ? ` for "${query}"` : ''}`}
        </p>
        {(query || category !== ALL) && (
          <button
            type="button"
            onClick={() => { setQuery(''); setCategory(ALL); }}
            className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:underline"
          >
            <X size={11} /> Clear filters
          </button>
        )}
      </div>

      {/* Grid / empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-bg-muted text-ink-3">
            <Pill size={28} />
          </div>
          <h2 className="mt-4 text-base font-semibold text-ink">No products match</h2>
          <p className="mt-1 text-sm text-ink-3">Try a different keyword or clear the category filter.</p>
          <button
            type="button"
            onClick={() => { setQuery(''); setCategory(ALL); }}
            className="mt-4 flex items-center gap-1.5 rounded-full bg-[#042a36] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <X size={13} /> Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => <CatalogProductCard key={p.id} product={p} />)}
        </div>
      )}

      <div className="mt-10 border-t border-line-subtle pt-5 text-center text-xs text-ink-3">
        {DUMMY_PRODUCTS.length} products in catalogue ·{' '}
        <Link href="/portal/orders" className="inline-flex items-center gap-0.5 text-teal-600 hover:underline">
          View my orders <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}
