'use client';

import { useState } from 'react';
import { Plus, Minus, ShoppingCart, Check } from '@/components/icons';
import { useBasket } from '@/lib/hooks/useBasket';
import { useToast } from '@/contexts/ToastContext';
import type { ProductDTO } from '@/lib/api/types';
import { cn } from '@/lib/utils';

export function AddToBasket({ product }: { product: ProductDTO }) {
  const [qty, setQty] = useState(1);
  const add = useBasket((s) => s.add);
  const has = useBasket((s) => s.hasItem);
  const getQty = useBasket((s) => s.getQuantity);
  const toast = useToast();
  const inBasket = has(product.id);
  const basketQty = getQty(product.id);

  const onAdd = () => {
    add(product, qty);
    toast.show({
      tone: 'success',
      title: `${qty} × ${product.brand_name} added`,
      description: inBasket
        ? `${basketQty + qty} total in basket`
        : 'Continue browsing or head to your basket.',
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {inBasket && (
        <div className="flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5">
          <Check size={13} className="text-teal-500" />
          <span className="text-xs font-medium text-teal-700">
            {basketQty} pack{basketQty !== 1 ? 's' : ''} already in basket
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Quantity stepper */}
        <div
          className="flex h-12 items-center overflow-hidden rounded-full border border-line bg-white"
          role="group"
          aria-label="Quantity"
        >
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label="Decrease quantity"
            className="grid h-full w-11 place-items-center text-ink-2 transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Minus size={14} />
          </button>
          <span
            className="num w-12 text-center text-base font-semibold text-ink"
            aria-live="polite"
          >
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(999, q + 1))}
            aria-label="Increase quantity"
            className="grid h-full w-11 place-items-center text-ink-2 transition-colors hover:text-ink"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Add button */}
        <button
          type="button"
          onClick={onAdd}
          className={cn(
            'flex h-12 flex-1 items-center justify-center gap-2 rounded-full font-medium transition-all duration-200',
            inBasket
              ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-md'
              : 'bg-[#042a36] text-white hover:opacity-90 shadow-md',
          )}
        >
          <ShoppingCart size={16} />
          {inBasket ? `Add ${qty} more` : `Add ${qty} to basket`}
        </button>
      </div>
    </div>
  );
}
