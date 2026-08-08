'use client';

/**
 * ProductImageGallery — shows a large primary image with clickable thumbnails below.
 * Clicking a thumbnail swaps the main image (standard e-commerce pattern).
 */

import { useState } from 'react';
import Image        from 'next/image';
import { cn }       from '@/lib/utils';
import { Pill }     from '@/components/icons';

interface ProductImage {
  id:         number;
  url:        string;
  is_primary: boolean;
}

interface Props {
  images:      ProductImage[];
  productName: string;
  /** Tailwind aspect ratio class for the main image slot — e.g. 'aspect-square' */
  aspectClass?: string;
}

export function ProductImageGallery({
  images,
  productName,
  aspectClass = 'aspect-square sm:aspect-[4/3]',
}: Props) {
  // Start with the primary image (or first)
  const sorted  = [...images].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
  const [active, setActive] = useState<ProductImage | null>(sorted[0] ?? null);

  return (
    <div className="space-y-3">
      {/* ── Main image ── */}
      <div className="overflow-hidden rounded-2xl border border-line-subtle bg-white shadow-[0_8px_30px_rgba(15,23,42,0.07)]">
        <div className={cn('relative', aspectClass)}>
          {active ? (
            <Image
              key={active.url}
              src={active.url}
              alt={productName}
              fill
              className="object-contain p-8 transition-opacity duration-200"
              sizes="(max-width: 1024px) 100vw, 640px"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-4">
              <Pill size={60} />
            </div>
          )}
        </div>
      </div>

      {/* ── Thumbnail strip — only shown when there are 2+ images ── */}
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(img)}
              className={cn(
                'relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all',
                active?.id === img.id
                  ? 'border-teal-500 shadow-[0_0_0_2px_rgba(20,184,166,0.25)]'
                  : 'border-line-subtle hover:border-teal-300',
              )}
            >
              <Image
                src={img.url}
                alt={productName}
                fill
                className="object-contain p-1"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
