/**
 * ENVOLVE PHARMACEUTICALS — Basket Store
 *
 * Why "basket"? In a pharmacy context, "cart" feels retail; "basket"
 * reads as professional procurement. The model also supports renaming
 * to "Order Sheet" later — that's a label change, not a refactor.
 *
 * Implementation: zustand + localStorage (persist) so that an order in
 * progress survives a tab refresh. Server actions on /portal/checkout
 * will read this through props from the page (basket is hydrated
 * client-side).
 */

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BasketItem } from '@/types';
import type { ProductDTO } from '@/lib/api/types';

interface BasketState {
  items: BasketItem[];
  // ----- selectors -----
  itemCount: () => number;
  subtotal: () => number;
  hasItem: (productId: number) => boolean;
  getQuantity: (productId: number) => number;
  // ----- mutations -----
  add: (product: ProductDTO, quantity?: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  increment: (productId: number) => void;
  decrement: (productId: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

export const useBasket = create<BasketState>()(
  persist(
    (set, get) => ({
      items: [],

      itemCount: () => get().items.reduce((acc, i) => acc + i.quantity, 0),
      subtotal: () => get().items.reduce((acc, i) => acc + i.price * i.quantity, 0),
      hasItem: (productId) => get().items.some((i) => i.product_id === productId),
      getQuantity: (productId) =>
        get().items.find((i) => i.product_id === productId)?.quantity ?? 0,

      add: (product, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.product_id === product.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product_id === product.id ? { ...i, quantity: i.quantity + quantity } : i,
              ),
            };
          }
          const item: BasketItem = {
            product_id: product.id,
            sku: product.sku,
            name: product.brand_name,
            price: parseFloat(product.selling_price),
            image: product.images[0]?.url ?? '',
            quantity,
            pack_size: product.pack_size ?? '',
          };
          return { items: [...state.items, item] };
        }),

      setQuantity: (productId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.product_id !== productId)
              : state.items.map((i) =>
                  i.product_id === productId ? { ...i, quantity } : i,
                ),
        })),

      increment: (productId) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.product_id === productId ? { ...i, quantity: i.quantity + 1 } : i,
          ),
        })),

      decrement: (productId) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.product_id === productId ? { ...i, quantity: i.quantity - 1 } : i,
            )
            .filter((i) => i.quantity > 0),
        })),

      remove: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.product_id !== productId) })),

      clear: () => set({ items: [] }),
    }),
    {
      name: 'envolve_basket_v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
