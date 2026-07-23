import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProductBySku } from '@/lib/data/dummy-products';
import { AddToBasket } from './AddToBasket';
import { formatNaira } from '@/lib/utils';
import { ArrowLeft, Shield, Pill, Building, Box } from '@/components/icons';

interface Props {
  params: Promise<{ sku: string }>;
}

export default async function ProductDetailPage({ params }: Props) {
  const { sku } = await params;
  const product = getProductBySku(sku);
  if (!product) notFound();

  const details = [
    { label: 'Generic name',  value: product.generic_name },
    { label: 'Manufacturer',  value: product.manufacturer },
    { label: 'Dosage form',   value: product.form },
    { label: 'Strength',      value: product.strength !== '—' ? product.strength : '—' },
    { label: 'Pack size',     value: product.pack_size },
    { label: 'Category',      value: product.category },
    { label: 'SKU / Code',    value: product.sku },
    { label: 'Prescription',  value: product.prescription_required ? 'Required' : 'OTC — no prescription needed' },
  ];

  return (
    <div>
      <Link
        href="/portal/catalog"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition-colors hover:text-teal-700"
      >
        <ArrowLeft size={15} />
        Back to catalogue
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_440px]">
        {/* Image panel */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-line-subtle bg-white">
            <div className="relative aspect-square sm:aspect-[4/3]">
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                className="object-contain p-8"
                sizes="(max-width: 1024px) 100vw, 600px"
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
              <div key={text} className="flex flex-col items-center gap-1.5 rounded-xl border border-line-subtle bg-white p-3 text-center">
                <Icon size={18} className="text-teal-600" />
                <span className="text-[11px] font-medium text-ink-2">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Details + actions */}
        <div className="flex flex-col gap-5">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-600">
              {product.category}
            </span>
            <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
              {product.name}
            </h1>
            <p className="mt-1.5 text-sm text-ink-3">
              <span className="font-medium text-ink-2">{product.generic_name}</span>
              {product.strength !== '—' && ` · ${product.strength}`}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
              <Building size={12} />
              {product.manufacturer}
            </p>
          </div>

          {/* Price */}
          <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-cyan-50 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-600">Price per pack</p>
            <p className="num mt-1 font-display text-4xl font-semibold leading-none tracking-tight text-ink">
              {formatNaira(product.selling_price)}
            </p>
            <p className="mt-1.5 text-xs text-ink-3">
              Pack size: {product.pack_size} · VAT inclusive
            </p>
          </div>

          {/* Quantity + add to basket */}
          <AddToBasket product={product} />

          {/* Specs table */}
          <div className="rounded-xl border border-line-subtle bg-white">
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

          <p className="rounded-lg border border-amber-100 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-800">
            <strong className="font-semibold">Important:</strong> This platform is for licensed pharmacy and healthcare procurement only. Prescription products require valid documentation.
          </p>
        </div>
      </div>
    </div>
  );
}
