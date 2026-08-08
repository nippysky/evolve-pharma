'use client';
import { Printer } from '@/components/icons';
import { formatNaira, formatDate } from '@/lib/utils';
import { SITE } from '@/lib/constants';

export interface OrderDetailForPrint {
  order_number:      string;
  status:            string;
  payment_status:    string;
  payment_reference: string | null;
  created_at:        string;
  subtotal:          number;
  delivery_fee:      number;
  vat:               number;
  total:             number;
  contact_phone:     string;
  po_number?:        string | null;
  delivery_notes?:   string | null;
  delivery_address:  string;
  delivery_city:     string;
  delivery_state:    string;
  customer: {
    company_name: string;
    first_name:   string;
    last_name:    string;
    email:        string;
    phone:        string;
  };
  items: {
    id:           number;
    brand_name:   string;
    generic_name: string;
    sku:          string;
    pack_size?:        string | null;
    product_strength?: string | null;
    batch_number?:     string | null;
    expiry_date?:      string | Date | null;
    quantity:     number;
    unit_price:   number;
    subtotal:     number;
  }[];
}

function buildInvoiceHTML(order: OrderDetailForPrint): string {
  const isPaid   = order.payment_status === 'paid' || order.payment_status === 'PAID';
  const fmtExpiry = (d: string | Date | null | undefined): string => {
    if (!d) return '—';
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const rows     = order.items.map((item, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#f8fafc' : '#fff'};border-bottom:1px solid #e2e8f0;">
      <td style="padding:10px 12px;font-size:12px;color:#64748b;">${idx + 1}</td>
      <td style="padding:10px 12px;">
        <div style="font-size:13px;font-weight:600;color:#0f172a;">${escHtml(item.brand_name)}</div>
        <div style="font-size:11px;color:#64748b;">
          ${escHtml(item.generic_name)}${item.pack_size ? ` · ${escHtml(item.pack_size)}` : ''}${item.product_strength ? ` · ${escHtml(item.product_strength)}` : ''}
        </div>
      </td>
      <td style="padding:10px 12px;font-size:11px;font-family:monospace;color:#64748b;">${escHtml(item.sku)}</td>
      <td style="padding:10px 12px;font-size:11px;font-family:monospace;color:#475569;">
        ${item.batch_number ? escHtml(item.batch_number) : '—'}
      </td>
      <td style="padding:10px 12px;font-size:11px;color:#475569;">
        ${fmtExpiry(item.expiry_date)}
      </td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;">${item.quantity}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;">${formatNaira(item.unit_price)}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:700;color:#042a36;">${formatNaira(item.subtotal)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice ${escHtml(order.order_number)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      color: #0f172a;
      background: #fff;
      padding: 40px 48px;
      font-size: 13px;
      line-height: 1.5;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 20mm 18mm; size: A4 portrait; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- Print / Close buttons (hidden in print) -->
  <div class="no-print" style="margin-bottom:24px;display:flex;gap:10px;">
    <button onclick="window.print()"
      style="background:#042a36;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
      🖨️ Print / Save PDF
    </button>
    <button onclick="window.close()"
      style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
      Close
    </button>
  </div>

  <!-- Invoice card -->
  <div style="max-width:800px;margin:0 auto;background:#fff;">

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2.5px solid #0d9488;">
      <div>
        <div style="font-size:22px;font-weight:800;color:#042a36;letter-spacing:-0.03em;">
          ${SITE.legalName}
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;">EnvolveCare Express · Licensed Pharma Distributor</div>
        <div style="font-size:11px;color:#64748b;">${SITE.address}</div>
        <div style="font-size:11px;color:#64748b;">${SITE.email} · ${SITE.phone}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:28px;font-weight:800;color:#0d9488;letter-spacing:-0.04em;">INVOICE</div>
        <div style="font-size:14px;font-weight:700;margin-top:4px;font-family:monospace;color:#042a36;">
          ${escHtml(order.order_number)}
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;">Date: ${escHtml(formatDate(order.created_at))}</div>
        ${order.po_number ? `<div style="font-size:11px;color:#64748b;">PO #: ${escHtml(order.po_number)}</div>` : ''}
      </div>
    </div>

    <!-- Bill to / Ship to -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;">
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;margin-bottom:8px;">
          Bill To
        </div>
        <div style="font-size:14px;font-weight:700;color:#0f172a;">${escHtml(order.customer.company_name)}</div>
        <div style="font-size:12px;color:#475569;margin-top:2px;">${escHtml(order.customer.first_name)} ${escHtml(order.customer.last_name)}</div>
        <div style="font-size:12px;color:#475569;">${escHtml(order.customer.email)}</div>
        <div style="font-size:12px;color:#475569;">${escHtml(order.customer.phone)}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;margin-bottom:8px;">
          Ship To
        </div>
        <div style="font-size:14px;font-weight:700;color:#0f172a;">${escHtml(order.customer.company_name)}</div>
        <div style="font-size:12px;color:#475569;margin-top:2px;">${escHtml(order.delivery_address)}</div>
        <div style="font-size:12px;color:#475569;">${escHtml(order.delivery_city)}, ${escHtml(order.delivery_state)}</div>
        ${order.contact_phone ? `<div style="font-size:12px;color:#475569;">Tel: ${escHtml(order.contact_phone)}</div>` : ''}
      </div>
    </div>

    <!-- Status pills -->
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px;">
      <div style="padding:6px 14px;border-radius:20px;border:1px solid #fbbf24;background:#fffbeb;font-size:11px;font-weight:700;color:#92400e;text-transform:capitalize;">
        Status: ${escHtml(order.status)}
      </div>
      <div style="padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;text-transform:capitalize;
           border:${isPaid ? '1px solid #34d399' : '1px solid #fb923c'};
           background:${isPaid ? '#ecfdf5' : '#fff7ed'};
           color:${isPaid ? '#065f46' : '#9a3412'};">
        Payment: ${escHtml(order.payment_status)}${isPaid ? ' ✓' : ''}
      </div>
      ${order.payment_reference ? `
      <div style="padding:6px 14px;border-radius:20px;border:1px solid #e2e8f0;background:#f8fafc;font-size:11px;color:#64748b;font-family:monospace;">
        Ref: ${escHtml(order.payment_reference)}
      </div>` : ''}
    </div>

    <!-- Items table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr style="background:#042a36;color:#fff;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.06em;border-radius:4px 0 0 0;">#</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.06em;">PRODUCT</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.06em;">SKU</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.06em;">BATCH NO.</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.06em;">EXPIRY</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;letter-spacing:0.06em;">QTY</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;letter-spacing:0.06em;">UNIT PRICE</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;letter-spacing:0.06em;border-radius:0 4px 0 0;">SUBTOTAL</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <!-- Totals -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:32px;">
      <div style="width:290px;">
        <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;">
          <span>Subtotal</span><span style="font-family:monospace;">${formatNaira(order.subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;">
          <span>Delivery fee</span>
          <span style="font-family:monospace;">${order.delivery_fee === 0 ? 'Free' : formatNaira(order.delivery_fee)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:12px;color:#475569;border-bottom:1px solid #e2e8f0;">
          <span>VAT (7.5%)</span><span style="font-family:monospace;">${formatNaira(order.vat)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:14px 16px;margin-top:10px;background:#042a36;border-radius:10px;color:#fff;">
          <span style="font-weight:700;font-size:15px;">TOTAL</span>
          <span style="font-weight:800;font-size:17px;font-family:monospace;">${formatNaira(order.total)}</span>
        </div>
      </div>
    </div>

    ${order.delivery_notes ? `
    <div style="margin-bottom:24px;padding:10px 14px;background:#f0fdfa;border-radius:8px;border-left:3px solid #0d9488;font-size:12px;color:#0f766e;">
      <strong>Delivery instructions:</strong> ${escHtml(order.delivery_notes)}
    </div>` : ''}

    <!-- Footer -->
    <div style="border-top:1px solid #e2e8f0;padding-top:16px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="font-size:10px;color:#94a3b8;line-height:1.7;">
        <div>This is a computer-generated invoice and does not require a physical signature.</div>
        <div>For queries: ${SITE.email} · ${SITE.phone}</div>
      </div>
      <div style="font-size:10px;color:#94a3b8;text-align:right;">
        <div>${SITE.legalName}</div>
        <div>NAFDAC Licensed Distributor</div>
      </div>
    </div>

  </div><!-- /invoice card -->
</body>
</html>`;
}

function escHtml(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

interface Props {
  order: OrderDetailForPrint;
  label?: string;
}

export function PrintOrderButton({ order, label = 'Print / Save PDF' }: Props) {
  const handlePrint = () => {
    const html = buildInvoiceHTML(order);
    const win  = window.open('', '_blank', 'width=900,height=720,scrollbars=yes');
    if (!win) {
      alert('Please allow pop-ups for this site to print the invoice.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    // Small delay lets the new window's fonts + layout settle before print dialog
    setTimeout(() => {
      win.print();
    }, 350);
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink-2 shadow-sm hover:border-teal-300 hover:text-teal-700 transition-colors"
    >
      <Printer size={14} />
      {label}
    </button>
  );
}
