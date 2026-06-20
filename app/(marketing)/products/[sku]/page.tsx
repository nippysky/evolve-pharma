import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container, Section } from '@/components/ui/Layout';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Primitives';
import { ProductCard } from '@/components/shared/ProductCard';
import { ArrowLeft, Lock, Shield, Truck, Pill } from '@/components/icons';
import { getProductBySku, getRelatedProducts } from '@/lib/data/products';
import { formatNaira } from '@/lib/utils';

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

export default async function MarketingProductDetail({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const product = getProductBySku(sku);
  if (!product) notFound();
  const related = getRelatedProducts(product.sku, 4);

  return (
    <Section tight>
      <Container>
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"
        >
          <ArrowLeft size={14} /> Back to catalog
        </Link>

        <div className="mt-6 grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div className="relative aspect-4/3 overflow-hidden rounded-2xl border border-line bg-white">
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
            <h1 className="display-serif mt-2 text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.15] tracking-tight text-ink">
              {product.name}
            </h1>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="brand" noDot>
                {product.form}
              </Badge>
              <Badge tone="neutral" noDot>
                {product.strength}
              </Badge>
              <Badge tone="neutral" noDot>
                {product.pack_size}
              </Badge>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-ink-2">
              Generic name: <span className="font-medium text-ink">{product.generic_name}</span>
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-line bg-bg-subtle p-5">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                  Manufacturer
                </dt>
                <dd className="mt-1 text-sm font-medium text-ink">{product.manufacturer}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                  SKU
                </dt>
                <dd className="mt-1 font-mono text-xs text-ink">{product.sku}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                  Form
                </dt>
                <dd className="mt-1 text-sm font-medium text-ink">{product.form}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                  Strength
                </dt>
                <dd className="mt-1 text-sm font-medium text-ink">{product.strength}</dd>
              </div>
            </dl>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-4xl tracking-tight text-ink num">
                {formatNaira(product.selling_price)}
              </span>
              <span className="text-sm text-ink-3">/ pack · ex VAT</span>
            </div>

            <div className="mt-6 rounded-xl border border-line bg-white p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600">
                  <Lock size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-medium tracking-tight text-ink">
                    Order placement is for verified pharmacies
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">
                    Sign in or onboard your pharmacy to see live stock, batch data, and place
                    orders.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <ButtonLink href="/sign-up">Onboard pharmacy</ButtonLink>
                    <ButtonLink href="/sign-in" variant="secondary">
                      Sign in
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-3">
              <span className="flex items-center gap-1.5">
                <Shield size={12} /> NAFDAC verified
              </span>
              <span className="flex items-center gap-1.5">
                <Truck size={12} /> Same-day Abuja
              </span>
              <span className="flex items-center gap-1.5">
                <Pill size={12} /> Authentic batch
              </span>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-20">
            <h2 className="display-serif text-2xl tracking-tight text-ink">Related products</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} href={`/products/${p.sku}`} />
              ))}
            </div>
          </div>
        )}
      </Container>
    </Section>
  );
}
