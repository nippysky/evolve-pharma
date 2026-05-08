'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Button, ButtonLink } from '@/components/ui/Button';
import { PageHead } from '@/components/shared/PageHead';
import {
  CreditCard,
  Building,
  Truck,
  AlertTriangle,
  CheckCircle,
  Lock,
} from '@/components/icons';
import { useBasket } from '@/lib/hooks/useBasket';
import { useToast } from '@/contexts/ToastContext';
import { checkoutAction } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';
import { formatNaira } from '@/lib/utils';
import { cn } from '@/lib/utils';

const VAT_RATE = 0.075;
const FREE_SHIP_THRESHOLD = 50_000;
const SHIP_FEE = 2_500;

const PAY_METHODS = [
  { value: 'paystack', label: 'Paystack', sub: 'Card · Bank · USSD', Icon: CreditCard },
  { value: 'bank_transfer', label: 'Bank transfer', sub: 'Direct deposit', Icon: Building },
  { value: 'cash_on_delivery', label: 'Pay on delivery', sub: 'Verified accounts only', Icon: Truck },
] as const;

type PayValue = (typeof PAY_METHODS)[number]['value'];
const initial: ActionResult = { ok: false, message: '' };

export default function CheckoutPage() {
  const items = useBasket((s) => s.items);
  const clear = useBasket((s) => s.clear);
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const [pay, setPay] = useState<PayValue>('paystack');
  const [confirmedOrder, setConfirmedOrder] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    fd.set('payment_method', pay);
    const r = await checkoutAction(prev, fd);
    if (r.ok) {
      const orderNumber = (r.data as { order_number: string }).order_number;
      setConfirmedOrder(orderNumber);
      clear();
      toast.show({ tone: 'success', title: 'Order placed', description: `Reference ${orderNumber}` });
    } else {
      toast.show({ tone: 'error', title: 'Checkout failed', description: r.message });
    }
    return r;
  }, initial);

  const fieldErrors = !state.ok ? state.fieldErrors : undefined;
  const error = !state.ok && !fieldErrors ? state.message : '';

  if (confirmedOrder) {
    return (
      <div className="rounded-3xl border border-line bg-white py-16 text-center">
        <span className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-leaf-100 text-leaf-700">
          <CheckCircle size={32} />
        </span>
        <h1 className="display-serif text-[clamp(1.875rem,4vw,2.5rem)] tracking-tight text-ink">
          Order placed.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-2">
          Thanks for your order. Our team will dispatch your shipment shortly. You&apos;ll get a
          notification at every step.
        </p>
        <div className="mt-6 inline-block rounded-md border border-line bg-bg-subtle px-3.5 py-2 font-mono text-sm tracking-wide text-ink">
          {confirmedOrder}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/portal/orders">View orders</ButtonLink>
          <ButtonLink href="/portal/catalog" variant="secondary">Continue shopping</ButtonLink>
        </div>
      </div>
    );
  }

  if (mounted && items.length === 0) {
    return (
      <div className="rounded-3xl border border-line bg-white py-16 text-center">
        <h1 className="display-serif text-2xl tracking-tight text-ink">Your basket is empty</h1>
        <p className="mt-2 text-sm text-ink-2">Add a few products before you checkout.</p>
        <div className="mt-6">
          <ButtonLink href="/portal/catalog">Go to catalog</ButtonLink>
        </div>
      </div>
    );
  }

  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const shipping = subtotal >= FREE_SHIP_THRESHOLD || subtotal === 0 ? 0 : SHIP_FEE;
  const vat = Math.round(subtotal * VAT_RATE);
  const total = subtotal + shipping + vat;

  return (
    <>
      <PageHead title="Checkout" subtitle="Confirm your delivery and payment details to place the order." />

      <form action={action} className="grid gap-6 lg:grid-cols-[1fr_380px]" noValidate>
        <div>
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-danger-soft px-3.5 py-3 text-sm text-red-800">
              <AlertTriangle size={14} className="mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <section className="rounded-xl border border-line bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-medium tracking-tight text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                1
              </span>
              Delivery
            </h2>
            <Field label="Delivery address" htmlFor="delivery_address" required error={fieldErrors?.delivery_address?.[0]}>
              <Input
                id="delivery_address"
                name="delivery_address"
                defaultValue="Greenleaf Pharmacy Ltd., 12 Lagos St., Wuse 2, Abuja"
                placeholder="Pharmacy name, street, city"
                required
              />
            </Field>
            <Field label="Contact phone" htmlFor="contact_phone" required error={fieldErrors?.contact_phone?.[0]}>
              <Input id="contact_phone" name="contact_phone" type="tel" defaultValue="+234 803 456 7890" required />
            </Field>
            <Field
              label="Delivery notes"
              htmlFor="delivery_notes"
              hint="Gate code, preferred drop-off window, etc."
            >
              <Textarea id="delivery_notes" name="delivery_notes" rows={2} placeholder="Optional" />
            </Field>
          </section>

          <section className="mt-4 rounded-xl border border-line bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-medium tracking-tight text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                2
              </span>
              Payment
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {PAY_METHODS.map(({ value, label, sub, Icon }) => {
                const active = pay === value;
                return (
                  <label
                    key={value}
                    className={cn(
                      'relative flex cursor-pointer items-start gap-2.5 rounded-md border bg-white p-4 transition-colors',
                      active
                        ? 'border-brand-500 bg-brand-50 shadow-glow'
                        : 'border-line hover:border-line-strong',
                    )}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value={value}
                      checked={active}
                      onChange={() => setPay(value)}
                      className="absolute opacity-0"
                    />
                    <span className={cn(
                      'grid h-9 w-9 place-items-center rounded-md',
                      active ? 'bg-brand-100 text-brand-700' : 'bg-bg-muted text-ink-2',
                    )}>
                      <Icon size={18} />
                    </span>
                    <span>
                      <strong className="block text-sm font-medium text-ink">{label}</strong>
                      <span className="mt-0.5 block text-xs text-ink-3">{sub}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-line bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-medium tracking-tight text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                3
              </span>
              Reference
            </h2>
            <Field label="Purchase order #" htmlFor="po_number" hint="Optional. Appears on your invoice.">
              <Input id="po_number" name="po_number" placeholder="e.g. PO-1042" />
            </Field>
          </section>
        </div>

        <aside className="sticky top-20 self-start rounded-xl border border-line bg-white p-6">
          <h2 className="text-base font-medium tracking-tight text-ink">Order summary</h2>
          {mounted && (
            <ul className="mt-4 flex flex-col gap-2.5">
              {items.map((i) => (
                <li key={i.product_id} className="flex justify-between gap-3 text-sm text-ink-2">
                  <span className="min-w-0 flex-1 truncate">{i.name}</span>
                  <span className="num text-ink-3">×{i.quantity}</span>
                  <span className="num text-ink">{formatNaira(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 space-y-2 border-t border-line pt-4">
            <div className="flex justify-between text-sm text-ink-2">
              <span>Subtotal</span>
              <span className="num">{formatNaira(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-ink-2">
              <span>Shipping</span>
              <span className="num">{shipping === 0 ? 'Free' : formatNaira(shipping)}</span>
            </div>
            <div className="flex justify-between text-sm text-ink-2">
              <span>VAT (7.5%)</span>
              <span className="num">{formatNaira(vat)}</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-sm font-medium text-ink">Total</span>
            <span className="num font-display text-2xl tracking-tight text-ink">{formatNaira(total)}</span>
          </div>
          <Button type="submit" size="lg" fullWidth loading={pending} leadingIcon={<Lock size={14} />} className="mt-4">
            Place order
          </Button>
          <p className="mt-3 text-xs text-ink-3">
            Need help?{' '}
            <Link href="/contact" className="text-brand-600 hover:underline">
              Contact us
            </Link>
            .
          </p>
        </aside>
      </form>
    </>
  );
}
