import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { Timeline, SectionPanel, type TimelineStep } from '@/components/shared/Timeline';
import {
  ArrowLeft,
  Truck,
  CheckCircle,
  Box,
  Phone,
  Calendar,
} from '@/components/icons';
import { ORDERS, DELIVERIES } from '@/lib/data/operational';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  DELIVERY_STATUS_LABEL,
} from '@/lib/constants';
import { formatNaira, formatDate, formatDateTime } from '@/lib/utils';
import type { DeliveryStatus, OrderStatus } from '@/types';

const ORDER_STAGES: OrderStatus[] = ['pending', 'confirmed', 'processing', 'dispatched', 'delivered'];
const DELIVERY_STAGES: { key: DeliveryStatus; label: string }[] = [
  { key: 'awaiting_dispatch', label: 'Awaiting dispatch' },
  { key: 'in_transit', label: 'In transit' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const order = ORDERS.find((o) => o.id === Number(id));
  return order ? { title: `Order ${order.order_number}` } : { title: 'Order' };
}

export default async function PortalOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = ORDERS.find((o) => o.id === Number(id));
  if (!order) notFound();

  const delivery = DELIVERIES.find((d) => d.order_id === order.id);
  const VAT_RATE = 0.075;
  const SHIP_FEE = order.total_amount >= 50_000 ? 0 : 2_500;
  const subtotal = order.items.reduce((acc, i) => acc + i.subtotal, 0);
  const vat = Math.round(subtotal * VAT_RATE);

  const orderSteps: TimelineStep[] =
    order.status === 'cancelled'
      ? [
          {
            key: 'final',
            label: ORDER_STATUS_LABEL[order.status],
            description: 'This order is no longer active.',
            when: formatDateTime(order.created_at),
            state: 'current',
          },
        ]
      : ORDER_STAGES.map((stage) => {
          const idx = ORDER_STAGES.indexOf(stage);
          const cur = ORDER_STAGES.indexOf(order.status);
          return {
            key: stage,
            label: ORDER_STATUS_LABEL[stage],
            description: idx === cur ? 'This is the current stage.' : undefined,
            state: idx < cur ? 'done' : idx === cur ? 'current' : 'pending',
          };
        });

  const deliverySteps: TimelineStep[] | null = delivery
    ? DELIVERY_STAGES.map((stage) => {
        const event = delivery.events.find((e) => e.status === stage.key);
        const reachedIdx = DELIVERY_STAGES.findIndex((s) => s.key === delivery.status);
        const idx = DELIVERY_STAGES.findIndex((s) => s.key === stage.key);
        return {
          key: stage.key,
          label: stage.label,
          description: event ? `${event.description}${event.location ? ` · ${event.location}` : ''}` : undefined,
          when: event ? formatDateTime(event.occurred_at) : undefined,
          state: idx < reachedIdx ? 'done' : idx === reachedIdx ? 'current' : 'pending',
        };
      })
    : null;

  return (
    <>
      <Link
        href="/portal/orders"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={14} /> Back to orders
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="font-mono text-base text-ink-2 tracking-wide">{order.order_number}</span>
          <h1 className="display-serif mt-1.5 text-[clamp(1.5rem,3vw,2rem)] tracking-tight text-ink">
            Order details
          </h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={12} /> {formatDate(order.created_at)}
            </span>
            <span>{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
          <Badge tone={PAYMENT_STATUS_TONE[order.payment_status]} noDot>
            {PAYMENT_STATUS_LABEL[order.payment_status]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {/* Items */}
          <SectionPanel
            title={<><Box size={14} /> Items</>}
            meta={
              <span className="text-xs text-ink-3">
                {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
              </span>
            }
          >
            <ul>
              {order.items.map((it) => (
                <li
                  key={it.id}
                  className="grid grid-cols-[56px_1fr_auto_auto] items-center gap-4 border-b border-line-subtle px-5 py-4 last:border-b-0"
                >
                  <div className="h-14 w-14 overflow-hidden rounded-md bg-bg-muted">
                    {it.product_image && (
                      <Image src={it.product_image} alt={it.product_name} width={120} height={120} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-ink">{it.product_name}</div>
                    <div className="mt-0.5 text-xs text-ink-3">
                      {it.product_sku} · {formatNaira(it.price)} each
                    </div>
                  </div>
                  <span className="num text-sm text-ink-2">×{it.quantity}</span>
                  <span className="num font-display text-base">{formatNaira(it.subtotal)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-line-subtle bg-bg-subtle p-5">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-ink-2">
                  <span>Subtotal</span><span className="num">{formatNaira(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-ink-2">
                  <span>Shipping</span>
                  <span className="num">{SHIP_FEE === 0 ? 'Free' : formatNaira(SHIP_FEE)}</span>
                </div>
                <div className="flex justify-between text-sm text-ink-2">
                  <span>VAT (7.5%)</span><span className="num">{formatNaira(vat)}</span>
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-sm font-medium text-ink">Total</span>
                <span className="num font-display text-2xl tracking-tight text-ink">{formatNaira(order.total_amount)}</span>
              </div>
            </div>
          </SectionPanel>

          {/* Order timeline */}
          <SectionPanel title={<><CheckCircle size={14} /> Order progress</>}>
            <div className="px-5 py-4">
              <Timeline steps={orderSteps} />
            </div>
          </SectionPanel>

          {/* Delivery */}
          {delivery && deliverySteps && (
            <SectionPanel
              title={<><Truck size={14} /> Shipment · <span className="font-mono text-xs">{delivery.tracking_code}</span></>}
              meta={<Badge tone="info" noDot>{DELIVERY_STATUS_LABEL[delivery.status]}</Badge>}
            >
              <div className="px-5 py-4">
                <Timeline steps={deliverySteps} />
              </div>
            </SectionPanel>
          )}
        </div>

        {/* Aside */}
        <aside className="sticky top-20 flex flex-col gap-4 self-start">
          {delivery && (
            <div className="rounded-xl border border-line bg-white p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Driver</h3>
              <div className="mt-3 text-sm leading-relaxed">
                <strong className="block font-medium text-ink">{delivery.driver_name}</strong>
                <span className="text-ink-2">
                  <Phone size={11} className="-mt-0.5 mr-1 inline" />{delivery.driver_phone}
                </span>
                <span className="mt-1 block text-ink-2">
                  Vehicle: <strong className="font-medium text-ink">{delivery.vehicle_plate}</strong>
                </span>
                {delivery.estimated_arrival && (
                  <span className="mt-2 block text-ink-2">
                    ETA: <strong className="font-medium text-ink">{formatDate(delivery.estimated_arrival)}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-line bg-white p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Payment</h3>
            <dl className="mt-3 flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">Status</dt>
                <dd className="font-medium text-ink">{PAYMENT_STATUS_LABEL[order.payment_status]}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">Method</dt>
                <dd className="font-medium text-ink capitalize">{order.payment?.payment_method.replace('_', ' ') ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">Reference</dt>
                <dd className="font-mono text-xs text-ink">{order.payment?.reference ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-line bg-white p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Need help?</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Issues with this order? Our customer success team is on call Mon–Fri 08:00–18:00.
            </p>
            <ButtonLink href="/contact" variant="secondary" size="sm" fullWidth className="mt-3">
              Contact support
            </ButtonLink>
          </div>
        </aside>
      </div>
    </>
  );
}
