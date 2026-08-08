import { Suspense } from 'react';
import { getActiveProducts } from '@/lib/data/products.server';
import { PortalCatalogClient } from '@/components/portal/PortalCatalogClient';

function CatalogSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded-lg bg-bg-muted" />
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-line-subtle bg-white">
            <div className="aspect-[4/3] bg-bg-muted" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-16 rounded bg-bg-muted" />
              <div className="h-4 w-full rounded bg-bg-muted" />
              <div className="h-3 w-2/3 rounded bg-bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function CatalogContent() {
  let products: Awaited<ReturnType<typeof getActiveProducts>> = [];
  try {
    products = await getActiveProducts(200);
  } catch (err) {
    console.error('[portal/catalog] getActiveProducts failed:', err);
    // Return empty list with a message rather than crashing the page
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-sm font-medium text-ink-2">Could not load catalogue</p>
        <p className="text-xs text-ink-4">Please refresh the page. If this keeps happening, contact support.</p>
      </div>
    );
  }
  return <PortalCatalogClient products={products} />;
}

export default function PortalCatalogPage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <CatalogContent />
    </Suspense>
  );
}
