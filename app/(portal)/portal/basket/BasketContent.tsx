'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ButtonLink, Button } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Primitives';
import { PageHead } from '@/components/shared/PageHead';
import { Plus, Minus, Trash, Basket as BasketIcon, ArrowRight, Shield, AlertTriangle } from '@/components/icons';
import { useBasket } from '@/lib/hooks/useBasket';
import { useToast } from '@/contexts/ToastContext';
import { formatNaira } from '@/lib/utils';

const FREE_SHIP_THRESHOLD = 50_000;
const SHIP_FEE            = 2_500;

interface Props {
  vatEnabled: boolean;
  vatRate:    number;
}

export default function BasketContent({ vatEnabled, vatRate }: Props) {
  const router    = useRouter();
  const items     = useBasket((s) => s.items);
  const increment = useBasket((s) => s.increment);
  const decrement = useBasket((s) => s.decrement);
  const remove    = useBasket((s) => s.remove);
  const clear     = useBasket((s) => s.clear);
  const toast     = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <>
        <PageHead title="Basket" />
        <Skeleton height={400} />
      </>
    );
  }

  const subtotal     = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const shipping     = subtotal >= FREE_SHIP_THRESHOLD || subtotal === 0 ? 0 : SHIP_FEE;
  const vat          = vatEnabled ? Math.round(subtotal * vatRate) : 0;
  const total        = subtotal + shipping + vat;
  const vatPct       = Math.round(vatRate * 100);

  const underMinItems = items.filter(i => i.quantity < Math.max(1, i.minimum_order ?? 1));
  const canCheckout   = underMinItems.length === 0 && items.length > 0;

  return (
    <>
      <PageHead
        title="Basket"
        subtitle={
          items.length === 0
            ? 'Your basket is empty.'
            : `${items.length} ${items.length === 1 ? 'product' : 'products'} ready for checkout.`
        }
        actions={
          items.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Trash size={14} />}
              onClick={() => {
                clear();
                toast.show({ tone: 'info', title: 'Basket cleared' });
              }}
            >
              Clear all
            </Button>
          ) : null
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<BasketIcon size={28} />}
          title="Your basket is empty"
          description="Browse the catalog and add the products you need."
          action={<ButtonLink href="/portal/catalog">Browse catalog</ButtonLink>}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            {items.map((item) => (
              <div
                key={item.product_id}
                className="grid grid-cols-[64px_1fr_auto] gap-3 border-b border-line-subtle p-4 last:border-b-0 sm:grid-cols-[80px_1fr_auto_auto_auto] sm:gap-4 sm:p-5"
              >
                <div className="h-16 w-16 overflow-hidden rounded-md bg-bg-muted sm:h-20 sm:w-20">
                  <Image src={item.image} alt={item.name} width={160} height={160} className="h-full w-full object-cover" />
                </div>

                <div className="col-start-2 row-start-1 min-w-0">
                  <Link
                    href={`/portal/catalog/${item.sku}`}
                    className="text-base font-medium tracking-tight text-ink hover:text-brand-600"
                  >
                    {item.name}
                  </Link>
                  <div className="mt-1 text-xs text-ink-3">
                    {item.pack_size} · {formatNaira(item.price)} each
                  </div>
                </div>

                <div className="col-start-2 row-start-2 flex flex-col gap-1 self-start sm:col-start-3 sm:row-start-1 sm:self-center">
                  <div className="inline-flex h-9 items-center rounded-md border border-line bg-white">
                    <button
                      type="button"
                      onClick={() => decrement(item.product_id)}
                      disabled={item.quantity <= Math.max(1, item.minimum_order ?? 1)}
                      aria-label="Decrease"
                      className="grid h-full w-8 place-items-center text-ink-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="num w-9 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => increment(item.product_id)}
                      aria-label="Increase"
                      className="grid h-full w-8 place-items-center text-ink-2 hover:text-ink"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  {(item.minimum_order ?? 1) > 1 && (
                    <p className="text-[10px] font-medium text-amber-600">
                      Min. {item.minimum_order} packs
                    </p>
                  )}
                </div>

                <div className="num col-start-3 row-start-2 self-start text-right font-display text-base sm:col-start-4 sm:row-start-1 sm:self-center">
                  {formatNaira(item.price * item.quantity)}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    remove(item.product_id);
                    toast.show({ tone: 'info', title: 'Removed', description: item.name });
                  }}
                  aria-label={`Remove ${item.name}`}
                  className="col-start-3 row-start-1 grid h-8 w-8 place-self-end self-start place-items-center rounded text-ink-3 hover:bg-danger-soft hover:text-danger sm:col-start-5 sm:self-center"
                >
                  <Trash size={14} />
                </button>
              </div>
            ))}
          </div>

          <aside className="sticky top-20 self-start rounded-xl border border-line bg-white p-6">
            <h2 className="text-base font-medium tracking-tight text-ink">Order summary</h2>
            <div className="mt-4 space-y-2.5">
              <div className="flex justify-between text-sm text-ink-2">
                <span>Subtotal</span>
                <span className="num">{formatNaira(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-ink-2">
                <span>Shipping</span>
                <span className="num">{shipping === 0 ? 'Free' : formatNaira(shipping)}</span>
              </div>
              {vatEnabled && (
                <div className="flex justify-between text-sm text-ink-2">
                  <span>VAT ({vatPct}%)</span>
                  <span className="num">{formatNaira(vat)}</span>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
              <span className="text-sm font-medium text-ink">Total</span>
              <span className="num font-display text-2xl tracking-tight text-ink">{formatNaira(total)}</span>
            </div>
            {underMinItems.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Minimum order not met</p>
                    <ul className="mt-1 space-y-0.5">
                      {underMinItems.map(i => (
                        <li key={i.product_id} className="text-[11px] text-amber-700">
                          {i.name}: need at least <span className="font-semibold">{i.minimum_order} packs</span> (you have {i.quantity})
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            <Button
              size="lg"
              fullWidth
              className="mt-4"
              disabled={!canCheckout}
              trailingIcon={<ArrowRight size={16} />}
              onClick={() => router.push('/portal/checkout')}
            >
              Proceed to checkout
            </Button>
            <p className="mt-3 text-xs leading-relaxed text-ink-3">
              <Shield size={12} className="-mt-0.5 mr-1 inline" />
              Secure checkout via Paystack.{vatEnabled ? ' VAT shown is informational; a final tax invoice is issued on dispatch.' : ''}
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
