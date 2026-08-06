export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSession }       from '@/lib/auth';
import { getOrderDetail }   from '@/lib/data/orders.server';
import { formatNaira, formatDate } from '@/lib/utils';
import { PageHead }          from '@/components/shared/PageHead';
import { PrintOrderButton }  from '@/components/portal/PrintOrderButton';
import { ArrowLeft, Box, MapPin, Phone, Building, Pill, Calendar, Tag } from '@/components/icons';

const ORDER_STYLE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pending:    { bg: 'bg-amber-50 border border-amber-200',   text: 'text-amber-800',  dot: 'bg-amber-400',  label: 'Pending'    },
  confirmed:  { bg: 'bg-blue-50 border border-blue-200',     text: 'text-blue-800',   dot: 'bg-blue-500',   label: 'Confirmed'  },
  processing: { bg: 'bg-indigo-50 border border-indigo-200', text: 'text-indigo-800', dot: 'bg-indigo-500', label: 'Processing' },
  dispatched: { bg: 'bg-teal-50 border border-teal-200',     text: 'text-teal-800',   dot: 'bg-teal-500',   label: 'In transit' },
  delivered:  { bg: 'bg-green-50 border border-green-200',   text: 'text-green-800',  dot: 'bg-green-500',  label: 'Delivered'  },
  cancelled:  { bg: 'bg-red-50 border border-red-200',       text: 'text-red-800',    dot: 'bg-red-400',    label: 'Cancelled'  },
};

const PAY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  unpaid:   { bg: 'bg-orange-50 border border-orange-200',   text: 'text-orange-800', label: 'Unpaid'   },
  partial:  { bg: 'bg-yellow-50 border border-yellow-200',   text: 'text-yellow-800', label: 'Partial'  },
  paid:     { bg: 'bg-emerald-50 border border-emerald-200', text: 'text-emerald-800',label: 'Paid ✓'   },
  refunded: { bg: 'bg-purple-50 border border-purple-200',   text: 'text-purple-800', label: 'Refunded' },
  failed:   { bg: 'bg-red-50 border border-red-200',         text: 'text-red-800',    label: 'Failed'   },
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const orderId = parseInt(id, 10);

  const session = await getSession();
  if (!session || session.role !== 'CUSTOMER') redirect('/sign-in');

  if (isNaN(orderId)) notFound();

  const order = await getOrderDetail(orderId, session.userId);
  if (!order) notFound();

  const os = ORDER_STYLE[order.status]           ?? ORDER_STYLE['pending']!;
  const ps = PAY_STYLE[order.payment_status]     ?? PAY_STYLE['unpaid']!;

  return (
    <>
      <PrintOrderButton order={order} />

      <PageHead
        title={order.order_number}
        subtitle={`Placed on ${formatDate(order.created_at)}`}
        actions={
          <Link
            href="/portal/orders"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} />
            Back to orders
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

        {/* ── Left: items + totals ── */}
        <div className="space-y-5">

          {/* Items table */}
          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
              <h2 className="text-sm font-semibold tracking-tight text-ink">Order items</h2>
              <span className="text-xs text-ink-3">{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</span>
            </div>
            <div className="divide-y divide-line-subtle">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-bg-muted">
                    {item.image ? (
                      <Image src={item.image} alt={item.brand_name} width={112} height={112} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-ink-4">
                        <Pill size={20} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{item.brand_name}</p>
                    <p className="text-xs text-ink-3">
                      {item.generic_name}
                      {item.product_strength ? ` · ${item.product_strength}` : ''}
                      {item.pack_size ? ` · ${item.pack_size}` : ''}
                    </p>
                    {item.manufacturer && (
                      <p className="text-[10px] text-ink-4">{item.manufacturer}</p>
                    )}
                    <p className="mt-0.5 text-[11px] font-mono text-ink-4">{item.sku}</p>
                    {/* Pharma batch / expiry info */}
                    {(item.batch_number || item.expiry_date) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {item.batch_number && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-mono text-blue-700">
                            <Tag size={9} />
                            Batch: {item.batch_number}
                          </span>
                        )}
                        {item.expiry_date && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                            <Calendar size={9} />
                            Exp: {new Date(item.expiry_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">{formatNaira(item.subtotal)}</p>
                    <p className="text-[11px] text-ink-3">{item.quantity} × {formatNaira(item.unit_price)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Totals */}
          <section className="overflow-hidden rounded-xl border border-line bg-white px-5 py-4">
            <h2 className="mb-4 text-sm font-semibold tracking-tight text-ink">Order summary</h2>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm text-ink-2">
                <span>Subtotal</span>
                <span className="num">{formatNaira(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-ink-2">
                <span>Delivery</span>
                <span className="num">{order.delivery_fee === 0 ? 'Free' : formatNaira(order.delivery_fee)}</span>
              </div>
              <div className="flex justify-between text-sm text-ink-2">
                <span>VAT (7.5%)</span>
                <span className="num">{formatNaira(order.vat)}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line-subtle pt-4">
              <span className="text-sm font-semibold text-ink">Total</span>
              <span className="num font-display text-2xl font-bold tracking-tight text-ink">{formatNaira(order.total)}</span>
            </div>
          </section>
        </div>

        {/* ── Right: status + delivery info ── */}
        <div className="space-y-4">

          {/* Status card */}
          <section className="rounded-xl border border-line bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold tracking-tight text-ink">Order status</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-3">Status</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${os!.bg} ${os!.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${os!.dot}`} />
                  {os!.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-3">Payment</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${ps!.bg} ${ps!.text}`}>
                  {ps!.label}
                </span>
              </div>
              {order.payment_reference && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-ink-3">Reference</span>
                  <span className="text-right font-mono text-[11px] text-ink-2">{order.payment_reference}</span>
                </div>
              )}
              {order.delivery?.tracking_code && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-ink-3">Tracking</span>
                  <span className="text-right font-mono text-[11px] text-ink-2">{order.delivery.tracking_code}</span>
                </div>
              )}
            </div>
          </section>

          {/* Delivery address */}
          <section className="rounded-xl border border-line bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <MapPin size={14} className="text-ink-3" />
              <h2 className="text-sm font-semibold tracking-tight text-ink">Delivery address</h2>
            </div>
            <div className="space-y-1 text-sm text-ink-2">
              <p className="font-medium text-ink">{order.customer.company_name}</p>
              <p>{order.delivery_address}</p>
              <p>{order.delivery_city}, {order.delivery_state}</p>
            </div>
            {order.contact_phone && (
              <div className="mt-3 flex items-center gap-2 text-xs text-ink-3">
                <Phone size={12} />
                <span>{order.contact_phone}</span>
              </div>
            )}
            {order.delivery_notes && (
              <p className="mt-3 rounded-lg bg-bg-subtle px-3 py-2 text-xs text-ink-2 italic">{order.delivery_notes}</p>
            )}
          </section>

          {/* Customer info */}
          <section className="rounded-xl border border-line bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <Building size={14} className="text-ink-3" />
              <h2 className="text-sm font-semibold tracking-tight text-ink">Customer details</h2>
            </div>
            <div className="space-y-1 text-sm text-ink-2">
              <p className="font-medium text-ink">{order.customer.first_name} {order.customer.last_name}</p>
              {order.customer.company_name && <p className="text-xs text-ink-3">{order.customer.company_name}</p>}
              <p>{order.customer.email}</p>
            </div>
          </section>

          {order.po_number && (
            <div className="rounded-xl border border-line bg-white px-5 py-4">
              <p className="text-xs text-ink-3">PO Number</p>
              <p className="mt-1 font-mono text-sm font-medium text-ink">{order.po_number}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
