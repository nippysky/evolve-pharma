import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, AlertTriangle, Box } from '@/components/icons';
import { Badge } from '@/components/ui/Primitives';
import { PageHead } from '@/components/shared/PageHead';
import { ProductForm } from '@/components/console/ProductForm';
import { getProductBySku } from '@/lib/data/products';
import { INVENTORY } from '@/lib/data/operational';
import { formatNaira, formatDate } from '@/lib/utils';

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const product = getProductBySku(sku);
  if (!product) notFound();

  const inv = INVENTORY.find((i) => i.product.id === product.id);

  return (
    <>
      <Link
        href="/console/products"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={14} /> Back to products
      </Link>

      <PageHead title={product.name} subtitle="Edit catalog details, pricing, and prescription status." />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <ProductForm product={product} mode="edit" />

        <aside className="flex flex-col gap-4 self-start">
          <div className="rounded-xl border border-line bg-white p-5">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
              <Box size={12} /> Inventory snapshot
            </h3>
            {inv ? (
              <>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-sm text-ink-2">In stock</span>
                  <span className="num font-display text-2xl tracking-tight">
                    {inv.total_quantity}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-sm text-ink-2">Active batches</span>
                  <span className="num text-sm font-medium text-ink">{inv.batches.length}</span>
                </div>
                {inv.next_expiry && (
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-sm text-ink-2">Next expiry</span>
                    <span className="text-sm font-medium text-ink">{formatDate(inv.next_expiry)}</span>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line-subtle pt-3">
                  {inv.is_low_stock && (
                    <Badge tone="warning">
                      <AlertTriangle size={11} /> Low stock
                    </Badge>
                  )}
                  {inv.is_expiring_soon && (
                    <Badge tone="warning" noDot>Expiring soon</Badge>
                  )}
                  {!inv.is_low_stock && !inv.is_expiring_soon && (
                    <Badge tone="success" noDot>Healthy</Badge>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-3">No inventory record yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-line bg-white p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
              Pricing snapshot
            </h3>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-2">Single pack</dt>
                <dd className="num font-medium text-ink">{formatNaira(product.price)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-2">Bulk (10+)</dt>
                <dd className="num font-medium text-ink">{formatNaira(Math.round(product.price * 0.92))}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-2">Bulk (50+)</dt>
                <dd className="num font-medium text-ink">{formatNaira(Math.round(product.price * 0.85))}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}
