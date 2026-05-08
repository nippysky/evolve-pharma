/**
 * ProductCard — display card for a product in lists/grids.
 *
 * Props:
 *   - product: Product (required)
 *   - href?: string (optional - makes the title a link)
 *   - action?: ReactNode (optional - rendered in the price row, right side)
 *
 * Used by both the marketing /products grid and the portal /portal/catalog.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import type { Product } from '@/types';
import { formatNaira } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  href?: string;
  action?: ReactNode;
}

export function ProductCard({ product, href, action }: ProductCardProps) {
  const TitleEl = href ? Link : 'span';
  const titleProps = href ? { href } : {};

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-bg-muted">
        {href ? (
          <Link href={href} aria-label={product.name} className="block h-full w-full">
            <Image
              src={product.image_url}
              alt={product.name}
              width={600}
              height={450}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </Link>
        ) : (
          <Image
            src={product.image_url}
            alt={product.name}
            width={600}
            height={450}
            className="h-full w-full object-cover"
          />
        )}
        {product.prescription_required && (
          <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink shadow-sm backdrop-blur">
            Rx
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-600">
          {product.category}
        </span>

        {/* @ts-expect-error - polymorphic */}
        <TitleEl
          {...titleProps}
          className="mt-1.5 line-clamp-2 text-[15px] font-medium leading-snug tracking-tight text-ink hover:text-brand-600"
        >
          {product.name}
        </TitleEl>

        <div className="mt-1 text-xs text-ink-3">
          {product.form} · {product.strength} · {product.pack_size}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="font-display text-xl tracking-tight text-ink num">
            {formatNaira(product.price)}
          </span>
          {action}
        </div>
      </div>
    </article>
  );
}
