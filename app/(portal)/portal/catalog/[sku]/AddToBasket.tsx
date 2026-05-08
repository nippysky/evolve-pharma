'use client';

import { useState } from 'react';
import { Plus, Minus, Basket, Check } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { useBasket } from '@/lib/hooks/useBasket';
import { useToast } from '@/contexts/ToastContext';
import type { Product } from '@/types';

export function AddToBasket({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const add = useBasket((s) => s.add);
  const has = useBasket((s) => s.hasItem);
  const toast = useToast();
  const inBasket = has(product.id);

  const onAdd = () => {
    add(product, qty);
    toast.show({
      tone: 'success',
      title: `${qty} × ${product.name} added`,
      description: 'Continue browsing or head to your basket.',
    });
  };

  return (
    <div className="mt-6 flex items-stretch gap-2">
      <div className="flex h-12 items-center rounded-md border border-line bg-white" role="group" aria-label="Quantity">
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          disabled={qty <= 1}
          aria-label="Decrease quantity"
          className="grid h-full w-10 place-items-center text-ink-2 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Minus size={14} />
        </button>
        <span className="num w-12 text-center font-medium" aria-live="polite">{qty}</span>
        <button
          type="button"
          onClick={() => setQty((q) => q + 1)}
          aria-label="Increase quantity"
          className="grid h-full w-10 place-items-center text-ink-2 hover:text-ink"
        >
          <Plus size={14} />
        </button>
      </div>
      <Button
        size="lg"
        fullWidth
        onClick={onAdd}
        leadingIcon={inBasket ? <Check size={16} /> : <Basket size={16} />}
      >
        {inBasket ? 'Add another to basket' : 'Add to basket'}
      </Button>
    </div>
  );
}
