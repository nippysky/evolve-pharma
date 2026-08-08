'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {Search, Box, Eye, Printer, X, ChevronLeft, ChevronRight, Pill, MapPin, Phone, Building, Check, Refresh, FileText, Truck, User, CheckCircle, RotateCw} from '@/components/icons';
import { formatNaira, formatDate, cn } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';
import { SITE } from '@/lib/constants';
import { useUser } from '@/contexts/UserContext';

interface AdminOrder {
  id:               number;
  order_number:     string;
  status:           string;
  payment_status:   string;
  payment_reference:string | null;
  delivery_address: string;
  delivery_city:    string;
  delivery_state:   string;
  subtotal:         number;
  discount:         number;
  delivery_fee:     number;
  total:            number;
  notes:            string | null;
  created_at:       string;
  customer: {
    id:           number;
    company_name: string;
    first_name:   string;
    last_name:    string;
    email:        string;
    phone:        string;
  };
  item_count: number;
  delivery:   { status: string; tracking_code: string; driver_id: number | null } | null;
}

interface DetailItem {
  id:         number;
  quantity:   number;
  unit_price: number;
  subtotal:   number;
  product: {
    sku:              string;
    brand_name:       string;
    generic_name:     string;
    product_strength: string | null;
    pack_size:        string | null;
    shelf_location:   string | null;
    manufacturer:     string | null;
    primary_image:    string | null;
    batch_number:     string | null;
    expiry_date:      string | null;
  };
}

interface PlacedBy { id: number; name: string; role: string }

interface OrderDetail extends AdminOrder {
  items: DetailItem[];
  /** Set when a staff member or admin placed this order for the customer. */
  placed_by?: PlacedBy | null;
}

function parseNotes(raw: string | null): {
  contact_phone?: string; po_number?: string;
  delivery_notes?: string; vat?: number;
} {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

const ORDER_STYLE: Record<string, { bg: string; dot: string; text: string; label: string }> = {
  PENDING:    { bg: 'bg-amber-50 border border-amber-200',    dot: 'bg-amber-400',   text: 'text-amber-800',   label: 'Pending'    },
  CONFIRMED:  { bg: 'bg-blue-50 border border-blue-200',      dot: 'bg-blue-500',    text: 'text-blue-800',    label: 'Confirmed'  },
  PROCESSING: { bg: 'bg-indigo-50 border border-indigo-200',  dot: 'bg-indigo-500',  text: 'text-indigo-800',  label: 'Processing' },
  DISPATCHED: { bg: 'bg-teal-50 border border-teal-200',      dot: 'bg-teal-500',    text: 'text-teal-800',    label: 'Dispatched' },
  DELIVERED:  { bg: 'bg-green-50 border border-green-200',    dot: 'bg-green-500',   text: 'text-green-800',   label: 'Delivered'  },
  CANCELLED:  { bg: 'bg-red-50 border border-red-200',        dot: 'bg-red-400',     text: 'text-red-800',     label: 'Cancelled'  },
};

const PAY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  UNPAID:   { bg: 'bg-orange-50 border border-orange-200',   text: 'text-orange-800', label: 'Unpaid'   },
  PARTIAL:  { bg: 'bg-yellow-50 border border-yellow-200',   text: 'text-yellow-800', label: 'Partial'  },
  PAID:     { bg: 'bg-emerald-50 border border-emerald-200', text: 'text-emerald-800',label: 'Paid ✓'   },
  REFUNDED: { bg: 'bg-purple-50 border border-purple-200',   text: 'text-purple-800', label: 'Refunded' },
  FAILED:   { bg: 'bg-red-50 border border-red-200',         text: 'text-red-800',    label: 'Failed'   },
};

function OrderStatusBadge({ status }: { status: string }) {
  const s = (ORDER_STYLE[status] ?? ORDER_STYLE['PENDING'])!;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', s.bg, s.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

/**
 * Confirm an offline payment on an on-behalf order.
 *
 * Only rendered for orders a rep placed for a customer. Cash, POS and direct
 * bank transfers have no Paystack callback, so the person who took the money
 * records it — and it is written to the audit trail against their name.
 */
function ConfirmPaymentButton({
  orderId,
  orderNumber,
  onDone,
}: {
  orderId:     number;
  orderNumber: string;
  onDone:      () => void;
}) {
  const toast = useToast();
  const [open, setOpen]   = useState(false);
  const [via,  setVia]    = useState<'cash' | 'bank_transfer' | 'pos' | 'other'>('cash');
  const [ref,  setRef]    = useState('');
  const [note, setNote]   = useState('');
  const [busy, setBusy]   = useState(false);

  async function submit() {
    if (ref.trim().length < 2) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm-payment`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          received_via:      via,
          payment_reference: ref.trim(),
          note:              note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'Could not confirm payment.');
      toast.show({
        tone: 'success',
        title: 'Payment confirmed',
        description: `${orderNumber} is now marked paid.`,
      });
      setOpen(false);
      setRef(''); setNote('');
      onDone();
    } catch (err) {
      toast.show({ tone: 'error', title: 'Failed', description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 transition-colors hover:bg-emerald-100"
      >
        <CheckCircle size={11} />
        Confirm payment
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-ink">
              Confirm payment for {orderNumber}
            </h2>
            <p className="mt-1.5 text-xs text-ink-3">
              Only do this if the money has actually been received. This marks the
              order paid and is logged against your name.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-2">Received via</span>
                <select
                  value={via}
                  onChange={e => setVia(e.target.value as typeof via)}
                  className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-teal-400 focus:outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="pos">POS / card</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-2">Reference</span>
                <input
                  autoFocus
                  value={ref}
                  onChange={e => setRef(e.target.value)}
                  placeholder="Teller no., POS slip, transfer ref"
                  className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-teal-400 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-2">
                  Note <span className="font-normal text-ink-4">(optional)</span>
                </span>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-teal-400 focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || ref.trim().length < 2}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy && <RotateCw size={13} className="animate-spin" />}
                Confirm payment
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const s = (PAY_STYLE[status] ?? PAY_STYLE['UNPAID'])!;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', s.bg, s.text)}>
      {s.label}
    </span>
  );
}

// Ordered steps — each step only unlocks the next
const ORDER_STEPS = [
  { status: 'PENDING',    label: 'Pending',    icon: '📋', desc: 'Order received, awaiting confirmation' },
  { status: 'CONFIRMED',  label: 'Confirmed',  icon: '✅', desc: 'Confirmed — warehouse begins preparation' },
  { status: 'PROCESSING', label: 'Processing', icon: '📦', desc: 'Picking & packing in progress' },
  { status: 'DISPATCHED', label: 'Dispatched', icon: '🚚', desc: 'Out for delivery with driver' },
  { status: 'DELIVERED',  label: 'Delivered',  icon: '🎉', desc: 'Customer received the order' },
];

const STEP_TRANSITION: Record<string, string> = {
  PENDING:    'CONFIRMED',
  CONFIRMED:  'PROCESSING',
  PROCESSING: 'DISPATCHED',
  DISPATCHED: 'DELIVERED',
};

const STEP_ACTION_LABEL: Record<string, string> = {
  PENDING:    'Confirm order',
  CONFIRMED:  'Start processing',
  PROCESSING: 'Mark dispatched',
  DISPATCHED: 'Mark delivered',
};

const STEP_ACTION_DESC: Record<string, string> = {
  PENDING:    'Notify warehouse to begin preparation',
  CONFIRMED:  'Warehouse is picking and packing this order',
  PROCESSING: 'Order is leaving with a driver — assign driver first in Deliveries',
  DISPATCHED: 'Customer has received their package',
};

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtExpiry(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-NG', { year: 'numeric', month: 'short' });
  } catch { return d; }
}

function openDoc(html: string) {
  const win = window.open('', '_blank', 'width=900,height=780,scrollbars=yes');
  if (!win) { alert('Allow pop-ups for this site to open documents.'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ── INVOICE ─────────────────────────────────────────────────────────────────

function buildInvoiceHTML(order: OrderDetail): string {
  const notes  = parseNotes(order.notes);
  const vat    = notes.vat ?? 0;
  const isPaid = order.payment_status === 'PAID';

  const rows = order.items.map((item, idx) => `
    <tr style="background:${idx%2===0?'#f8fafc':'#fff'};border-bottom:1px solid #e2e8f0;">
      <td style="padding:10px 12px;font-size:12px;color:#64748b;">${idx+1}</td>
      <td style="padding:10px 12px;">
        <div style="font-size:13px;font-weight:600;color:#0f172a;">${esc(item.product.brand_name)}</div>
        <div style="font-size:11px;color:#64748b;">${esc(item.product.generic_name)}${item.product.product_strength?` · ${esc(item.product.product_strength)}`:''}</div>
      </td>
      <td style="padding:10px 12px;font-size:11px;font-family:monospace;color:#64748b;">${esc(item.product.sku)}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;">${item.quantity}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;">${formatNaira(item.unit_price)}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:700;color:#042a36;">${formatNaira(item.subtotal)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Invoice ${esc(order.order_number)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a;background:#fff;padding:40px 48px;font-size:13px;line-height:1.5;}
@media print{body{padding:0;}@page{margin:20mm 18mm;size:A4 portrait;}.no-print{display:none!important;}}</style></head>
<body>
<div class="no-print" style="margin-bottom:24px;display:flex;gap:10px;">
  <button onclick="window.print()" style="background:#042a36;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">🖨️ Print / Save PDF</button>
  <button onclick="window.close()" style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Close</button>
</div>
<div style="max-width:800px;margin:0 auto;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2.5px solid #0d9488;">
    <div>
      <div style="font-size:22px;font-weight:800;color:#042a36;letter-spacing:-0.03em;">${SITE.legalName}</div>
      <div style="font-size:11px;color:#64748b;margin-top:4px;">EnvolveCare Express · Licensed Pharma Distributor</div>
      <div style="font-size:11px;color:#64748b;">${SITE.address}</div>
      <div style="font-size:11px;color:#64748b;">${SITE.email} · ${SITE.phone}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:28px;font-weight:800;color:#0d9488;letter-spacing:-0.04em;">INVOICE</div>
      <div style="font-size:14px;font-weight:700;margin-top:4px;font-family:monospace;color:#042a36;">${esc(order.order_number)}</div>
      <div style="font-size:11px;color:#64748b;margin-top:4px;">Date: ${esc(formatDate(order.created_at))}</div>
      ${notes.po_number?`<div style="font-size:11px;color:#64748b;">PO #: ${esc(notes.po_number)}</div>`:''}
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;">
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;margin-bottom:8px;">Bill To</div>
      <div style="font-size:14px;font-weight:700;">${esc(order.customer.company_name)}</div>
      <div style="font-size:12px;color:#475569;margin-top:2px;">${esc(order.customer.first_name)} ${esc(order.customer.last_name)}</div>
      <div style="font-size:12px;color:#475569;">${esc(order.customer.email)}</div>
      <div style="font-size:12px;color:#475569;">${esc(order.customer.phone)}</div>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;margin-bottom:8px;">Ship To</div>
      <div style="font-size:14px;font-weight:700;">${esc(order.customer.company_name)}</div>
      <div style="font-size:12px;color:#475569;margin-top:2px;">${esc(order.delivery_address)}</div>
      <div style="font-size:12px;color:#475569;">${esc(order.delivery_city)}, ${esc(order.delivery_state)}</div>
      ${notes.contact_phone?`<div style="font-size:12px;color:#475569;">Tel: ${esc(notes.contact_phone)}</div>`:''}
    </div>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px;">
    <div style="padding:6px 14px;border-radius:20px;border:1px solid #fbbf24;background:#fffbeb;font-size:11px;font-weight:700;color:#92400e;">Status: ${esc(order.status)}</div>
    <div style="padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;border:${isPaid?'1px solid #34d399':'1px solid #fb923c'};background:${isPaid?'#ecfdf5':'#fff7ed'};color:${isPaid?'#065f46':'#9a3412'};">Payment: ${esc(order.payment_status)}${isPaid?' ✓':''}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <thead><tr style="background:#042a36;color:#fff;">
      <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.06em;">#</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.06em;">PRODUCT</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.06em;">SKU</th>
      <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;letter-spacing:0.06em;">QTY</th>
      <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;letter-spacing:0.06em;">UNIT PRICE</th>
      <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;letter-spacing:0.06em;">SUBTOTAL</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-bottom:32px;">
    <div style="width:290px;">
      <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;"><span>Subtotal</span><span style="font-family:monospace;">${formatNaira(order.subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;"><span>Delivery</span><span style="font-family:monospace;">${order.delivery_fee===0?'Free':formatNaira(order.delivery_fee)}</span></div>
      ${vat>0?`<div style="display:flex;justify-content:space-between;padding:7px 0;font-size:12px;color:#475569;border-bottom:1px solid #e2e8f0;"><span>VAT (7.5%)</span><span style="font-family:monospace;">${formatNaira(vat)}</span></div>`:''}
      <div style="display:flex;justify-content:space-between;padding:14px 16px;margin-top:10px;background:#042a36;border-radius:10px;color:#fff;"><span style="font-weight:700;font-size:15px;">TOTAL</span><span style="font-weight:800;font-size:17px;font-family:monospace;">${formatNaira(order.total)}</span></div>
    </div>
  </div>
  <div style="border-top:1px solid #e2e8f0;padding-top:16px;display:flex;justify-content:space-between;">
    <div style="font-size:10px;color:#94a3b8;line-height:1.7;"><div>Computer-generated invoice — no physical signature required.</div><div>For queries: ${SITE.email} · ${SITE.phone}</div></div>
    <div style="font-size:10px;color:#94a3b8;text-align:right;"><div>EnvolveCare Express</div><div>Licensed Pharma Distributor</div></div>
  </div>
</div></body></html>`;
}

// ── PICKLIST ─────────────────────────────────────────────────────────────────

function buildPicklistHTML(order: OrderDetail): string {
  const rows = order.items.map((item, idx) => `
    <tr style="background:${idx%2===0?'#f8fafc':'#fff'};border-bottom:1px solid #e2e8f0;">
      <td style="padding:10px 12px;font-size:12px;color:#64748b;">${idx+1}</td>
      <td style="padding:10px 12px;">
        <div style="font-size:13px;font-weight:700;color:#0f172a;">${esc(item.product.brand_name)}</div>
        <div style="font-size:11px;color:#64748b;">${esc(item.product.generic_name)}${item.product.product_strength?` · ${esc(item.product.product_strength)}`:''}</div>
        <div style="font-size:10px;color:#94a3b8;font-family:monospace;">${esc(item.product.sku)}</div>
      </td>
      <td style="padding:10px 12px;font-size:12px;color:#475569;">${esc(item.product.manufacturer)??'—'}</td>
      <td style="padding:10px 12px;text-align:center;font-size:15px;font-weight:800;color:#042a36;">${item.quantity}</td>
      <td style="padding:10px 12px;font-size:11px;font-family:monospace;color:#0f172a;">${esc(item.product.batch_number)??'—'}</td>
      <td style="padding:10px 12px;font-size:11px;color:${item.product.expiry_date?'#0f172a':'#94a3b8'};">${fmtExpiry(item.product.expiry_date)}</td>
      <td style="padding:10px 12px;font-size:11px;font-weight:600;color:#0d9488;">${esc(item.product.shelf_location)??'—'}</td>
      <td style="padding:10px 12px;text-align:center;">
        <div style="width:20px;height:20px;border:2px solid #cbd5e1;border-radius:4px;display:inline-block;"></div>
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Picklist ${esc(order.order_number)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a;background:#fff;padding:32px 40px;font-size:13px;line-height:1.5;}
@media print{body{padding:0;}@page{margin:15mm 15mm;size:A4 portrait;}.no-print{display:none!important;}}</style></head>
<body>
<div class="no-print" style="margin-bottom:20px;display:flex;gap:10px;">
  <button onclick="window.print()" style="background:#042a36;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">🖨️ Print Picklist</button>
  <button onclick="window.close()" style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;padding:10px 20px;border-radius:8px;font-size:13px;cursor:pointer;">Close</button>
</div>
<div style="max-width:900px;margin:0 auto;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #042a36;">
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;margin-bottom:4px;">WAREHOUSE PICKLIST</div>
      <div style="font-size:20px;font-weight:800;color:#042a36;">${SITE.legalName}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:20px;font-weight:800;color:#0d9488;letter-spacing:-0.03em;">PICK LIST</div>
      <div style="font-size:14px;font-weight:700;font-family:monospace;color:#042a36;">${esc(order.order_number)}</div>
      <div style="font-size:11px;color:#64748b;">Date: ${esc(formatDate(order.created_at))}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;padding:14px 16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-bottom:4px;">Ship To</div>
      <div style="font-size:14px;font-weight:700;">${esc(order.customer.company_name)||esc(order.customer.first_name)+' '+esc(order.customer.last_name)}</div>
      <div style="font-size:12px;color:#475569;">${esc(order.delivery_address)}, ${esc(order.delivery_city)}, ${esc(order.delivery_state)}</div>
      <div style="font-size:12px;color:#475569;">${esc(order.customer.phone)}</div>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-bottom:4px;">Status</div>
      <div style="font-size:13px;font-weight:600;color:#042a36;">${esc(order.status)} · ${esc(order.payment_status)}</div>
      <div style="font-size:12px;color:#475569;margin-top:4px;">${order.items.length} line item(s)</div>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <thead><tr style="background:#042a36;color:#fff;">
      <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.08em;">#</th>
      <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.08em;">PRODUCT / GENERIC NAME</th>
      <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.08em;">MANUFACTURER</th>
      <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;letter-spacing:0.08em;">QTY</th>
      <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.08em;">BATCH NO.</th>
      <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.08em;">EXPIRY</th>
      <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.08em;">SHELF LOC.</th>
      <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;letter-spacing:0.08em;">✓ PICKED</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;">
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;margin-bottom:8px;">Picked by</div>
      <div style="height:1px;background:#cbd5e1;margin-bottom:4px;"></div>
      <div style="font-size:10px;color:#94a3b8;">Name &amp; Signature</div>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;margin-bottom:8px;">Checked by</div>
      <div style="height:1px;background:#cbd5e1;margin-bottom:4px;"></div>
      <div style="font-size:10px;color:#94a3b8;">Name &amp; Signature</div>
    </div>
  </div>
</div></body></html>`;
}

// ── WAYBILL / DELIVERY NOTE ──────────────────────────────────────────────────

function buildWaybillHTML(order: OrderDetail): string {
  const notes = parseNotes(order.notes);

  const rows = order.items.map((item, idx) => `
    <tr style="background:${idx%2===0?'#f8fafc':'#fff'};border-bottom:1px solid #e2e8f0;">
      <td style="padding:9px 12px;font-size:12px;color:#64748b;">${idx+1}</td>
      <td style="padding:9px 12px;">
        <div style="font-size:13px;font-weight:700;">${esc(item.product.brand_name)}</div>
        <div style="font-size:11px;color:#64748b;">${esc(item.product.generic_name)}${item.product.product_strength?` · ${esc(item.product.product_strength)}`:''}</div>
      </td>
      <td style="padding:9px 12px;text-align:center;font-size:14px;font-weight:800;color:#042a36;">${item.quantity}</td>
      <td style="padding:9px 12px;font-size:11px;font-family:monospace;">${esc(item.product.batch_number)??'—'}</td>
      <td style="padding:9px 12px;font-size:11px;color:${item.product.expiry_date?'#0f172a':'#94a3b8'};">${fmtExpiry(item.product.expiry_date)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Waybill ${esc(order.order_number)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a;background:#fff;padding:32px 40px;font-size:13px;line-height:1.5;}
@media print{body{padding:0;}@page{margin:15mm 15mm;size:A4 portrait;}.no-print{display:none!important;}}</style></head>
<body>
<div class="no-print" style="margin-bottom:20px;display:flex;gap:10px;">
  <button onclick="window.print()" style="background:#042a36;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">🖨️ Print Waybill</button>
  <button onclick="window.close()" style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;padding:10px 20px;border-radius:8px;font-size:13px;cursor:pointer;">Close</button>
</div>
<div style="max-width:800px;margin:0 auto;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #0d9488;">
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;margin-bottom:4px;">DELIVERY NOTE / WAYBILL</div>
      <div style="font-size:20px;font-weight:800;color:#042a36;">${SITE.legalName}</div>
      <div style="font-size:11px;color:#64748b;">EnvolveCare Express · Licensed Pharma Distributor</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:20px;font-weight:800;color:#0d9488;">WAYBILL</div>
      <div style="font-size:14px;font-weight:700;font-family:monospace;color:#042a36;">${esc(order.order_number)}</div>
      <div style="font-size:11px;color:#64748b;">Date: ${esc(formatDate(order.created_at))}</div>
      ${order.delivery?.tracking_code?`<div style="font-size:11px;font-family:monospace;color:#0d9488;">Tracking: ${esc(order.delivery.tracking_code)}</div>`:''}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:20px;">
    <div style="padding:14px;background:#f0fdfa;border-radius:10px;border:1px solid #99f6e4;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#0f766e;margin-bottom:8px;">Deliver To</div>
      <div style="font-size:15px;font-weight:800;color:#042a36;">${esc(order.customer.company_name)||esc(order.customer.first_name)+' '+esc(order.customer.last_name)}</div>
      <div style="font-size:12px;color:#0f172a;margin-top:4px;">${esc(order.delivery_address)}</div>
      <div style="font-size:12px;color:#0f172a;">${esc(order.delivery_city)}, ${esc(order.delivery_state)}</div>
      <div style="font-size:12px;color:#475569;margin-top:4px;">${esc(notes.contact_phone||order.customer.phone)}</div>
    </div>
    <div style="padding:14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-bottom:8px;">Despatch Info</div>
      <div style="font-size:12px;color:#475569;">Items: <strong>${order.item_count}</strong></div>
      <div style="font-size:12px;color:#475569;">Payment: <strong>${esc(order.payment_status)}</strong></div>
      ${notes.delivery_notes?`<div style="font-size:12px;color:#475569;margin-top:4px;">Note: ${esc(notes.delivery_notes)}</div>`:''}
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <thead><tr style="background:#042a36;color:#fff;">
      <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.08em;">#</th>
      <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.08em;">PRODUCT / GENERIC NAME</th>
      <th style="padding:9px 12px;text-align:center;font-size:10px;font-weight:700;letter-spacing:0.08em;">QTY</th>
      <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.08em;">BATCH NO.</th>
      <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.08em;">EXPIRY</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:40px;padding-top:20px;border-top:2px solid #e2e8f0;">
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;margin-bottom:16px;">Delivered by (Driver)</div>
      <div style="height:1px;background:#cbd5e1;margin-bottom:4px;"></div>
      <div style="font-size:10px;color:#94a3b8;">Name &amp; Signature</div>
      <div style="margin-top:20px;font-size:10px;color:#94a3b8;">Date: _______________</div>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;margin-bottom:16px;">Received by (Customer)</div>
      <div style="height:1px;background:#cbd5e1;margin-bottom:4px;"></div>
      <div style="font-size:10px;color:#94a3b8;">Name &amp; Signature</div>
      <div style="margin-top:20px;font-size:10px;color:#94a3b8;">Date: _______________</div>
    </div>
  </div>

  <div style="margin-top:24px;padding:10px 14px;background:#f8fafc;border-radius:8px;font-size:10px;color:#94a3b8;text-align:center;">
    This document serves as proof of delivery. By signing above, the receiver confirms receipt of all items listed in good condition.
  </div>
</div></body></html>`;
}

const LIMIT = 20;

type StatusTab = 'ALL' | 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
const TABS: { value: StatusTab; label: string }[] = [
  { value: 'ALL',        label: 'All'        },
  { value: 'PENDING',    label: 'Pending'    },
  { value: 'CONFIRMED',  label: 'Confirmed'  },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'DELIVERED',  label: 'Delivered'  },
  { value: 'CANCELLED',  label: 'Cancelled'  },
];

export function AdminOrdersView() {
  const qc    = useQueryClient();
  const toast = useToast();
  const { user } = useUser();
  const isAdmin = user?.role === 'ADMIN';

  const [tab,     setTab]     = useState<StatusTab>('ALL');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [panelId, setPanelId] = useState<number | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', String(LIMIT));
    if (tab !== 'ALL') p.set('status', tab);
    if (search.trim()) p.set('search', search.trim());
    return p;
  }, [page, tab, search]);

  const ordersQ = useQuery<{ data: { records: AdminOrder[]; pagination: { current_page: number; per_page: number; total: number; total_pages: number } } }>({
    queryKey:        ['admin-orders', params.toString()],
    queryFn:         () => fetch(`/api/orders?${params}`).then(r => r.json()),
    staleTime:       15_000,
    refetchInterval: 30_000,
  });

  // Payment status changes via the Paystack webhook with no user action at all,
  // so the open detail panel polls. Without this an admin watching an order
  // wait for payment would sit on "Unpaid" until they manually refreshed.
  const detailQ = useQuery<{ data: { order: OrderDetail } }>({
    queryKey:        ['admin-order', panelId],
    queryFn:         () => fetch(`/api/orders/${panelId}`).then(r => r.json()),
    enabled:         panelId != null,
    staleTime:       10_000,
    refetchInterval: panelId != null ? 20_000 : false,
  });

  const prefetchOrder = (id: number) => {
    qc.prefetchQuery({
      queryKey:  ['admin-order', id],
      queryFn:   () => fetch(`/api/orders/${id}`).then(r => r.json()),
      staleTime: 120_000,
    });
  };

  const detail = detailQ.data?.data?.order ?? null;

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`/api/orders/${id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: (data, vars) => {
      const ok = data.status === 'success';
      toast.show({
        tone:  ok ? 'success' : 'error',
        title: ok ? `Order moved to ${vars.status.charAt(0)+vars.status.slice(1).toLowerCase()}` : (data.message ?? 'Update failed'),
      });
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-order', vars.id] });
      // Bust deliveries cache so the deliveries page shows the new record immediately
      qc.invalidateQueries({ queryKey: ['admin-deliveries'] });
    },
    onError: () => toast.show({ tone: 'error', title: 'Network error — please try again' }),
  });

  // Payment status is fully automated via Paystack webhook — no manual mutation.

  const orders     = ordersQ.data?.data?.records ?? [];
  const pagInfo    = ordersQ.data?.data?.pagination;
  const totalPages = pagInfo?.total_pages ?? 1;

  const closePanel = () => setPanelId(null);

  return (
    <>
      {/* Stats strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total',      value: pagInfo?.total ?? '—', color: 'text-ink'      },
          { label: 'Pending',    value: orders.filter(o => o.status === 'PENDING').length,    color: 'text-amber-600'  },
          { label: 'Processing', value: orders.filter(o => o.status === 'PROCESSING').length, color: 'text-indigo-600' },
          { label: 'Delivered',  value: orders.filter(o => o.status === 'DELIVERED').length,  color: 'text-green-600'  },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-line bg-white px-4 py-3.5">
            <p className="text-xs font-medium text-ink-3">{label}</p>
            <p className={cn('num mt-1 text-2xl font-semibold tracking-tight', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + search */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="inline-flex flex-wrap rounded-lg bg-bg-muted p-1 gap-0.5">
          {TABS.map(t => (
            <button key={t.value} onClick={() => { setTab(t.value); setPage(1); }}
              className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                tab === t.value ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink')}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input type="search" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search order # or customer"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-teal-400 focus:outline-none" />
        </div>
        <button onClick={() => ordersQ.refetch()}
          className="flex h-9 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-xs font-medium text-ink-2 hover:border-teal-300 hover:text-teal-700 transition-colors">
          <Refresh size={13} className={ordersQ.isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Table */}
      {ordersQ.isLoading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-bg-muted" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-bg-muted text-ink-3"><Box size={24} /></span>
          <span className="text-base font-semibold text-ink">No orders found</span>
          <span className="text-sm text-ink-2">Try adjusting your filters.</span>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-subtle bg-bg-subtle text-left">
                  {['Order #', 'Customer', 'Items', 'Date', 'Status', 'Payment', 'Total', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {orders.map(o => (
                  <tr key={o.id} className="group hover:bg-bg-subtle/50 transition-colors"
                    onMouseEnter={() => prefetchOrder(o.id)}>
                    <td className="px-4 py-3.5"><span className="font-mono text-xs font-semibold text-ink">{o.order_number}</span></td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-ink">{o.customer.company_name || `${o.customer.first_name} ${o.customer.last_name}`}</p>
                      <p className="text-[11px] text-ink-3">{o.customer.email}</p>
                    </td>
                    <td className="px-4 py-3.5"><span className="text-sm text-ink-2">{o.item_count} {o.item_count===1?'item':'items'}</span></td>
                    <td className="px-4 py-3.5 text-xs text-ink-3">{formatDate(o.created_at)}</td>
                    <td className="px-4 py-3.5"><OrderStatusBadge status={o.status} /></td>
                    <td className="px-4 py-3.5"><PaymentBadge status={o.payment_status} /></td>
                    <td className="px-4 py-3.5"><span className="num text-sm font-semibold text-ink">{formatNaira(o.total)}</span></td>
                    <td className="px-4 py-3.5">
                      <button onClick={() => setPanelId(o.id)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:border-teal-300 hover:text-teal-700 transition-colors">
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-ink-3">Page {page} of {totalPages} · {pagInfo?.total} orders</p>
              <div className="flex gap-2">
                <button disabled={page<=1} onClick={() => setPage(p => p-1)}
                  className="flex h-8 items-center gap-1 rounded-md border border-line bg-white px-3 text-xs font-medium text-ink-2 hover:border-teal-300 disabled:cursor-not-allowed disabled:opacity-40">
                  <ChevronLeft size={12} /> Prev
                </button>
                <button disabled={page>=totalPages} onClick={() => setPage(p => p+1)}
                  className="flex h-8 items-center gap-1 rounded-md border border-line bg-white px-3 text-xs font-medium text-ink-2 hover:border-teal-300 disabled:cursor-not-allowed disabled:opacity-40">
                  Next <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Order detail slide-over */}
      {panelId != null && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={closePanel} />

          <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-sm font-bold text-ink truncate">{detail?.order_number ?? '…'}</span>
                {detail && <OrderStatusBadge status={detail.status} />}
                {detail && <PaymentBadge status={detail.payment_status} />}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {detail && (
                  <>
                    <button onClick={() => openDoc(buildInvoiceHTML(detail))}
                      title="Invoice"
                      className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:border-teal-300 hover:text-teal-700 transition-colors">
                      <FileText size={12} /> Invoice
                    </button>
                    <button onClick={() => openDoc(buildPicklistHTML(detail))}
                      title="Print picklist for warehouse"
                      className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:border-teal-300 hover:text-teal-700 transition-colors">
                      <Printer size={12} /> Pick list
                    </button>
                    <button onClick={() => openDoc(buildWaybillHTML(detail))}
                      title="Print waybill / delivery note for driver"
                      className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:border-teal-300 hover:text-teal-700 transition-colors">
                      <Truck size={12} /> Waybill
                    </button>
                  </>
                )}
                <button onClick={closePanel} className="grid h-8 w-8 place-items-center rounded-md hover:bg-bg-muted ml-1">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {detailQ.isLoading && !detail && (
                <div className="animate-pulse space-y-4">
                  {[...Array(6)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-bg-muted" />)}
                </div>
              )}

              {detail && (() => {
                const notes    = parseNotes(detail.notes);
                const vat      = notes.vat ?? 0;
                const nextStep = STEP_TRANSITION[detail.status];
                const stepIdx  = ORDER_STEPS.findIndex(s => s.status === detail.status);
                const isFinal  = detail.status === 'DELIVERED' || detail.status === 'CANCELLED';

                return (
                  <>
                    {/* ── Order Progress Stepper ─────────────────────────────────── */}
                    <section>
                      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3">Order progress</h3>

                      {/* Step indicator */}
                      <div className="mb-4 flex items-center gap-0">
                        {ORDER_STEPS.map((step, i) => {
                          const done    = i <  stepIdx;
                          const current = i === stepIdx;
                          const future  = i >  stepIdx;
                          return (
                            <div key={step.status} className="flex flex-1 items-center">
                              <div className="flex flex-col items-center">
                                <div className={cn(
                                  'grid h-8 w-8 place-items-center rounded-full text-sm font-bold border-2 transition-all',
                                  done    && 'bg-teal-500 border-teal-500 text-white',
                                  current && 'bg-brand-600 border-brand-600 text-white scale-110',
                                  future  && 'bg-white border-line text-ink-4',
                                )}>
                                  {done ? <Check size={14} /> : step.icon}
                                </div>
                                <span className={cn(
                                  'mt-1 text-center text-[9px] font-semibold leading-tight',
                                  done ? 'text-teal-600' : current ? 'text-brand-700' : 'text-ink-4',
                                )}>
                                  {step.label}
                                </span>
                              </div>
                              {i < ORDER_STEPS.length - 1 && (
                                <div className={cn(
                                  'h-0.5 flex-1 mx-1',
                                  i < stepIdx ? 'bg-teal-400' : 'bg-line',
                                )} />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Action panel */}
                      {!isFinal && nextStep ? (
                        <div className="rounded-xl border border-line bg-bg-subtle p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-ink">
                                Next: {STEP_ACTION_LABEL[detail.status]}
                              </p>
                              <p className="mt-0.5 text-xs text-ink-3">
                                {STEP_ACTION_DESC[detail.status]}
                              </p>
                            </div>
                            <button
                              disabled={statusMut.isPending}
                              onClick={() => {
                                if (window.confirm(`Move this order to "${ORDER_STYLE[nextStep]?.label}"? This cannot be undone.`)) {
                                  statusMut.mutate({ id: detail.id, status: nextStep });
                                }
                              }}
                              className={cn(
                                'shrink-0 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity',
                                (ORDER_STYLE[nextStep]?.bg ?? ''),
                                (ORDER_STYLE[nextStep]?.text ?? ''),
                                'hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40',
                              )}
                            >
                              <Check size={13} />
                              {STEP_ACTION_LABEL[detail.status]}
                            </button>
                          </div>
                          {/* Cancel is always available for non-final states (Admin only) */}
                          {isAdmin && (
                            <button
                              disabled={statusMut.isPending}
                              onClick={() => {
                                if (window.confirm('Cancel this order? This cannot be undone.')) {
                                  statusMut.mutate({ id: detail.id, status: 'CANCELLED' });
                                }
                              }}
                              className="mt-3 text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-40"
                            >
                              Cancel order
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className={cn(
                          'rounded-xl border p-3 text-sm font-medium',
                          detail.status === 'DELIVERED' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700',
                        )}>
                          {detail.status === 'DELIVERED' ? '✅ Order delivered successfully.' : '❌ Order cancelled.'}
                        </div>
                      )}

                      {/* Payment status.
                          Customer-placed orders are webhook-only. Orders a rep
                          placed on a customer's behalf can be confirmed here,
                          because offline collection has no gateway callback. */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-ink-3">Payment:</span>
                        <PaymentBadge status={detail.payment_status} />
                        {detail.placed_by && detail.payment_status !== 'PAID'
                          && detail.payment_status !== 'REFUNDED' && (
                          <ConfirmPaymentButton
                            orderId={detail.id}
                            orderNumber={detail.order_number}
                            onDone={() => {
                              void qc.invalidateQueries({ queryKey: ['admin-order', detail.id] });
                              void qc.invalidateQueries({ queryKey: ['admin-orders'] });
                            }}
                          />
                        )}
                      </div>

                      {detail.placed_by && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                          <User size={12} className="mt-0.5 shrink-0 text-violet-500" />
                          <p className="text-[11px] text-violet-800">
                            Placed on the customer&apos;s behalf by{' '}
                            <strong>{detail.placed_by.name}</strong> ({detail.placed_by.role})
                          </p>
                        </div>
                      )}
                    </section>

                    {/* ── Order items with pharma fields ─────────────────────── */}
                    <section>
                      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3">Items ({detail.items.length})</h3>
                      <div className="overflow-hidden rounded-xl border border-line divide-y divide-line-subtle">
                        {detail.items.map(item => (
                          <div key={item.id} className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-bg-muted">
                                {item.product.primary_image ? (
                                  <Image src={item.product.primary_image} alt={item.product.brand_name} width={80} height={80} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-ink-4"><Pill size={16} /></div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold text-ink">{item.product.brand_name}</p>
                                    <p className="text-[11px] text-ink-3">{item.product.generic_name}{item.product.product_strength ? ` · ${item.product.product_strength}` : ''}</p>
                                    {item.product.manufacturer && <p className="text-[10px] text-ink-4">{item.product.manufacturer}</p>}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-semibold text-ink">{formatNaira(item.subtotal)}</p>
                                    <p className="text-[11px] text-ink-3">{item.quantity} × {formatNaira(item.unit_price)}</p>
                                  </div>
                                </div>
                                {/* Pharma info row */}
                                <div className="mt-1.5 flex flex-wrap gap-2">
                                  {item.product.batch_number && (
                                    <span className="rounded-md bg-blue-50 border border-blue-100 px-2 py-0.5 font-mono text-[10px] text-blue-700">
                                      Batch: {item.product.batch_number}
                                    </span>
                                  )}
                                  {item.product.expiry_date && (
                                    <span className="rounded-md bg-amber-50 border border-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                                      Exp: {fmtExpiry(item.product.expiry_date)}
                                    </span>
                                  )}
                                  {item.product.shelf_location && (
                                    <span className="rounded-md bg-teal-50 border border-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                                      Shelf: {item.product.shelf_location}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {/* Totals */}
                        <div className="bg-bg-subtle px-4 py-3 space-y-1.5">
                          {[
                            { label: 'Subtotal',   value: formatNaira(detail.subtotal) },
                            { label: 'Delivery',   value: detail.delivery_fee===0?'Free':formatNaira(detail.delivery_fee) },
                            ...(vat>0?[{ label: 'VAT (7.5%)', value: formatNaira(vat) }]:[]),
                          ].map(({ label, value }) => (
                            <div key={label} className="flex justify-between text-xs text-ink-3">
                              <span>{label}</span><span className="num">{value}</span>
                            </div>
                          ))}
                          <div className="flex justify-between border-t border-line-subtle pt-2 text-sm font-semibold text-ink">
                            <span>Total</span><span className="num">{formatNaira(detail.total)}</span>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Customer + delivery */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <section className="rounded-xl border border-line p-4">
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3"><Building size={12}/>Customer</div>
                        <p className="text-sm font-semibold text-ink">{detail.customer.company_name || `${detail.customer.first_name} ${detail.customer.last_name}`}</p>
                        <p className="text-xs text-ink-2">{detail.customer.first_name} {detail.customer.last_name}</p>
                        <p className="mt-1 text-xs text-ink-3">{detail.customer.email}</p>
                        <p className="text-xs text-ink-3">{detail.customer.phone}</p>
                      </section>
                      <section className="rounded-xl border border-line p-4">
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3"><MapPin size={12}/>Delivery</div>
                        <p className="text-sm text-ink">{detail.delivery_address}</p>
                        <p className="text-xs text-ink-2">{detail.delivery_city}, {detail.delivery_state}</p>
                        {notes.contact_phone && <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-3"><Phone size={11}/>{notes.contact_phone}</div>}
                        {notes.delivery_notes && <p className="mt-2 text-xs italic text-ink-3">{notes.delivery_notes}</p>}
                      </section>
                    </div>

                    {/* References */}
                    <section className="rounded-xl border border-line p-4 space-y-2">
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">References</h3>
                      {[
                        { label: 'Payment ref', value: detail.payment_reference },
                        { label: 'PO number',   value: notes.po_number },
                        { label: 'Tracking',    value: detail.delivery?.tracking_code },
                      ].filter(r => r.value).map(({ label, value }) => (
                        <div key={label} className="flex justify-between text-xs">
                          <span className="text-ink-3">{label}</span>
                          <span className="font-mono font-medium text-ink">{value}</span>
                        </div>
                      ))}
                    </section>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
