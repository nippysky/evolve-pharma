'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Field, Input, Textarea, Select } from '@/components/ui/Field';
import { Button, ButtonLink } from '@/components/ui/Button';
import { PageHead } from '@/components/shared/PageHead';
import {
  CreditCard, Building, Truck, AlertTriangle,
  Lock, MapPin, Phone, ArrowLeft, Check, X,
  Spinner, Box,
} from '@/components/icons';
// Box is used in EmptyBasket and order summary list items
import { useBasket } from '@/lib/hooks/useBasket';
import { useToast } from '@/contexts/ToastContext';
import { checkoutAction } from '@/lib/actions';
import { formatNaira, cn } from '@/lib/utils';
import { NIGERIAN_STATES } from '@/lib/constants';
declare global {
  interface Window {
    PaystackPop?: {
      setup(cfg: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        metadata?: Record<string, unknown>;
        callback(r: { reference: string; status: string; trans: string }): void;
        onClose(): void;
      }): { openIframe(): void };
    };
  }
}
interface ConfettiStyle extends React.CSSProperties {
  '--tx': string;
  '--ty': string;
  '--rot': string;
}
const PAYSTACK_KEY        = process.env.NEXT_PUBLIC_PAYSTACK_KEY ?? '';
const VAT_RATE            = 0.075;
const FREE_SHIP_THRESHOLD = 50_000;
const SHIP_FEE            = 2_500;

const PAY_METHODS = [
  {
    value:       'paystack' as const,
    label:       'Paystack',
    sub:         'Card · Bank · USSD',
    Icon:        CreditCard,
    recommended: true,
  },
  {
    value:       'bank_transfer' as const,
    label:       'Bank transfer',
    sub:         'Direct deposit',
    Icon:        Building,
    recommended: false,
  },
  {
    value:       'cash_on_delivery' as const,
    label:       'Pay on delivery',
    sub:         'Verified accounts only',
    Icon:        Truck,
    recommended: false,
  },
] as const;

type PayValue = (typeof PAY_METHODS)[number]['value'];
type FormFields = {
  state:          string;
  city:           string;
  street_address: string;
  contact_phone:  string;
  delivery_notes: string;
};

type FieldErrors = Partial<Record<keyof FormFields, string>>;

const PHONE_RE = /^(\+?234|0)[789]\d{9}$/;

function validateAll(f: FormFields): FieldErrors {
  const e: FieldErrors = {};
  if (!f.state)
    e.state = 'Please select your state';
  if (!f.city.trim())
    e.city = 'City / LGA is required';
  else if (f.city.trim().length < 2)
    e.city = 'Enter a valid city name';
  if (!f.street_address.trim())
    e.street_address = 'Street address is required';
  else if (f.street_address.trim().length < 8)
    e.street_address = 'Enter a more complete address (house no, street, landmark)';
  const phone = f.contact_phone.replace(/[\s-]/g, '');
  if (!phone)
    e.contact_phone = 'Contact phone is required';
  else if (!PHONE_RE.test(phone))
    e.contact_phone = 'Enter a valid Nigerian number — e.g. 08012345678 or +2348012345678';
  return e;
}

function validateOne(field: keyof FormFields, value: string, rest: FormFields): string | null {
  return validateAll({ ...rest, [field]: value })[field] ?? null;
}

function buildFd(
  form: FormFields,
  pay: PayValue,
  items: { product_id: number; quantity: number }[],
  paystackRef?: string,
): FormData {
  const fd = new FormData();
  (Object.entries(form) as [string, string][]).forEach(([k, v]) => fd.set(k, v));
  fd.set('payment_method', pay);
  fd.set('items', JSON.stringify(items));
  if (paystackRef) fd.set('paystack_reference', paystackRef);
  return fd;
}
const KEYFRAMES = `
  @keyframes confetti-fly {
    0%   { transform: translate(0,0) rotate(0deg) scale(1); opacity: 1; }
    80%  { opacity: 0.8; }
    100% { transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(0.4); opacity: 0; }
  }
  @keyframes circle-draw {
    from { stroke-dashoffset: 138.2; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes check-draw {
    to { stroke-dashoffset: 0; }
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scale-in {
    from { opacity: 0; transform: scale(0.55); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes ring-ping {
    0%   { transform: scale(1);   opacity: 0.6; }
    100% { transform: scale(2.4); opacity: 0; }
  }
`;
const CONFETTI_DOTS = [
  { color: '#2dd4bf', x: -90,  y: -130, r:  35, delay: 0.00, shape: 'rounded-sm' },
  { color: '#f59e0b', x:  70,  y: -150, r: -45, delay: 0.06, shape: 'rounded-full' },
  { color: '#ec4899', x: 140,  y:  -65, r:  20, delay: 0.10, shape: 'rounded-sm' },
  { color: '#6366f1', x: 100,  y:   90, r: -30, delay: 0.14, shape: 'rounded-full' },
  { color: '#10b981', x:  -55, y:  120, r:  50, delay: 0.08, shape: 'rounded-sm' },
  { color: '#f97316', x: -150, y:   45, r: -60, delay: 0.04, shape: 'rounded-full' },
  { color: '#3b82f6', x: -120, y:  -90, r:  25, delay: 0.12, shape: 'rounded-sm' },
  { color: '#a855f7', x:  160, y:   25, r: -20, delay: 0.16, shape: 'rounded-full' },
  { color: '#eab308', x:   30, y:  160, r:  70, delay: 0.05, shape: 'rounded-sm' },
  { color: '#14b8a6', x:  -30, y: -170, r: -40, delay: 0.18, shape: 'rounded-full' },
  { color: '#ef4444', x:  180, y:  -35, r:  15, delay: 0.09, shape: 'rounded-sm' },
  { color: '#8b5cf6', x: -180, y:  -10, r: -55, delay: 0.15, shape: 'rounded-full' },
];

function ConfettiBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
      {CONFETTI_DOTS.map((c, i) => (
        <div
          key={i}
          className={cn('absolute h-3 w-3', c.shape)}
          style={{
            background: c.color,
            animation: `confetti-fly 0.9s cubic-bezier(0.36,0.07,0.19,0.97) ${c.delay}s both`,
            '--tx': `${c.x}px`,
            '--ty': `${c.y}px`,
            '--rot': `${c.r}deg`,
          } as ConfettiStyle}
        />
      ))}
    </div>
  );
}

function AnimatedCheck() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden>
      <circle
        cx="26" cy="26" r="23"
        stroke="white" strokeWidth="2.5" fill="none"
        strokeDasharray="144.5" strokeDashoffset="144.5"
        style={{ animation: 'circle-draw 0.55s ease-out 0.15s both' }}
      />
      <path
        d="M15 26.5L23 34.5L37 18"
        stroke="white" strokeWidth="3.5"
        strokeLinecap="round" strokeLinejoin="round" fill="none"
        strokeDasharray="35" strokeDashoffset="35"
        style={{ animation: 'check-draw 0.4s ease-out 0.6s forwards' }}
      />
    </svg>
  );
}
function SuccessScreen({ orderNumber, payMethod }: { orderNumber: string; payMethod: PayValue }) {
  const isPaid = payMethod === 'paystack';
  const steps = [
    { emoji: '🧾', label: 'Confirmed',  desc: 'Order logged and assigned a reference number' },
    { emoji: '📦', label: 'Processing', desc: 'Warehouse picks and packs your items' },
    { emoji: '🚚', label: 'Dispatched', desc: 'Driver assigned — order is on its way' },
    { emoji: '✅', label: 'Delivered',  desc: 'Items arrive at your pharmacy' },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-teal-100 bg-gradient-to-b from-teal-50/80 via-white to-white px-6 py-16 text-center shadow-[0_20px_80px_rgba(45,212,191,0.12)]">
      <style>{KEYFRAMES}</style>
      <ConfettiBurst />

      <div
        className="relative mx-auto mb-8 w-fit"
        style={{ animation: 'scale-in 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.1s both' }}
      >
        <div className="absolute inset-0 rounded-full bg-teal-400" style={{ animation: 'ring-ping 1s ease-out 0.65s both' }} />
        <div className="absolute inset-0 rounded-full bg-teal-300" style={{ animation: 'ring-ping 1s ease-out 0.82s both' }} />
        <div className="relative grid h-[6.5rem] w-[6.5rem] place-items-center rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 shadow-[0_24px_64px_rgba(45,212,191,0.45)]">
          <AnimatedCheck />
        </div>
      </div>

      <div style={{ animation: 'fade-up 0.5s ease-out 0.45s both' }}>
        <span className="inline-block rounded-full border border-teal-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-600 shadow-sm">
          {isPaid ? 'Payment confirmed' : 'Order received'}
        </span>
        <h1 className="display-serif mt-4 text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight text-ink">
          You&apos;re all set!
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-2">
          {isPaid
            ? 'Your payment was successful. Our team is now processing your order.'
            : 'Your order has been received and will be processed by our team shortly.'}
        </p>
      </div>

      <div
        className="mx-auto mt-7 w-fit rounded-2xl border border-line bg-white px-8 py-5 shadow-[0_8px_32px_rgba(15,23,42,0.07)]"
        style={{ animation: 'fade-up 0.5s ease-out 0.6s both' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">Order reference</p>
        <p
          className="num mt-1.5 font-mono text-2xl font-bold tracking-wider text-ink"
          style={{
            background: 'linear-gradient(135deg, #042a36, #0d9488)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {orderNumber}
        </p>
        <p className="mt-1.5 text-xs text-ink-3">Save this for your records</p>
      </div>

      <div className="mx-auto mt-10 max-w-xs text-left" style={{ animation: 'fade-up 0.5s ease-out 0.75s both' }}>
        <p className="mb-5 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">What happens next</p>
        <div className="relative flex flex-col gap-0">
          {steps.map(({ emoji, label, desc }, i) => (
            <div key={label} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-teal-200 bg-white text-base shadow-sm">{emoji}</span>
                {i < steps.length - 1 && <div className="my-1 w-px flex-1 bg-teal-100" style={{ minHeight: 24 }} />}
              </div>
              <div className="min-w-0 pb-5 pt-1.5">
                <p className="text-sm font-semibold text-ink">{label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3" style={{ animation: 'fade-up 0.5s ease-out 0.9s both' }}>
        <ButtonLink href="/portal/orders">View my orders</ButtonLink>
        <ButtonLink href="/portal/catalog" variant="secondary">Continue shopping</ButtonLink>
      </div>
    </div>
  );
}
function StepHeader({ n, label, optional, children }: {
  n: number; label: string; optional?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#042a36] text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(4,42,54,0.22)]">{n}</span>
      <span className="text-teal-600">{children}</span>
      <h2 className="text-base font-semibold tracking-tight text-ink">{label}</h2>
      {optional && <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-medium text-ink-3">Optional</span>}
    </div>
  );
}

function SummaryRow({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-sm text-ink-2">
      <span>{label}</span>
      <span className={cn('num', valueClass)}>{value}</span>
    </div>
  );
}

function ValidatedField({ label, htmlFor, required, error, hint, touched, valid, children }: {
  label: string; htmlFor: string; required?: boolean; error?: string;
  hint?: string; touched?: boolean; valid?: boolean; children: React.ReactNode;
}) {
  const hasError = touched && !!error;
  return (
    <div className="relative" {...(hasError ? { 'data-checkout-error': '' } : {})}>
      <Field label={label} htmlFor={htmlFor} required={required} error={touched ? error : undefined} hint={hint}>
        {children}
      </Field>
      {touched && valid && !error && (
        <span className="absolute right-3 top-[2.1rem] grid h-5 w-5 place-items-center rounded-full bg-teal-500 text-white shadow-sm">
          <Check size={11} />
        </span>
      )}
    </div>
  );
}

function EmptyBasket() {
  return (
    <div className="rounded-3xl border border-line bg-white py-24 text-center">
      <span className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-bg-muted text-ink-3"><Box size={32} /></span>
      <h1 className="display-serif text-2xl tracking-tight text-ink">Your basket is empty</h1>
      <p className="mt-2 text-sm text-ink-2">Add some products before you checkout.</p>
      <div className="mt-7"><ButtonLink href="/portal/catalog">Go to catalogue</ButtonLink></div>
    </div>
  );
}

interface Props {
  /** Real customer email from server session — used for Paystack popup */
  userEmail: string;
  /** Pre-filled delivery fields from customer profile */
  prefill?: Partial<Pick<FormFields, 'state' | 'city' | 'street_address' | 'contact_phone'>>;
}

export default function CheckoutClient({ userEmail, prefill }: Props) {
  const items     = useBasket((s) => s.items);
  const clear     = useBasket((s) => s.clear);
  const toast     = useToast();

  const [mounted,    setMounted]    = useState(false);
  const [pay,        setPay]        = useState<PayValue>('paystack');
  const [submitting, setSubmitting] = useState(false);
  const [psLoaded,   setPsLoaded]   = useState(false);
  const [pageError,  setPageError]  = useState('');
  const [cancelled,  setCancelled]  = useState(false);
  const [confirmed,  setConfirmed]  = useState<{ orderNumber: string; payMethod: PayValue } | null>(null);

  const [form, setForm] = useState<FormFields>({
    state:          prefill?.state          ?? '',
    city:           prefill?.city           ?? '',
    street_address: prefill?.street_address ?? '',
    contact_phone:  prefill?.contact_phone  ?? '',
    delivery_notes: '',
  });
  const [touched, setTouched] = useState<Partial<Record<keyof FormFields, boolean>>>({});
  const [errors,  setErrors]  = useState<FieldErrors>({});

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (document.querySelector('script[src*="paystack"]')) { setPsLoaded(true); return; }
    const s    = document.createElement('script');
    s.src      = 'https://js.paystack.co/v1/inline.js';
    s.async    = true;
    s.onload   = () => setPsLoaded(true);
    s.onerror  = () => console.warn('[Envolve] Paystack script failed to load');
    document.head.appendChild(s);
  }, []);

  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const shipping = subtotal >= FREE_SHIP_THRESHOLD || subtotal === 0 ? 0 : SHIP_FEE;
  const vat      = Math.round(subtotal * VAT_RATE);
  const total    = subtotal + shipping + vat;

  // Basket items formatted for the server action
  const basketPayload = items.map(i => ({ product_id: i.product_id, quantity: i.quantity }));

  const change = useCallback((field: keyof FormFields, value: string) => {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (touched[field]) setErrors((e) => ({ ...e, [field]: validateOne(field, value, next) ?? undefined }));
      return next;
    });
  }, [touched]);

  const blur = useCallback((field: keyof FormFields) => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: validateOne(field, form[field], form) ?? undefined }));
  }, [form]);

  const runValidation = useCallback((): boolean => {
    const errs = validateAll(form);
    setErrors(errs);
    setTouched({ state: true, city: true, street_address: true, contact_phone: true });
    return Object.keys(errs).length === 0;
  }, [form]);

  const handleSuccess = useCallback((orderNumber: string) => {
    setConfirmed({ orderNumber, payMethod: pay });
    clear();
    toast.show({ tone: 'success', title: 'Order placed!', description: `Ref: ${orderNumber}` });
  }, [pay, clear, toast]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPageError('');
    setCancelled(false);

    if (!runValidation()) {
      setTimeout(() => {
        document.querySelector('[data-checkout-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }

    if (pay === 'paystack') {
      if (!PAYSTACK_KEY || PAYSTACK_KEY === 'pk_test_REPLACE_WITH_YOUR_TEST_KEY') {
        setPageError('Paystack key is not configured. Add NEXT_PUBLIC_PAYSTACK_KEY to your .env.local and restart.');
        return;
      }
      if (!psLoaded || !window.PaystackPop) {
        setPageError('Paystack is still loading — please wait a moment and try again.');
        return;
      }
      const ref = `EVP-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      try {
        const handler = window.PaystackPop.setup({
          key:      PAYSTACK_KEY,
          email:    userEmail,           // ← real session email (not hardcoded)
          amount:   Math.round(total * 100), // kobo — must be integer
          currency: 'NGN',
          ref,
          metadata: {
            custom_fields: [
              { display_name: 'State',   variable_name: 'state',   value: form.state },
              { display_name: 'City',    variable_name: 'city',    value: form.city },
              { display_name: 'Address', variable_name: 'address', value: form.street_address },
            ],
          },
          callback: (response) => {
            void (async () => {
              setSubmitting(true);
              try {
                const result = await checkoutAction(null, buildFd(form, pay, basketPayload, response.reference));
                if (result.ok) {
                  handleSuccess((result.data as { order_number: string }).order_number);
                } else {
                  // Show the actual server error so we know exactly what failed
                  setPageError(
                    result.message
                      ? `${result.message} (Payment ref: ${response.reference})`
                      : `Order confirmation failed — your payment went through (ref: ${response.reference}). Please contact support.`,
                  );
                }
              } catch (err) {
                setPageError(
                  `Network error after payment. Ref: ${response.reference} — please contact support. (${err instanceof Error ? err.message : String(err)})`,
                );
              } finally {
                setSubmitting(false);
              }
            })();
          },
          onClose: () => { setCancelled(true); },
        });
        handler.openIframe();
      } catch (err) {
        setPageError(`Could not open payment: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      setSubmitting(true);
      try {
        const result = await checkoutAction(null, buildFd(form, pay, basketPayload));
        if (result.ok) {
          handleSuccess((result.data as { order_number: string }).order_number);
        } else {
          setPageError(result.message || 'Checkout failed. Please try again.');
        }
      } catch {
        setPageError('A network error occurred. Please try again.');
      } finally {
        setSubmitting(false);
      }
    }
  }, [pay, psLoaded, form, total, basketPayload, userEmail, runValidation, handleSuccess]);

  if (mounted && items.length === 0 && !confirmed) return <EmptyBasket />;
  if (confirmed) return (
    <>
      <style>{KEYFRAMES}</style>
      <SuccessScreen orderNumber={confirmed.orderNumber} payMethod={confirmed.payMethod} />
    </>
  );

  const isFieldValid = (field: keyof FormFields) => touched[field] && !errors[field] && form[field] !== '';

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div className="mb-6">
        <Link href="/portal/basket" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition-colors hover:text-teal-700">
          <ArrowLeft size={15} />
          Back to basket
        </Link>
      </div>

      <PageHead title="Checkout" subtitle="Complete your delivery details and payment to place your order." />

      <form onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_390px]">

        <div className="flex flex-col gap-4">

          {pageError && (
            <div data-checkout-error className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-800 shadow-sm">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-500" />
              <span className="flex-1 leading-relaxed">{pageError}</span>
              <button type="button" onClick={() => setPageError('')} className="shrink-0 rounded-lg p-0.5 text-red-400 hover:bg-red-100 hover:text-red-600"><X size={14} /></button>
            </div>
          )}

          {cancelled && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800 shadow-sm">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
              <span className="flex-1 leading-relaxed">Payment was cancelled. Your details are saved — try again whenever you&apos;re ready.</span>
              <button type="button" onClick={() => setCancelled(false)} className="shrink-0 rounded-lg p-0.5 text-amber-400 hover:bg-amber-100"><X size={14} /></button>
            </div>
          )}

          {/* ── Step 1: Delivery ── */}
          <section className="rounded-2xl border border-line bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
            <StepHeader n={1} label="Delivery address"><MapPin size={15} /></StepHeader>
            <div className="mt-5 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <ValidatedField label="State" htmlFor="state" required error={errors.state} touched={touched.state} valid={isFieldValid('state')}>
                  <Select id="state" name="state" value={form.state} onChange={(e) => change('state', e.target.value)} onBlur={() => blur('state')}
                    className={cn('transition-all', touched.state && errors.state ? 'border-red-400 bg-red-50/50' : touched.state && !errors.state ? 'border-teal-400' : '')}>
                    <option value="" disabled>Select your state</option>
                    {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </ValidatedField>
                <ValidatedField label="City / LGA" htmlFor="city" required error={errors.city} touched={touched.city} valid={isFieldValid('city')}>
                  <Input id="city" name="city" value={form.city} onChange={(e) => change('city', e.target.value)} onBlur={() => blur('city')}
                    placeholder="e.g. Wuse 2, Victoria Island"
                    className={cn('transition-all', touched.city && errors.city ? 'border-red-400 bg-red-50/50' : touched.city && !errors.city ? 'border-teal-400' : '')} />
                </ValidatedField>
              </div>
              <ValidatedField label="Street address" htmlFor="street_address" required error={errors.street_address} touched={touched.street_address}>
                <Textarea id="street_address" name="street_address" rows={2} value={form.street_address}
                  onChange={(e) => change('street_address', e.target.value)} onBlur={() => blur('street_address')}
                  placeholder="House number, street name, nearest landmark"
                  className={cn('transition-all', touched.street_address && errors.street_address ? 'border-red-400 bg-red-50/50' : touched.street_address && !errors.street_address ? 'border-teal-400' : '')} />
              </ValidatedField>
              <ValidatedField label="Contact phone" htmlFor="contact_phone" required error={errors.contact_phone} touched={touched.contact_phone} valid={isFieldValid('contact_phone')}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-xs font-semibold text-ink-3">+234</span>
                  <Input id="contact_phone" name="contact_phone" type="tel" value={form.contact_phone}
                    onChange={(e) => change('contact_phone', e.target.value)} onBlur={() => blur('contact_phone')}
                    placeholder="08012345678"
                    className={cn('pl-12 transition-all', touched.contact_phone && errors.contact_phone ? 'border-red-400 bg-red-50/50' : touched.contact_phone && !errors.contact_phone ? 'border-teal-400' : '')} />
                  {!touched.contact_phone && <Phone size={13} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-4" />}
                </div>
              </ValidatedField>
              <Field label="Delivery notes" htmlFor="delivery_notes" hint="Gate code, preferred delivery window, building instructions, etc.">
                <Textarea id="delivery_notes" name="delivery_notes" rows={2} value={form.delivery_notes}
                  onChange={(e) => change('delivery_notes', e.target.value)} placeholder="Optional" />
              </Field>
            </div>
          </section>

          {/* ── Step 2: Payment ── */}
          <section className="rounded-2xl border border-line bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
            <StepHeader n={2} label="Payment method"><CreditCard size={15} /></StepHeader>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {PAY_METHODS.map(({ value, label, sub, Icon, recommended }) => {
                const active = pay === value;
                return (
                  <label key={value} className={cn('relative flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 transition-all duration-200',
                    active ? 'border-teal-400 bg-gradient-to-br from-teal-50 to-cyan-50/60 shadow-[0_0_0_3px_rgba(45,212,191,0.14),0_8px_28px_rgba(45,212,191,0.14)]'
                           : 'border-line bg-white hover:border-teal-200')}>
                    <input type="radio" name="payment_method" value={value} checked={active} onChange={() => setPay(value)} className="sr-only" />
                    <div className="flex items-start justify-between">
                      <span className={cn('grid h-10 w-10 place-items-center rounded-xl', active ? 'bg-teal-100 text-teal-700' : 'bg-bg-muted text-ink-2')}><Icon size={18} /></span>
                      {active && <span className="grid h-5 w-5 place-items-center rounded-full bg-teal-500 text-white"><Check size={10} /></span>}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{label}</p>
                      <p className="mt-0.5 text-xs text-ink-3">{sub}</p>
                    </div>
                    {recommended && <span className="absolute right-2.5 top-2.5 rounded-full bg-teal-500 px-2 py-[3px] text-[9px] font-bold uppercase tracking-wide text-white">Recommended</span>}
                  </label>
                );
              })}
            </div>
            <div className="mt-4">
              {pay === 'paystack' && (
                <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-teal-50 px-4 py-2.5">
                  <Lock size={13} className="shrink-0 text-teal-600" />
                  <p className="text-xs text-teal-700"><strong className="font-semibold">Secured by Paystack</strong> · 256-bit SSL · PCI DSS Level 1</p>
                </div>
              )}
              {pay === 'bank_transfer' && (
                <div className="rounded-xl border border-line bg-bg-subtle px-4 py-3 text-xs text-ink-2">Bank details will be sent to your email after placing the order. Orders are processed once payment clears (1–2 business days).</div>
              )}
              {pay === 'cash_on_delivery' && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">Pay on delivery is available for verified pharmacy accounts in select areas only. Cash or POS accepted on arrival.</div>
              )}
            </div>
          </section>

        </div>

        {/* ── Order summary sidebar ── */}
        <aside className="sticky top-20 self-start rounded-2xl border border-line bg-white p-6 shadow-[0_10px_50px_rgba(15,23,42,0.08)]">
          <h2 className="mb-5 text-base font-semibold tracking-tight text-ink">Order summary</h2>

          {mounted && (
            <ul className="flex flex-col gap-3 border-b border-line pb-4">
              {items.map((item) => (
                <li key={item.product_id} className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-bg-muted text-ink-3"><Box size={14} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                    <p className="text-xs text-ink-3">Qty {item.quantity}</p>
                  </div>
                  <span className="num shrink-0 text-sm font-semibold text-ink">{formatNaira(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 space-y-2.5">
            <SummaryRow label="Subtotal" value={formatNaira(subtotal)} />
            <SummaryRow label="Shipping" value={shipping === 0 ? 'Free' : formatNaira(shipping)} valueClass={shipping === 0 ? 'text-teal-600 font-semibold' : ''} />
            <SummaryRow label="VAT (7.5%)" value={formatNaira(vat)} />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-teal-100 bg-teal-50 px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-600">Total payable</p>
              <p className="mt-0.5 text-[10px] text-teal-500">Incl. VAT &amp; shipping</p>
            </div>
            <span className="num font-display text-2xl font-bold tracking-tight text-[#042a36]">{formatNaira(total)}</span>
          </div>

          <button type="submit" disabled={submitting}
            className={cn(
              'mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white',
              'bg-[#042a36] shadow-[0_10px_32px_rgba(4,42,54,0.28)] transition-all duration-200',
              'hover:-translate-y-0.5 hover:bg-teal-900',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-60',
            )}>
            {submitting
              ? <><Spinner size={15} className="animate-spin" />Processing…</>
              : <>{pay === 'paystack' ? <CreditCard size={15} /> : <Lock size={15} />}{pay === 'paystack' ? `Pay ${formatNaira(total)}` : 'Place order'}</>}
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-3">
            <Lock size={11} />
            Your data is encrypted and secure
          </p>
        </aside>
      </form>
    </>
  );
}
