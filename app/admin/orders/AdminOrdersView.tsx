'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Box, Eye, Printer, X, ChevronLeft, ChevronRight,
  Pill, MapPin, Phone, Building, Check, AlertTriangle, Refresh,
} from '@/components/icons';
import { formatNaira, formatDate, cn } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';

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
  id:       number;
  quantity: number;
  unit_price: number;
  subtotal:   number;
  product: {
    sku:          string;
    brand_name:   string;
    generic_name: string;
    primary_image:string | null;
  };
}

interface OrderDetail extends AdminOrder {
  items: DetailItem[];
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

function PaymentBadge({ status }: { status: string }) {
  const s = (PAY_STYLE[status] ?? PAY_STYLE['UNPAID'])!;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', s.bg, s.text)}>
      {s.label}
    </span>
  );
}

const TRANSITIONS: Record<string, string[]> = {
  PENDING:    ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:  ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED', 'CANCELLED'],
  DELIVERED:  [],
  CANCELLED:  [],
};

// What each transition does — shown as native tooltip on hover
const TRANSITION_HELP: Record<string, string> = {
  CONFIRMED:  'Confirm order — notifies warehouse to begin preparation',
  PROCESSING: 'Move to processing — warehouse is picking and packing',
  DISPATCHED: 'Mark dispatched — order is out for delivery with a driver',
  DELIVERED:  'Mark delivered — customer has received their package',
  CANCELLED:  'Cancel this order — this action cannot be undone once confirmed',
};
// Opens a fresh browser window with a self-contained HTML invoice and calls
// window.print() on it. Avoids the CSS-specificity trap where inline
// style={{ display:'none' }} always beats @media print { display:block !important }.

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildAdminInvoiceHTML(order: OrderDetail): string {
  const notes   = parseNotes(order.notes);
  const vat     = notes.vat ?? 0;
  const isPaid  = order.payment_status === 'PAID';

  const rows = order.items.map((item, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#f8fafc' : '#fff'};border-bottom:1px solid #e2e8f0;">
      <td style="padding:10px 12px;font-size:12px;color:#64748b;">${idx + 1}</td>
      <td style="padding:10px 12px;">
        <div style="font-size:13px;font-weight:600;color:#0f172a;">${esc(item.product.brand_name)}</div>
        <div style="font-size:11px;color:#64748b;">${esc(item.product.generic_name)}</div>
      </td>
      <td style="padding:10px 12px;font-size:11px;font-family:monospace;color:#64748b;">${esc(item.product.sku)}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;">${item.quantity}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;">${formatNaira(item.unit_price)}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:700;color:#042a36;">${formatNaira(item.subtotal)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${esc(order.order_number)}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:system-ui,-apple-system,'Segoe UI',sans-serif; color:#0f172a; background:#fff; padding:40px 48px; font-size:13px; line-height:1.5; }
    @media print {
      body { padding:0; }
      @page { margin:20mm 18mm; size:A4 portrait; }
      .no-print { display:none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:24px;display:flex;gap:10px;">
    <button onclick="window.print()" style="background:#042a36;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">🖨️ Print / Save PDF</button>
    <button onclick="window.close()" style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Close</button>
  </div>

  <div style="max-width:800px;margin:0 auto;">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2.5px solid #0d9488;">
      <div>
        <div style="font-size:22px;font-weight:800;color:#042a36;letter-spacing:-0.03em;">Envolve Pharmaceuticals</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;">EnvolveCare Express · Licensed Pharma Distributor</div>
        <div style="font-size:11px;color:#64748b;">Off Oworonshoki–Ogudu Expressway, Ogudu, Lagos</div>
        <div style="font-size:11px;color:#64748b;">orders@ece.envolvepharm.com.ng</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:28px;font-weight:800;color:#0d9488;letter-spacing:-0.04em;">INVOICE</div>
        <div style="font-size:14px;font-weight:700;margin-top:4px;font-family:monospace;color:#042a36;">${esc(order.order_number)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;">Date: ${esc(formatDate(order.created_at))}</div>
        ${notes.po_number ? `<div style="font-size:11px;color:#64748b;">PO #: ${esc(notes.po_number)}</div>` : ''}
      </div>
    </div>

    <!-- Bill to / Ship to -->
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
        ${notes.contact_phone ? `<div style="font-size:12px;color:#475569;">Tel: ${esc(notes.contact_phone)}</div>` : ''}
      </div>
    </div>

    <!-- Status pills -->
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px;">
      <div style="padding:6px 14px;border-radius:20px;border:1px solid #fbbf24;background:#fffbeb;font-size:11px;font-weight:700;color:#92400e;text-transform:capitalize;">
        Status: ${esc(order.status)}
      </div>
      <div style="padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;text-transform:capitalize;
           border:${isPaid ? '1px solid #34d399' : '1px solid #fb923c'};
           background:${isPaid ? '#ecfdf5' : '#fff7ed'};
           color:${isPaid ? '#065f46' : '#9a3412'};">
        Payment: ${esc(order.payment_status)}${isPaid ? ' ✓' : ''}
      </div>
      ${order.payment_reference ? `<div style="padding:6px 14px;border-radius:20px;border:1px solid #e2e8f0;background:#f8fafc;font-size:11px;color:#64748b;font-family:monospace;">Ref: ${esc(order.payment_reference)}</div>` : ''}
    </div>

    <!-- Items table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr style="background:#042a36;color:#fff;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.06em;">#</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.06em;">PRODUCT</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.06em;">SKU</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;letter-spacing:0.06em;">QTY</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;letter-spacing:0.06em;">UNIT PRICE</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;letter-spacing:0.06em;">SUBTOTAL</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <!-- Totals -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:32px;">
      <div style="width:290px;">
        <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;"><span>Subtotal</span><span style="font-family:monospace;">${formatNaira(order.subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;"><span>Delivery</span><span style="font-family:monospace;">${order.delivery_fee === 0 ? 'Free' : formatNaira(order.delivery_fee)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:12px;color:#475569;border-bottom:1px solid #e2e8f0;"><span>VAT (7.5%)</span><span style="font-family:monospace;">${formatNaira(vat)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:14px 16px;margin-top:10px;background:#042a36;border-radius:10px;color:#fff;">
          <span style="font-weight:700;font-size:15px;">TOTAL</span>
          <span style="font-weight:800;font-size:17px;font-family:monospace;">${formatNaira(order.total)}</span>
        </div>
      </div>
    </div>

    ${notes.delivery_notes ? `<div style="margin-bottom:24px;padding:10px 14px;background:#f0fdfa;border-radius:8px;border-left:3px solid #0d9488;font-size:12px;color:#0f766e;"><strong>Delivery instructions:</strong> ${esc(notes.delivery_notes)}</div>` : ''}

    <!-- Footer -->
    <div style="border-top:1px solid #e2e8f0;padding-top:16px;display:flex;justify-content:space-between;">
      <div style="font-size:10px;color:#94a3b8;line-height:1.7;">
        <div>Computer-generated invoice — no physical signature required.</div>
        <div>For queries: orders@ece.envolvepharm.com.ng</div>
      </div>
      <div style="font-size:10px;color:#94a3b8;text-align:right;">
        <div>EnvolveCare Express</div>
        <div>Licensed Pharma Distributor</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

const LIMIT = 20;

type StatusTab = 'ALL' | 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
const TABS: { value: StatusTab; label: string }[] = [
  { value: 'ALL',        label: 'All' },
  { value: 'PENDING',    label: 'Pending' },
  { value: 'CONFIRMED',  label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'DELIVERED',  label: 'Delivered' },
  { value: 'CANCELLED',  label: 'Cancelled' },
];

export function AdminOrdersView() {
  const qc    = useQueryClient();
  const toast = useToast();

  const [tab,     setTab]     = useState<StatusTab>('ALL');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [panelId, setPanelId] = useState<number | null>(null);

  // ── Orders list query ────────────────────────────────────────────────
  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', String(LIMIT));
    if (tab !== 'ALL') p.set('status', tab);
    if (search.trim()) p.set('search', search.trim());
    return p;
  }, [page, tab, search]);

  const ordersQ = useQuery<{ data: { records: AdminOrder[]; pagination: { current_page: number; per_page: number; total: number; total_pages: number } } }>({
    queryKey:       ['admin-orders', params.toString()],
    queryFn:        () => fetch(`/api/orders?${params}`).then(r => r.json()),
    staleTime:      30_000,
    refetchInterval: 60_000,   // auto-sync every 60 s in background
  });

  // ── Order detail query (for slide-over) ──────────────────────────────
  const detailQ = useQuery<{ data: { order: OrderDetail } }>({
    queryKey:  ['admin-order', panelId],
    queryFn:   () => fetch(`/api/orders/${panelId}`).then(r => r.json()),
    enabled:   panelId != null,
    staleTime: 120_000,   // keep cached for 2 min so prefetch hits are reused
  });

  // ── Hover-prefetch — start fetching detail the moment the user mouses over a row ──
  const prefetchOrder = (id: number) => {
    qc.prefetchQuery({
      queryKey:  ['admin-order', id],
      queryFn:   () => fetch(`/api/orders/${id}`).then(r => r.json()),
      staleTime: 120_000,
    });
  };

  const detail = detailQ.data?.data?.order ?? null;

  // ── Status mutation ───────────────────────────────────────────────────
  const statusMut = useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: string; notes?: string }) =>
      fetch(`/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      }).then(r => r.json()),
    onSuccess: (data, vars) => {
      // API returns { status: 'success' | 'error', message: '...' }
      const ok = data.status === 'success';
      toast.show({
        tone:  ok ? 'success' : 'error',
        title: ok ? `Order moved to ${vars.status.charAt(0) + vars.status.slice(1).toLowerCase()}` : (data.message ?? 'Update failed'),
      });
      // Always invalidate so the panel and list reflect reality
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-order', vars.id] });
    },
    onError: () => toast.show({ tone: 'error', title: 'Network error — please try again' }),
  });

  // ── Payment mutation ──────────────────────────────────────────────────
  const paymentMut = useMutation({
    mutationFn: ({ id, payment_status }: { id: number; payment_status: string }) =>
      fetch(`/api/orders/${id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status }),
      }).then(r => r.json()),
    onSuccess: (data, vars) => {
      const ok = data.status === 'success';
      toast.show({
        tone:  ok ? 'success' : 'error',
        title: ok ? `Payment marked as ${vars.payment_status.charAt(0) + vars.payment_status.slice(1).toLowerCase()}` : (data.message ?? 'Update failed'),
      });
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-order', vars.id] });
    },
    onError: () => toast.show({ tone: 'error', title: 'Network error — please try again' }),
  });

  const orders     = ordersQ.data?.data?.records ?? [];
  const pagInfo    = ordersQ.data?.data?.pagination;
  const totalPages = pagInfo?.total_pages ?? 1;

  const openPanel = (id: number) => setPanelId(id);
  const closePanel = () => setPanelId(null);

  const handlePrint = (o: OrderDetail) => {
    const html = buildAdminInvoiceHTML(o);
    const win  = window.open('', '_blank', 'width=900,height=720,scrollbars=yes');
    if (!win) { alert('Please allow pop-ups for this site to print the invoice.'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  };

  return (
    <>

      {/* ── Stats strip ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total',      value: pagInfo?.total ?? '—', color: 'text-ink'       },
          { label: 'Pending',    value: orders.filter(o => o.status === 'PENDING').length,    color: 'text-amber-600'   },
          { label: 'Processing', value: orders.filter(o => o.status === 'PROCESSING').length, color: 'text-indigo-600'  },
          { label: 'Delivered',  value: orders.filter(o => o.status === 'DELIVERED').length,  color: 'text-green-600'   },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-line bg-white px-4 py-3.5">
            <p className="text-xs font-medium text-ink-3">{label}</p>
            <p className={cn('num mt-1 text-2xl font-semibold tracking-tight', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs + search ── */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="inline-flex flex-wrap rounded-lg bg-bg-muted p-1 gap-0.5">
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => { setTab(t.value); setPage(1); }}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                tab === t.value ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search order # or customer email"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm placeholder:text-ink-4 focus:border-teal-400 focus:outline-none"
          />
        </div>

        <button
          onClick={() => { ordersQ.refetch(); }}
          className="flex h-9 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-xs font-medium text-ink-2 hover:border-teal-300 hover:text-teal-700 transition-colors"
        >
          <Refresh size={13} className={ordersQ.isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Table ── */}
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
                  <tr
                    key={o.id}
                    className="group hover:bg-bg-subtle/50 transition-colors"
                    onMouseEnter={() => prefetchOrder(o.id)}
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs font-semibold text-ink">{o.order_number}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-ink">{o.customer.company_name || `${o.customer.first_name} ${o.customer.last_name}`}</p>
                      <p className="text-[11px] text-ink-3">{o.customer.email}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-ink-2">{o.item_count} {o.item_count === 1 ? 'item' : 'items'}</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-ink-3">{formatDate(o.created_at)}</td>
                    <td className="px-4 py-3.5"><OrderStatusBadge status={o.status} /></td>
                    <td className="px-4 py-3.5"><PaymentBadge status={o.payment_status} /></td>
                    <td className="px-4 py-3.5">
                      <span className="num text-sm font-semibold text-ink">{formatNaira(o.total)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => openPanel(o.id)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:border-teal-300 hover:text-teal-700 transition-colors"
                        title="View full order details"
                      >
                        <Eye size={12} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-ink-3">
                Page {page} of {totalPages} · {pagInfo?.total} orders
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="flex h-8 items-center gap-1 rounded-md border border-line bg-white px-3 text-xs font-medium text-ink-2 hover:border-teal-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={12} /> Prev
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="flex h-8 items-center gap-1 rounded-md border border-line bg-white px-3 text-xs font-medium text-ink-2 hover:border-teal-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Order detail slide-over ── */}
      {panelId != null && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={closePanel} />

          {/* Panel */}
          <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-ink">{detail?.order_number ?? '…'}</span>
                {detail && <OrderStatusBadge status={detail.status} />}
                {detail && <PaymentBadge status={detail.payment_status} />}
              </div>
              <div className="flex items-center gap-2">
                {detail && (
                  <button
                    onClick={() => handlePrint(detail)}
                    className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:border-teal-300 hover:text-teal-700 transition-colors"
                  >
                    <Printer size={13} />
                    Print invoice
                  </button>
                )}
                <button onClick={closePanel} className="grid h-8 w-8 place-items-center rounded-md hover:bg-bg-muted">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Show skeleton only if there's no data at all — not when background-revalidating */}
              {detailQ.isLoading && !detail && (
                <div className="animate-pulse space-y-4">
                  {[...Array(6)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-bg-muted" />)}
                </div>
              )}

              {detail && (() => {
                const notes = parseNotes(detail.notes);
                const vat   = notes.vat ?? 0;
                const allowed = TRANSITIONS[detail.status] ?? [];

                return (
                  <>
                    {/* Action controls */}
                    <section>
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Actions</h3>
                      <div className="flex flex-wrap gap-2">
                        {/* Status transitions */}
                        {allowed.map(next => {
                          const s = (ORDER_STYLE[next] ?? ORDER_STYLE['PENDING'])!;
                          return (
                            <button
                              key={next}
                              disabled={statusMut.isPending}
                              onClick={() => statusMut.mutate({ id: detail.id, status: next })}
                              title={TRANSITION_HELP[next] ?? `Move order to ${s.label}`}
                              className={cn(
                                'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-opacity',
                                s.bg, s.text,
                                'hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40',
                              )}
                            >
                              <Check size={11} />
                              Move to {s.label}
                            </button>
                          );
                        })}

                        {/* Payment toggle */}
                        {detail.payment_status !== 'PAID' && (
                          <button
                            disabled={paymentMut.isPending}
                            onClick={() => paymentMut.mutate({ id: detail.id, payment_status: 'PAID' })}
                            title="Record payment received — marks this order as fully paid"
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Check size={11} />
                            Mark as Paid
                          </button>
                        )}
                        {detail.payment_status === 'PAID' && (
                          <button
                            disabled={paymentMut.isPending}
                            onClick={() => paymentMut.mutate({ id: detail.id, payment_status: 'UNPAID' })}
                            title="Revert payment status — customer still owes payment"
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <AlertTriangle size={11} />
                            Mark as Unpaid
                          </button>
                        )}
                      </div>
                    </section>

                    {/* Order items */}
                    <section>
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Items</h3>
                      <div className="overflow-hidden rounded-xl border border-line">
                        <div className="divide-y divide-line-subtle">
                          {detail.items.map(item => (
                            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-bg-muted">
                                {item.product.primary_image ? (
                                  <Image src={item.product.primary_image} alt={item.product.brand_name} width={80} height={80} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-ink-4">
                                    <Pill size={16} />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-ink">{item.product.brand_name}</p>
                                <p className="text-[11px] text-ink-3">{item.product.generic_name} · {item.product.sku}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-semibold text-ink">{formatNaira(item.subtotal)}</p>
                                <p className="text-[11px] text-ink-3">{item.quantity} × {formatNaira(item.unit_price)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Totals */}
                        <div className="border-t border-line-subtle bg-bg-subtle px-4 py-3 space-y-1.5">
                          {[
                            { label: 'Subtotal',     value: formatNaira(detail.subtotal) },
                            { label: 'Delivery',     value: detail.delivery_fee === 0 ? 'Free' : formatNaira(detail.delivery_fee) },
                            { label: 'VAT (7.5%)',   value: formatNaira(vat) },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex justify-between text-xs text-ink-3">
                              <span>{label}</span>
                              <span className="num">{value}</span>
                            </div>
                          ))}
                          <div className="flex justify-between border-t border-line-subtle pt-2 text-sm font-semibold text-ink">
                            <span>Total</span>
                            <span className="num">{formatNaira(detail.total)}</span>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Customer + delivery */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <section className="rounded-xl border border-line p-4">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">
                          <Building size={12} />Customer
                        </div>
                        <p className="text-sm font-semibold text-ink">{detail.customer.company_name || `${detail.customer.first_name} ${detail.customer.last_name}`}</p>
                        <p className="text-xs text-ink-2">{detail.customer.first_name} {detail.customer.last_name}</p>
                        <p className="mt-1 text-xs text-ink-3">{detail.customer.email}</p>
                        <p className="text-xs text-ink-3">{detail.customer.phone}</p>
                      </section>

                      <section className="rounded-xl border border-line p-4">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">
                          <MapPin size={12} />Delivery
                        </div>
                        <p className="text-sm text-ink">{detail.delivery_address}</p>
                        <p className="text-xs text-ink-2">{detail.delivery_city}, {detail.delivery_state}</p>
                        {notes.contact_phone && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
                            <Phone size={11} />{notes.contact_phone}
                          </div>
                        )}
                        {notes.delivery_notes && (
                          <p className="mt-2 text-xs italic text-ink-3">{notes.delivery_notes}</p>
                        )}
                      </section>
                    </div>

                    {/* Reference info */}
                    <section className="rounded-xl border border-line p-4 space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">References</h3>
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
