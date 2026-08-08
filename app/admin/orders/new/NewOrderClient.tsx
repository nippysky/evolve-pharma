'use client';

/**
 * Place an order on behalf of a customer (ADMIN / STAFF).
 *
 * Three steps: pick customer → build basket + delivery → review & confirm.
 * Payment is never marked here — the order is always created UNPAID and
 * resolved by the Paystack webhook, an admin reconciliation, or the driver
 * confirming cash on delivery.
 */

import { useState, useMemo, useEffect } from 'react';
import { useRouter }                    from 'next/navigation';
import Link                             from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Minus, Trash, User, Building, MapPin, CreditCard,
  AlertTriangle, CheckCircle, RotateCw, ArrowLeft, Box, Pill, Send,
} from '@/components/icons';
import { Button }            from '@/components/ui/Button';
import { useToast }          from '@/contexts/ToastContext';
import { cn, formatNaira }   from '@/lib/utils';

const FREE_SHIP_THRESHOLD = 50_000;
const SHIP_FEE            = 2_500;

// ── Types ────────────────────────────────────────────────────────────────────

interface CustomerRecord {
  id:           number;
  company_name: string | null;
  address:      string | null;
  city:         string | null;
  state:        string | null;
  status:       string;
  user: {
    id:         number;
    first_name: string;
    last_name:  string;
    email:      string;
    phone:      string | null;
  };
}

interface ProductRecord {
  id:               number;
  sku:              string;
  brand_name:       string;
  generic_name:     string | null;
  product_strength: string | null;
  pack_size:        string | null;
  minimum_order:    number;
  selling_price:    number;
  primary_image:    string | null;
  in_stock:         boolean;
  total_stock:      number;
}

interface BasketLine {
  product:  ProductRecord;
  quantity: number;
}

type PaymentMethod =
  | 'payment_received'
  | 'payment_link'
  | 'bank_transfer'
  | 'cash_on_delivery';

type ReceivedVia = 'cash' | 'bank_transfer' | 'pos' | 'other';

const RECEIVED_VIA_OPTIONS: { value: ReceivedVia; label: string }[] = [
  { value: 'cash',          label: 'Cash'          },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'pos',           label: 'POS / card'    },
  { value: 'other',         label: 'Other'         },
];

const PAYMENT_OPTIONS: {
  value: PaymentMethod; label: string; blurb: string; badge?: string;
}[] = [
  {
    value: 'payment_received',
    label: 'Payment already received',
    blurb: 'You collected the money before placing this order. Records it as paid against your name.',
    badge: 'PAID NOW',
  },
  {
    value: 'payment_link',
    label: 'Send payment link',
    blurb: 'Paystack link emailed to the customer. Marks itself paid the moment they pay.',
    badge: 'AUTO',
  },
  {
    value: 'bank_transfer',
    label: 'Invoice / bank transfer',
    blurb: 'Stays unpaid. Confirm it from the order once the transfer lands.',
  },
  {
    value: 'cash_on_delivery',
    label: 'Cash on delivery',
    blurb: 'Stays unpaid until the driver confirms cash collected at handover.',
  },
];

// ── Small pieces ─────────────────────────────────────────────────────────────

function StepPill({ n, label, active, done }: {
  n: number; label: string; active: boolean; done: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors',
        done   ? 'bg-teal-500 text-white'
        : active ? 'bg-ink text-white'
        : 'bg-bg-muted text-ink-3',
      )}>
        {done ? <CheckCircle size={12} /> : n}
      </span>
      <span className={cn(
        'text-xs font-semibold',
        active || done ? 'text-ink' : 'text-ink-3',
      )}>
        {label}
      </span>
    </div>
  );
}

function Field({ label, children, hint }: {
  label: string; children: React.ReactNode; hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-4">{hint}</span>}
    </label>
  );
}

const inputCls =
  'h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink ' +
  'placeholder:text-ink-4 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/15';

// ── Main ─────────────────────────────────────────────────────────────────────

export default function NewOrderClient({
  actorName,
  actorRole,
  presetCustomerId,
}: {
  actorName:        string;
  actorRole:        'ADMIN' | 'STAFF';
  presetCustomerId: number | null;
}) {
  const router = useRouter();
  const toast  = useToast();
  const qc     = useQueryClient();

  const [step,       setStep]       = useState<1 | 2 | 3>(1);
  const [customer,   setCustomer]   = useState<CustomerRecord | null>(null);
  const [custSearch, setCustSearch] = useState('');
  const [prodSearch, setProdSearch] = useState('');
  const [basket,     setBasket]     = useState<BasketLine[]>([]);

  const [state,     setState]     = useState('');
  const [city,      setCity]      = useState('');
  const [address,   setAddress]   = useState('');
  const [phone,     setPhone]     = useState('');
  const [notes,     setNotes]     = useState('');
  const [poNumber,  setPoNumber]  = useState('');
  const [payment,     setPayment]     = useState<PaymentMethod>('payment_link');
  const [receivedVia, setReceivedVia] = useState<ReceivedVia>('cash');
  const [payRef,      setPayRef]      = useState('');
  const [payNote,     setPayNote]     = useState('');

  // ── Customers (approved only — the API rejects anything else anyway) ───────
  const customersQ = useQuery<{ data: { records: CustomerRecord[] } }>({
    queryKey: ['on-behalf-customers', custSearch],
    queryFn:  () =>
      fetch(`/api/customers?status=APPROVED&limit=25&search=${encodeURIComponent(custSearch)}`,
        { credentials: 'include' }).then(r => r.json()),
    enabled:   step === 1,
    staleTime: 15_000,
  });

  // Pre-select a customer when arriving from their detail page
  useEffect(() => {
    if (!presetCustomerId || customer) return;
    fetch(`/api/customers/${presetCustomerId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        const c = j?.data?.customer ?? j?.data;
        if (c?.id) { setCustomer(c); setStep(2); }
      })
      .catch(() => {/* fall back to manual pick */});
  }, [presetCustomerId, customer]);

  // Prefill delivery details whenever the customer changes
  useEffect(() => {
    if (!customer) return;
    setState(customer.state   ?? '');
    setCity(customer.city     ?? '');
    setAddress(customer.address ?? '');
    setPhone(customer.user.phone ?? '');
  }, [customer]);

  // ── Products ──────────────────────────────────────────────────────────────
  const productsQ = useQuery<{ data: { records: ProductRecord[] } }>({
    queryKey: ['on-behalf-products', prodSearch],
    queryFn:  () =>
      fetch(`/api/catalog/products?limit=20&search=${encodeURIComponent(prodSearch)}`)
        .then(r => r.json()),
    enabled:   step === 2,
    staleTime: 15_000,
  });

  // ── Totals ────────────────────────────────────────────────────────────────
  const subtotal    = useMemo(
    () => basket.reduce((s, l) => s + l.product.selling_price * l.quantity, 0),
    [basket],
  );
  const deliveryFee = subtotal >= FREE_SHIP_THRESHOLD || subtotal === 0 ? 0 : SHIP_FEE;
  const total       = subtotal + deliveryFee;

  // ── Per-line validation (mirrors the server rules in createOrder) ──────────
  const lineErrors = useMemo(() => {
    const errs: Record<number, string> = {};
    for (const l of basket) {
      if (l.quantity > l.product.total_stock) {
        errs[l.product.id] = `Only ${l.product.total_stock} in stock`;
      } else if (l.quantity < l.product.minimum_order) {
        errs[l.product.id] = `Minimum order is ${l.product.minimum_order}`;
      }
    }
    return errs;
  }, [basket]);

  const hasLineErrors = Object.keys(lineErrors).length > 0;

  const deliveryValid =
    state.trim().length >= 2 &&
    city.trim().length >= 2 &&
    address.trim().length >= 8 &&
    phone.trim().length >= 8;

  // Recording an already-collected payment requires a reference so the money
  // can be traced back to a teller slip / POS receipt during reconciliation.
  const paymentValid =
    payment !== 'payment_received' || payRef.trim().length >= 2;

  const canReview = basket.length > 0 && !hasLineErrors && deliveryValid && paymentValid;

  // ── Basket helpers ────────────────────────────────────────────────────────
  function addProduct(p: ProductRecord) {
    setBasket(prev => {
      const existing = prev.find(l => l.product.id === p.id);
      if (existing) {
        return prev.map(l =>
          l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l);
      }
      // Start at the product's minimum order so the line is valid immediately
      return [...prev, { product: p, quantity: Math.max(1, p.minimum_order) }];
    });
  }

  function setQty(productId: number, qty: number) {
    setBasket(prev => prev.map(l =>
      l.product.id === productId ? { ...l, quantity: Math.max(1, qty) } : l));
  }

  function removeLine(productId: number) {
    setBasket(prev => prev.filter(l => l.product.id !== productId));
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const submitMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/orders/on-behalf', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customer_id:    customer!.id,
          items:          basket.map(l => ({ product_id: l.product.id, quantity: l.quantity })),
          state:          state.trim(),
          city:           city.trim(),
          street_address: address.trim(),
          contact_phone:  phone.trim(),
          delivery_notes: notes.trim() || undefined,
          po_number:      poNumber.trim() || undefined,
          payment_method: payment,
          ...(payment === 'payment_received' ? {
            received_via:      receivedVia,
            payment_reference: payRef.trim(),
            payment_note:      payNote.trim() || undefined,
          } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'Could not place the order.');
      return json.data as {
        order_id: number; order_number: string; total: number; payment_url: string | null;
      };
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.show({
        tone:  'success',
        title: `Order ${data.order_number} placed`,
        description: data.payment_url
          ? 'A payment link has been emailed to the customer.'
          : 'The customer has been emailed a receipt.',
      });
      router.push('/admin/orders');
    },
    onError: (err: Error) => {
      toast.show({ tone: 'error', title: 'Could not place order', description: err.message });
    },
  });

  const customers = customersQ.data?.data?.records ?? [];
  const products  = productsQ.data?.data?.records  ?? [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Back + stepper */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
        >
          <ArrowLeft size={14} />
          Back to orders
        </Link>
        <div className="flex items-center gap-4">
          <StepPill n={1} label="Customer" active={step === 1} done={step > 1} />
          <span className="h-px w-6 bg-line" />
          <StepPill n={2} label="Basket"   active={step === 2} done={step > 2} />
          <span className="h-px w-6 bg-line" />
          <StepPill n={3} label="Review"   active={step === 3} done={false} />
        </div>
      </div>

      {/* Standing warning — this is not a normal checkout */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
        <p className="text-xs text-amber-800">
          You are placing an order <strong>on behalf of a customer</strong>. It will be
          recorded against your name ({actorName}) and the customer will be emailed a
          receipt naming you. Orders are always created unpaid.
        </p>
      </div>

      {/* ── Step 1: customer ─────────────────────────────────────────────── */}
      {step === 1 && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">Who is this order for?</h2>
          <p className="mb-4 text-xs text-ink-3">
            Only approved customers can have orders placed on their behalf.
          </p>

          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              autoFocus
              value={custSearch}
              onChange={e => setCustSearch(e.target.value)}
              placeholder="Search by name, company or email…"
              className={cn(inputCls, 'pl-9')}
            />
          </div>

          {customersQ.isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-bg-muted" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <User size={22} className="text-ink-4" />
              <p className="text-sm text-ink-3">No approved customers match that search.</p>
            </div>
          ) : (
            <div className="max-h-[26rem] space-y-2 overflow-y-auto">
              {customers.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCustomer(c); setStep(2); }}
                  className="flex w-full items-center gap-3 rounded-xl border border-line px-4 py-3 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-muted text-xs font-bold text-ink-2">
                    {c.user.first_name[0]}{c.user.last_name[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {c.user.first_name} {c.user.last_name}
                    </span>
                    <span className="block truncate text-xs text-ink-3">
                      {c.company_name ? `${c.company_name} · ` : ''}{c.user.email}
                    </span>
                  </span>
                  <Plus size={14} className="shrink-0 text-ink-3" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Step 2: basket + delivery ────────────────────────────────────── */}
      {step === 2 && customer && (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">

          {/* Left: product search + basket */}
          <div className="space-y-5">
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Add products</h2>
              <div className="relative mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  value={prodSearch}
                  onChange={e => setProdSearch(e.target.value)}
                  placeholder="Search catalogue by name or SKU…"
                  className={cn(inputCls, 'pl-9')}
                />
              </div>

              {productsQ.isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-lg bg-bg-muted" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-3">No products found.</p>
              ) : (
                <div className="max-h-72 space-y-1.5 overflow-y-auto">
                  {products.map(p => {
                    const inBasket = basket.some(l => l.product.id === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={!p.in_stock}
                        onClick={() => addProduct(p)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                          !p.in_stock
                            ? 'cursor-not-allowed border-line bg-bg-muted/50 opacity-60'
                            : inBasket
                              ? 'border-teal-300 bg-teal-50/50'
                              : 'border-line hover:border-teal-300 hover:bg-teal-50/40',
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-white text-ink-4">
                          <Pill size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {p.brand_name}
                          </span>
                          <span className="block truncate text-[11px] text-ink-3">
                            {p.sku}
                            {p.product_strength ? ` · ${p.product_strength}` : ''}
                            {p.pack_size ? ` · ${p.pack_size}` : ''}
                            {' · '}
                            {p.in_stock ? `${p.total_stock} in stock` : 'Out of stock'}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-ink">
                          {formatNaira(p.selling_price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Basket */}
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">
                Basket {basket.length > 0 && (
                  <span className="ml-1 text-xs font-normal text-ink-3">
                    ({basket.length} {basket.length === 1 ? 'line' : 'lines'})
                  </span>
                )}
              </h2>

              {basket.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Box size={20} className="text-ink-4" />
                  <p className="text-sm text-ink-3">Nothing added yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-line-subtle">
                  {basket.map(l => {
                    const err = lineErrors[l.product.id];
                    return (
                      <div key={l.product.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {l.product.brand_name}
                          </p>
                          <p className="text-[11px] text-ink-3">
                            {formatNaira(l.product.selling_price)} each
                          </p>
                          {err && (
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-red-600">
                              <AlertTriangle size={10} />
                              {err}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-line p-0.5">
                          <button
                            type="button"
                            onClick={() => setQty(l.product.id, l.quantity - 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-bg-muted"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={l.quantity}
                            onChange={e => setQty(l.product.id, parseInt(e.target.value, 10) || 1)}
                            className="w-12 border-0 bg-transparent text-center text-sm font-semibold text-ink focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setQty(l.product.id, l.quantity + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-bg-muted"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        <span className="w-24 shrink-0 text-right text-sm font-semibold text-ink">
                          {formatNaira(l.product.selling_price * l.quantity)}
                        </span>

                        <button
                          type="button"
                          onClick={() => removeLine(l.product.id)}
                          className="shrink-0 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right: customer + delivery + payment */}
          <div className="space-y-4">

            <section className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Customer</h2>
                <button
                  type="button"
                  onClick={() => { setStep(1); setCustomer(null); setBasket([]); }}
                  className="text-xs font-semibold text-brand-600 hover:underline"
                >
                  Change
                </button>
              </div>
              <p className="text-sm font-semibold text-ink">
                {customer.user.first_name} {customer.user.last_name}
              </p>
              {customer.company_name && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                  <Building size={11} />{customer.company_name}
                </p>
              )}
              <p className="mt-0.5 text-xs text-ink-3">{customer.user.email}</p>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <MapPin size={14} className="text-ink-3" />
                <h2 className="text-sm font-semibold text-ink">Delivery</h2>
              </div>
              <div className="space-y-3">
                <Field label="Street address">
                  <textarea
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    rows={2}
                    placeholder="Building, street, area"
                    className={cn(inputCls, 'h-auto py-2 resize-none')}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City">
                    <input value={city} onChange={e => setCity(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="State">
                    <input value={state} onChange={e => setState(e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <Field label="Contact phone">
                  <input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
                </Field>
                <Field label="PO number" hint="Optional">
                  <input value={poNumber} onChange={e => setPoNumber(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Delivery notes" hint="Optional">
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    className={cn(inputCls, 'h-auto py-2 resize-none')}
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <CreditCard size={14} className="text-ink-3" />
                <h2 className="text-sm font-semibold text-ink">Payment</h2>
              </div>
              <div className="space-y-2">
                {PAYMENT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPayment(opt.value)}
                    className={cn(
                      'w-full rounded-xl border px-3.5 py-3 text-left transition-colors',
                      payment === opt.value
                        ? 'border-teal-400 bg-teal-50/60 ring-1 ring-teal-200'
                        : 'border-line hover:border-line-strong',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{opt.label}</span>
                      {opt.badge && (
                        <span className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                          opt.badge === 'PAID NOW'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-teal-100 text-teal-700',
                        )}>
                          {opt.badge}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-ink-3">
                      {opt.blurb}
                    </span>
                  </button>
                ))}
              </div>

              {/* Offline collection details */}
              {payment === 'payment_received' && (
                <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <p className="text-[11px] leading-snug text-emerald-800">
                    This marks the order <strong>paid immediately</strong> and is recorded
                    against your name in the audit trail. Only do this if you have
                    actually received the money.
                  </p>
                  <Field label="Received via">
                    <select
                      value={receivedVia}
                      onChange={e => setReceivedVia(e.target.value as ReceivedVia)}
                      className={inputCls}
                    >
                      {RECEIVED_VIA_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Reference"
                    hint="Teller number, POS slip, transfer reference — anything traceable"
                  >
                    <input
                      value={payRef}
                      onChange={e => setPayRef(e.target.value)}
                      placeholder="e.g. TRF-889201 or POS slip 4471"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Note" hint="Optional">
                    <input
                      value={payNote}
                      onChange={e => setPayNote(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}
            </section>

            {/* Totals + continue */}
            <section className="rounded-2xl border border-line bg-white p-5">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-ink-2">
                  <span>Subtotal</span><span>{formatNaira(subtotal)}</span>
                </div>
                <div className="flex justify-between text-ink-2">
                  <span>Delivery</span>
                  <span>{deliveryFee === 0 ? 'Free' : formatNaira(deliveryFee)}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-line-subtle pt-3">
                <span className="text-sm font-semibold text-ink">Total</span>
                <span className="text-xl font-bold tracking-tight text-ink">
                  {formatNaira(total)}
                </span>
              </div>
              <Button
                fullWidth
                className="mt-4"
                disabled={!canReview}
                onClick={() => setStep(3)}
              >
                Review order
              </Button>
              {!canReview && (
                <p className="mt-2 text-center text-[11px] text-ink-4">
                  {basket.length === 0
                    ? 'Add at least one product.'
                    : hasLineErrors
                      ? 'Fix the highlighted quantity problems.'
                      : !deliveryValid
                        ? 'Complete the delivery details.'
                        : 'Add a payment reference.'}
                </p>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ── Step 3: review ───────────────────────────────────────────────── */}
      {step === 3 && customer && (
        <section className="mx-auto max-w-2xl space-y-4">
          <div className="rounded-2xl border border-line bg-white p-6">
            <h2 className="text-base font-semibold text-ink">Confirm this order</h2>
            <p className="mt-1 text-sm text-ink-3">
              You are placing this order on behalf of{' '}
              <strong className="text-ink">
                {customer.user.first_name} {customer.user.last_name}
              </strong>
              {customer.company_name ? ` (${customer.company_name})` : ''}.
            </p>

            <div className="mt-5 divide-y divide-line-subtle border-y border-line-subtle">
              {basket.map(l => (
                <div key={l.product.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{l.product.brand_name}</p>
                    <p className="text-[11px] text-ink-3">
                      {l.quantity} × {formatNaira(l.product.selling_price)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-ink">
                    {formatNaira(l.product.selling_price * l.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-ink-2">
                <span>Subtotal</span><span>{formatNaira(subtotal)}</span>
              </div>
              <div className="flex justify-between text-ink-2">
                <span>Delivery</span>
                <span>{deliveryFee === 0 ? 'Free' : formatNaira(deliveryFee)}</span>
              </div>
              <div className="flex justify-between border-t border-line-subtle pt-2 text-base font-bold text-ink">
                <span>Total</span><span>{formatNaira(total)}</span>
              </div>
            </div>

            <dl className="mt-5 grid gap-3 rounded-xl bg-bg-subtle p-4 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-ink-2">Deliver to</dt>
                <dd className="mt-0.5 text-ink-3">{address}<br />{city}, {state}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink-2">Contact</dt>
                <dd className="mt-0.5 text-ink-3">{phone}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink-2">Payment</dt>
                <dd className="mt-0.5 text-ink-3">
                  {PAYMENT_OPTIONS.find(o => o.value === payment)!.label}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink-2">Placed by</dt>
                <dd className="mt-0.5 text-ink-3">{actorName} ({actorRole})</dd>
              </div>
            </dl>

            {payment === 'payment_received' ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                <p className="text-xs text-emerald-800">
                  This order will be created <strong>already paid</strong>, recorded as
                  received via {RECEIVED_VIA_OPTIONS.find(o => o.value === receivedVia)!.label.toLowerCase()}
                  {' '}(ref <strong>{payRef.trim()}</strong>). The confirmation is logged
                  against your name — only continue if the money is genuinely in hand.
                </p>
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <CreditCard size={15} className="mt-0.5 shrink-0 text-blue-500" />
                <p className="text-xs text-blue-800">
                  This order will be created <strong>unpaid</strong>.{' '}
                  {payment === 'payment_link'
                    ? 'A Paystack link will be emailed to the customer, and the order marks itself paid the moment they pay.'
                    : payment === 'bank_transfer'
                      ? 'Send the customer the invoice; confirm payment from the order once the transfer lands.'
                      : 'It stays unpaid until the driver confirms cash collected at handover.'}
                </p>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                onClick={() => setStep(2)}
                disabled={submitMut.isPending}
              >
                Back
              </Button>
              <Button
                onClick={() => submitMut.mutate()}
                loading={submitMut.isPending}
                disabled={submitMut.isPending || !canReview}
                leadingIcon={payment === 'payment_link' ? <Send size={14} /> : undefined}
              >
                {payment === 'payment_link' ? 'Place order & send link' : 'Place order'}
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
