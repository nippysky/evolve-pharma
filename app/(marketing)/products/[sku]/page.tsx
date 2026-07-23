import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Container } from '@/components/ui/Layout';
import { ButtonLink } from '@/components/ui/Button';
import {
  ArrowLeft, ArrowRight, Shield, Pill, Box,
  Lock, ShoppingCart, User,
} from '@/components/icons';
import { getSession } from '@/lib/auth';
import { getProductBySku } from '@/lib/data/dummy-products';
import { formatNaira } from '@/lib/utils';

interface Props {
  params: Promise<{ sku: string }>;
}

export default async function MarketingProductDetail({ params }: Props) {
  const { sku } = await params;
  const product  = getProductBySku(sku);
  if (!product) notFound();

  const session = await getSession();

  // Logged-in users go straight to the real portal product page
  if (session) {
    const dest = session.role === 'customer'
      ? `/portal/catalog/${product.sku}`
      : '/console/overview';
    redirect(dest);
  }

  const isLoggedIn = false;
  const portalHref = `/portal/catalog/${product.sku}`;

  const details = [
    { label: 'Generic name',  value: product.generic_name },
    { label: 'Manufacturer',  value: product.manufacturer },
    { label: 'Dosage form',   value: product.form },
    { label: 'Strength',      value: product.strength !== '—' ? product.strength : '—' },
    { label: 'Pack size',     value: product.pack_size },
    { label: 'Category',      value: product.category },
    { label: 'SKU',           value: product.sku },
    { label: 'Prescription',  value: product.prescription_required ? 'Required' : 'OTC' },
  ];

  return (
    <Container>
      <div className="py-8 sm:py-12">
        <Link
          href="/products"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} />
          Back to catalogue
        </Link>

        <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
          {/* ── Image panel ── */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-3xl border border-line-subtle bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
              <div className="relative aspect-square sm:aspect-[4/3]">
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  className="object-contain p-10"
                  sizes="(max-width: 1024px) 100vw, 640px"
                  priority
                />
                {product.prescription_required && (
                  <span className="absolute left-4 top-4 rounded-full bg-ink/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                    Rx required
                  </span>
                )}
              </div>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { Icon: Shield, text: 'Verified stock' },
                { Icon: Pill,   text: 'NAFDAC listed' },
                { Icon: Box,    text: 'Original packs' },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex flex-col items-center gap-1.5 rounded-2xl border border-line-subtle bg-white p-3 text-center shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                  <Icon size={18} className="text-brand-600" />
                  <span className="text-[11px] font-medium text-ink-2">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Details + CTA ── */}
          <div className="flex flex-col gap-5">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">
                {product.category}
              </span>
              <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-ink">
                {product.name}
              </h1>
              <p className="mt-1.5 text-sm text-ink-3">
                <span className="font-medium text-ink-2">{product.generic_name}</span>
                {product.strength !== '—' && ` · ${product.strength}`}
              </p>
              <p className="mt-1 text-xs text-ink-3">{product.manufacturer}</p>
            </div>

            {/* Price */}
            <div className="rounded-2xl border border-line-subtle bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.07)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-4">Price per pack</p>
              <p className="num mt-1 font-display text-4xl font-semibold leading-none tracking-tight text-ink">
                {formatNaira(product.selling_price)}
              </p>
              <p className="mt-1.5 text-xs text-ink-3">Pack size: {product.pack_size} · VAT inclusive</p>
            </div>

            {/* CTA — session-aware */}
            {isLoggedIn ? (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
                <p className="text-xs font-semibold text-teal-700">You&apos;re signed in — order directly from your portal</p>
                <Link
                  href={portalHref}
                  className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#042a36] text-sm font-semibold text-white shadow-[0_8px_24px_rgba(4,42,54,0.28)] transition-all hover:-translate-y-0.5 hover:bg-teal-900"
                >
                  <ShoppingCart size={16} />
                  Add to basket in portal
                  <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-line-subtle bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
                <div className="mb-4 flex items-center gap-2">
                  <Lock size={14} className="text-ink-3" />
                  <p className="text-sm text-ink-2">Create a buyer account to place orders</p>
                </div>
                <div className="flex flex-col gap-2">
                  <ButtonLink
                    href="/sign-up"
                    fullWidth
                    trailingIcon={<ArrowRight size={14} />}
                  >
                    Create account to order
                  </ButtonLink>
                  <ButtonLink href="/sign-in" variant="secondary" fullWidth>
                    Sign in
                  </ButtonLink>
                </div>
              </div>
            )}

            {/* Specs */}
            <div className="overflow-hidden rounded-2xl border border-line-subtle bg-white">
              <div className="border-b border-line-subtle px-4 py-3">
                <h2 className="text-sm font-semibold tracking-tight text-ink">Product details</h2>
              </div>
              <dl className="divide-y divide-line-subtle">
                {details.map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-4 px-4 py-2.5">
                    <dt className="text-xs font-medium text-ink-3">{label}</dt>
                    <dd className="text-right text-xs font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              <strong className="font-semibold">Note:</strong> This platform is for licensed pharmacy and healthcare procurement only.
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}
