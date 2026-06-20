import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Avatar } from '@/components/ui/Primitives';
import { ProductCard } from '@/components/shared/ProductCard';
import { ArrowLeft, Star, Shield, Truck, Pill } from '@/components/icons';
import { getProductBySku, getRelatedProducts } from '@/lib/data/products';
import { REVIEWS } from '@/lib/data/operational';
import { formatNaira, formatDate } from '@/lib/utils';
import { AddToBasket } from './AddToBasket';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sku: string }>;
}): Promise<Metadata> {
  const { sku } = await params;
  const product = getProductBySku(sku);
  return product
    ? { title: product.name, description: `${product.generic_name} — ${product.form} ${product.strength}` }
    : { title: 'Product not found' };
}

export default async function PortalProductDetail({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const product = getProductBySku(sku);
  if (!product) notFound();

  const related = getRelatedProducts(product.sku, 4);
  const reviews = REVIEWS.filter((r) => r.product_id === product.id);
  const avgRating =
    reviews.length > 0 ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length : 0;

  return (
    <>
      <Link
        href="/portal/catalog"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={14} /> Back to catalog
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-white">
          <Image
            src={product.image_url}
            alt={product.name}
            width={1000}
            height={750}
            className="h-full w-full object-cover"
            priority
          />
          {product.prescription_required && (
            <span className="absolute right-3 top-3 rounded-md bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm backdrop-blur">
              Rx · Prescription required
            </span>
          )}
        </div>

        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">
            {product.category}
          </span>
          <h1 className="display-serif mt-2 text-[clamp(1.5rem,3vw,2.25rem)] leading-[1.15] tracking-tight text-ink">
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="brand" noDot>{product.form}</Badge>
            <Badge tone="neutral" noDot>{product.strength}</Badge>
            <Badge tone="neutral" noDot>{product.pack_size}</Badge>
            {avgRating > 0 && (
              <Badge tone="warning" noDot>
                <Star size={11} /> {avgRating.toFixed(1)} · {reviews.length}
              </Badge>
            )}
          </div>

          <p className="mt-5 text-sm leading-relaxed text-ink-2">
            Generic name: <span className="font-medium text-ink">{product.generic_name}</span>
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-line bg-bg-subtle p-5">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Manufacturer</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{product.manufacturer}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">SKU</dt>
              <dd className="mt-1 font-mono text-xs text-ink">{product.sku}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Form</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{product.form}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Strength</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{product.strength}</dd>
            </div>
          </dl>

          <div className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-4xl tracking-tight text-ink num">
              {formatNaira(product.selling_price)}
            </span>
            <span className="text-sm text-ink-3">/ pack</span>
          </div>

          <AddToBasket product={product} />

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-3">
            <span className="flex items-center gap-1.5"><Shield size={12} /> NAFDAC verified</span>
            <span className="flex items-center gap-1.5"><Truck size={12} /> Same-day Abuja</span>
            <span className="flex items-center gap-1.5"><Pill size={12} /> Authentic batch</span>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="mt-16">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="display-serif text-2xl tracking-tight text-ink">Reviews</h2>
          <span className="text-sm text-ink-3">
            {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
          </span>
        </div>
        {reviews.length === 0 ? (
          <p className="py-8 text-sm text-ink-3">No reviews yet for this product.</p>
        ) : (
          <ul className="divide-y divide-line-subtle border-y border-line-subtle">
            {reviews.map((r) => (
              <li key={r.id} className="flex gap-3.5 py-5">
                <Avatar name={r.customer_name} />
                <div>
                  <strong className="block text-sm font-semibold text-ink">{r.customer_name}</strong>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
                    <span className="flex gap-px text-amber-500" aria-label={`${r.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12} fill={i < r.rating ? 'currentColor' : 'transparent'} />
                      ))}
                    </span>
                    <span>{formatDate(r.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{r.comment}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="display-serif text-2xl tracking-tight text-ink">You might also need</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} href={`/portal/catalog/${p.sku}`} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
