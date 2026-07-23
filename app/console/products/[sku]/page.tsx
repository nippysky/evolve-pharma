import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { Badge } from '@/components/ui/Primitives';
import { ArrowLeft } from '@/components/icons';
import { ProductForm } from '@/components/console/ProductForm';
import { DUMMY_PRODUCTS } from '@/lib/data/dummy-products';
import { DUMMY_INVENTORY } from '@/lib/data/dummy-console';
import { formatNaira, formatDate } from '@/lib/utils';

export async function generateMetadata({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  return { title: `Edit · ${decodeURIComponent(sku)}` };
}

type BadgeTone = 'neutral' | 'success' | 'danger';

function statusBadge(s: string): { label: string; tone: BadgeTone } {
  if (s === 'active')       return { label: 'Active',       tone: 'success' };
  if (s === 'discontinued') return { label: 'Discontinued', tone: 'danger'  };
  return { label: 'Draft', tone: 'neutral' };
}

export default async function ProductEditPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'admin') redirect('/console/products');

  const decodedSku = decodeURIComponent(sku);
  const product = DUMMY_PRODUCTS.find((p) => p.sku === decodedSku);
  if (!product) notFound();

  const inv = DUMMY_INVENTORY.find((s) => s.product.id === product.id);
  const b   = statusBadge(product.status);

  return (
    <>
      <Link
        href="/console/products"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors"
      >
        <ArrowLeft size={14} /> Back to products
      </Link>

      <PageHead
        title={`Edit: ${product.name}`}
        subtitle={`SKU ${product.sku} · ${product.manufacturer}`}
      />

      {/* Quick-stat strip */}
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Status</p>
          <div className="mt-1.5">
            <Badge tone={b.tone}>{b.label}</Badge>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Selling price</p>
          <p className="num mt-1 font-display text-lg tracking-tight text-ink">{formatNaira(product.selling_price)}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Stock on hand</p>
          <p className={`num mt-1 font-display text-lg tracking-tight ${inv?.is_low_stock ? 'text-danger' : 'text-ink'}`}>
            {inv?.total_quantity ?? '—'}
            {inv?.is_low_stock && <span className="ml-1 text-xs font-normal text-danger">LOW</span>}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Next expiry</p>
          <p className="num mt-1 font-display text-lg tracking-tight text-ink">
            {inv?.next_expiry ? formatDate(inv.next_expiry) : '—'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        {/* Edit form */}
        <div className="max-w-3xl">
          <ProductForm mode="edit" product={product} />
        </div>

        {/* Product card / preview */}
        <aside className="space-y-4">
          {/* Image */}
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <div className="flex h-48 items-center justify-center bg-bg-subtle">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  width={160}
                  height={160}
                  className="h-40 w-40 object-contain"
                />
              ) : (
                <span className="text-sm text-ink-4">No image</span>
              )}
            </div>
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-ink-3">Category</p>
              <p className="mt-0.5 text-sm text-ink">{product.category}</p>
            </div>
          </div>

          {/* Metadata */}
          <div className="overflow-hidden rounded-xl border border-line bg-white divide-y divide-line-subtle">
            {[
              { label: 'Generic name',  value: product.generic_name },
              { label: 'Form',          value: product.form },
              { label: 'Strength',      value: product.strength },
              { label: 'Pack size',     value: product.pack_size },
              { label: 'Rx required',   value: product.prescription_required ? 'Yes' : 'No' },
              { label: 'Shelf',         value: product.shelf_location ?? '—' },
              { label: 'Cost price',    value: formatNaira(product.cost_price) },
              { label: 'Created',       value: formatDate(product.created_at) },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <span className="text-xs text-ink-3">{row.label}</span>
                <span className="text-xs font-medium text-ink text-right">{row.value}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
