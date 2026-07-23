'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { Field, Input, Textarea, Select } from '@/components/ui/Field';
import { Button, ButtonLink } from '@/components/ui/Button';
import { PageHead } from '@/components/shared/PageHead';
import {
  CreditCard,
  Building,
  Truck,
  AlertTriangle,
  CheckCircle,
  Lock,
  MapPin,
  Phone,
  ArrowLeft,
} from '@/components/icons';
import { useBasket } from '@/lib/hooks/useBasket';
import { useToast } from '@/contexts/ToastContext';
import { checkoutAction } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';
import { formatNaira, cn } from '@/lib/utils';
import { NIGERIAN_STATES } from '@/lib/constants';

const VAT_RATE = 0.075;
const FREE_SHIP_THRESHOLD = 50_000;
const SHIP_FEE = 2_500;

const PAY_METHODS = [
  { value: 'paystack',         label: 'Paystack',        sub: 'Card · Bank · USSD',     Icon: CreditCard },
  { value: 'bank_transfer',    label: 'Bank transfer',   sub: 'Direct deposit',          Icon: Building },
  { value: 'cash_on_delivery', label: 'Pay on delivery', sub: 'Verified accounts only',  Icon: Truck },
] as const;

type PayValue = (typeof PAY_METHODS)[number]['value'];
const initial: ActionResult = { ok: false, message: '' };

export default function CheckoutPage() {
  const items   = useBasket((s) => s.items);
  const clear   = useBasket((s) => s.clear);
  const toast   = useToast();
  const [mounted,        setMounted]        = useState(false);
  const [pay,            setPay]            = useState<PayValue>('paystack');
  const [confirmedOrder, setConfirmedOrder] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const [state, action, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    fd.set('payment_method', pay);
    const r = await checkoutAction(prev, fd);
    if (r.ok) {
      const orderNumber = (r.data as { order_number: string }).order_number;
      setConfirmedOrder(orderNumber);
      clear();
      toast.show({ tone: 'success', title: 'Order placed!', description: `Ref: ${orderNumber}` });
    } else {
      toast.show({ tone: 'error', title: 'Checkout failed', description: r.message });
    }
    return r;
  }, initial);

  const fieldErrors = !state.ok ? state.fieldErrors : undefined;
  const error       = !state.ok && !fieldErrors ? state.message : '';

  /* ── Order confirmed ──────────────────────────────────────────────────── */
  if (confirmedOrder) {
    return (
      <div className="rounded-3xl border border-line bg-white py-20 text-center">
        <span className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-teal-100 text-teal-600">
          <CheckCircle size={32} />
        </span>
        <h1 className="display-serif text-[clamp(1.875rem,4vw,2.5rem)] tracking-tight text-ink">
          Order placed!
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-2">
          Thank you for your order. Our team will process and dispatch your shipment shortly.
          You&apos;ll receive updates at every step.
        </p>
        <div className="mt-6 inline-block rounded-md border border-line bg-bg-subtle px-4 py-2 font-mono text-sm tracking-wide text-ink">
          {confirmedOrder}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/portal/orders">View my orders</ButtonLink>
          <ButtonLink href="/portal/catalog" variant="secondary">Continue shopping</ButtonLink>
        </div>
      </div>
    );
  }

  /* ── Empty basket guard ──────────────────────────────────────────────── */
  if (mounted && items.length === 0) {
    return (
      <div className="rounded-3xl border border-line bg-white py-20 text-center">
        <h1 className="display-serif text-2xl tracking-tight text-ink">Your basket is empty</h1>
        <p className="mt-2 text-sm text-ink-2">Add a few products before you checkout.</p>
        <div className="mt-6">
          <ButtonLink href="/portal/catalog">Go to catalogue</ButtonLink>
        </div>
      </div>
    );
  }

  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const shipping = subtotal >= FREE_SHIP_THRESHOLD || subtotal === 0 ? 0 : SHIP_FEE;
  const vat      = Math.round(subtotal * VAT_RATE);
  const total    = subtotal + shipping + vat;

  return (
    <>
      <div className="mb-6">
        <Link
          href="/portal/basket"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-teal-700 transition-colors"
        >
          <ArrowLeft size={15} />
          Back to basket
        </Link>
      </div>

      <PageHead
        title="Checkout"
        subtitle="Confirm your delivery address and payment details to place your order."
      />

      <form action={action} className="grid gap-6 lg:grid-cols-[1fr_380px]" noValidate>
        {/* ── Left column ── */}
        <div className="flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1 – Delivery */}
          <section className="rounded-xl border border-line bg-white p-6">
            <h2 className="mb-5 flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#042a36] text-[11px] font-bold text-white">1</span>
              <MapPin size={15} className="text-teal-600" />
              Delivery address
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="State" htmlFor="state" required error={fieldErrors?.state?.[0]}>
                <Select id="state" name="state" defaultValue="">
                  <option value="" disabled>Select a state</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </Field>

              <Field label="City / LGA" htmlFor="city" required error={fieldErrors?.city?.[0]}>
                <Input
                  id="city"
                  name="city"
                  placeholder="e.g. Wuse 2, Victoria Island"
                  required
                />
              </Field>
            </div>

            <Field label="Street address" htmlFor="street_address" required error={fieldErrors?.street_address?.[0]}>
              <Textarea
                id="street_address"
                name="street_address"
                rows={2}
                placeholder="House number, street name, nearest landmark"
                required
              />
            </Field>

            <Field label="Contact phone" htmlFor="contact_phone" required error={fieldErrors?.contact_phone?.[0]}>
              <div className="relative">
                <Phone size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <Input
                  id="contact_phone"
                  name="contact_phone"
                  type="tel"
                  className="pl-9"
                  placeholder="e.g. 08012345678"
                  required
                />
              </div>
            </Field>

            <Field
              label="Delivery notes"
              htmlFor="delivery_notes"
              hint="Gate code, preferred delivery window, etc."
            >
              <Textarea id="delivery_notes" name="delivery_notes" rows={2} placeholder="Optional" />
            </Field>
          </section>

          {/* Step 2 – Payment */}
          <section className="rounded-xl border border-line bg-white p-6">
            <h2 className="mb-5 flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#042a36] text-[11px] font-bold text-white">2</span>
              <CreditCard size={15} className="text-teal-600" />
              Payment method
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {PAY_METHODS.map(({ value, label, sub, Icon }) => {
                const active = pay === value;
                return (
                  <label
                    key={value}
                    className={cn(
                      'relative flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition-all duration-150',
                      active
                        ? 'border-teal-400 bg-teal-50 shadow-[0_0_0_3px_rgba(45,212,191,0.12)]'
                        : 'border-line hover:border-teal-200',
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
                      'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                      active ? 'bg-teal-100 text-teal-700' : 'bg-bg-muted text-ink-2',
                    )}>
                      <Icon size={18} />
                    </span>
                    <span>
                      <strong className="block text-sm font-semibold text-ink">{label}</strong>
                      <span className="mt-0.5 block text-xs text-ink-3">{sub}</span>
                    </span>
                    {active && (
                      <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-teal-400" />
                    )}
                  </label>
                );
              })}
            </div>
          </section>

          {/* Step 3 – Reference */}
          <section className="rounded-xl border border-line bg-white p-6">
            <h2 className="mb-5 flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#042a36] text-[11px] font-bold text-white">3</span>
              Purchase reference
            </h2>
            <Field label="Purchase order #" htmlFor="po_number" hint="Optional. Appears on your invoice and delivery note.">
              <Input id="po_number" name="po_number" placeholder="e.g. PO-1042" />
            </Field>
          </section>
        </div>

        {/* ── Order summary sidebar ── */}
        <aside className="sticky top-20 self-start rounded-xl border border-line bg-white p-6">
          <h2 className="mb-4 text-base font-semibold tracking-tight text-ink">Order summary</h2>

          {mounted && (
            <ul className="flex flex-col gap-2.5">
              {items.map((i) => (
                <li key={i.product_id} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate text-ink-2">{i.name}</span>
                  <span className="num shrink-0 text-ink-3">×{i.quantity}</span>
                  <span className="num shrink-0 font-medium text-ink">{formatNaira(i.price * i.quantity)}</span>
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
              <span className="num">
                {shipping === 0
                  ? <span className="font-medium text-teal-600">Free</span>
                  : formatNaira(shipping)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-ink-2">
              <span>VAT (7.5%)</span>
              <span className="num">{formatNaira(vat)}</span>
            </div>
          </div>

          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-sm font-semibold text-ink">Total</span>
            <span className="num font-display text-2xl font-semibold tracking-tight text-ink">
              {formatNaira(total)}
            </span>
          </div>

          {shipping > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
              Add {formatNaira(FREE_SHIP_THRESHOLD - subtotal)} more for free shipping.
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={pending}
            leadingIcon={<Lock size={14} />}
            className="mt-4 bg-[#042a36] hover:bg-teal-900"
          >
            Place order
          </Button>

          <p className="mt-3 text-center text-xs text-ink-3">
            By placing this order you agree to our{' '}
            <Link href="/terms" className="text-teal-600 hover:underline">terms of service</Link>.
          </p>
        </aside>
      </form>
    </>
  );
}
