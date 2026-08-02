/**
 * ProductCard — premium display card for products in lists/grids.
 *
 * Important:
 * This component intentionally does NOT wrap the entire card in a Link.
 * That prevents invalid nested <a> tags when `action` contains ButtonLink/Link.
 *
 * Props:
 *   - product: ProductDTO (required)
 *   - href?: string (optional - links the media/title/default CTA)
 *   - action?: ReactNode (optional - rendered in the price row, right side)
 *
 * Used by both the marketing /products grid and the portal /portal/catalog.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import type { ProductDTO } from '@/lib/api/types';
import { ArrowRight, Pill } from '@/components/icons';
import { formatNaira, cn } from '@/lib/utils';

interface ProductCardProps {
  product: ProductDTO;
  href?: string;
  action?: ReactNode;
}

export function ProductCard({ product, href, action }: ProductCardProps) {
  const imageUrl     = product.images[0]?.url ?? '';
  const categoryName = product.category?.name ?? '';
  const strength     = product.product_strength ?? '';

  const imageEl = imageUrl ? (
    <Image
      src={imageUrl}
      alt={product.brand_name}
      width={720}
      height={540}
      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-ink-4">
      <Pill size={40} />
    </div>
  );

  return (
    <article
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-line-subtle bg-white',
        'shadow-[0_1px_0_rgba(15,23,42,0.04),0_18px_50px_rgba(15,23,42,0.05)]',
        'transition-all duration-300 ease-out',
        'hover:-translate-y-1 hover:border-line hover:shadow-[0_24px_70px_rgba(15,23,42,0.10)]',
      )}
    >
      <div className="relative aspect-4/3 overflow-hidden bg-bg-muted">
        {href ? (
          <Link
            href={href}
            aria-label={`View ${product.brand_name}`}
            className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/70 focus-visible:ring-inset"
          >
            {imageEl}
          </Link>
        ) : (
          imageEl
        )}

        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-ink/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-600">
          {categoryName}
        </span>

        {href ? (
          <Link
            href={href}
            className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.02em] text-ink transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:text-brand-700"
          >
            {product.brand_name}
          </Link>
        ) : (
          <h3 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.02em] text-ink">
            {product.brand_name}
          </h3>
        )}

        <p className="mt-1.5 line-clamp-1 text-xs leading-relaxed text-ink-3">
          {product.generic_name}{strength ? ` · ${strength}` : ''}{product.pack_size ? ` · ${product.pack_size}` : ''}
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-4">
              Price
            </p>
            <span className="num mt-1 block font-display text-[1.35rem] leading-none tracking-[-0.035em] text-ink">
              {formatNaira(parseFloat(product.selling_price))}
            </span>
          </div>

          {action ? (
            action
          ) : href ? (
            <Link
              href={href}
              aria-label={`View ${product.brand_name}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-subtle bg-white px-3 text-xs font-semibold text-ink-2 transition-all duration-200 hover:border-line hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/70 focus-visible:ring-offset-2"
            >
              View
              <ArrowRight size={12} />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
