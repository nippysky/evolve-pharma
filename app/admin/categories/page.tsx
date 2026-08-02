'use client';

/**
 * Console · Product Categories
 *
 * Lists all categories from GET product/categories.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useProductCategories } from '@/hooks/admin/useAdminProducts';
import { PageHead } from '@/components/shared/PageHead';
import { Search, AlertTriangle, RotateCw, Tag } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { CategoryDTO } from '@/lib/api/types';

// ─── Skeleton ────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl bg-bg-muted"
          style={{ animationDelay: `${i * 50}ms` }}
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [query, setQuery] = useState('');

  const { data, isLoading, error, refetch } = useProductCategories();

  const categories = useMemo(() => {
    const all = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c: CategoryDTO) => c.name.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <>
      <PageHead
        title="Categories"
        subtitle="All product categories in the system."
        actions={
          <Link
            href="/admin/products"
            className="rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            ← Back to Products
          </Link>
        }
      />

      {/* Search */}
      <div className="mb-6 flex items-center gap-3">
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter categories…"
            aria-label="Search categories"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-brand-500 focus:outline-none"
          />
        </div>
        {data && (
          <p className="text-sm text-ink-3">
            <span className="font-semibold text-ink-2">{(data ?? []).length}</span> total
          </p>
        )}
      </div>

      {/* Loading */}
      {isLoading && <GridSkeleton />}

      {/* Error */}
      {error && !isLoading && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-red-200 bg-red-50 px-6 py-12 text-center">
          <AlertTriangle size={24} className="text-red-400" />
          <p className="font-semibold text-red-700">Could not load categories</p>
          <p className="text-sm text-red-500">{(error as Error).message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-1 flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
          >
            <RotateCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && categories.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center">
          <Tag size={28} className="text-ink-4" />
          <p className="font-semibold text-ink">
            {query ? 'No categories match your search' : 'No categories yet'}
          </p>
          <p className="text-sm text-ink-3">
            {query
              ? 'Try a different keyword.'
              : 'Categories are created automatically when products are imported.'}
          </p>
        </div>
      )}

      {/* Category grid */}
      {!isLoading && !error && categories.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat: CategoryDTO) => (
            <div
              key={cat.name}
              className="group flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 group-hover:bg-brand-200 transition-colors">
                <Tag size={16} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{cat.name}</p>
                <Link
                  href={`/admin/products?category=${encodeURIComponent(cat.name)}`}
                  className="text-xs text-ink-3 hover:text-brand-600 transition-colors"
                >
                  View products →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Result count when filtering */}
      {!isLoading && !error && query && categories.length > 0 && (
        <p className="mt-4 text-center text-xs text-ink-4">
          Showing {categories.length} of {(data ?? []).length} categories
        </p>
      )}
    </>
  );
}
