'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, MapPin, Phone, Package, AlertTriangle, Check } from '@/components/icons';
import { formatNaira, formatDate, cn } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';

interface DriverDelivery {
  id:            number;
  tracking_code: string;
  status:        string;
  dispatched_at: string | null;
  delivered_at:  string | null;
  notes:         string | null;
  order: {
    id:               number;
    order_number:     string;
    delivery_address: string;
    delivery_city:    string;
    delivery_state:   string;
    total:            number;
    customer: {
      company_name: string | null;
      first_name:   string;
      last_name:    string;
      phone:        string;
    } | null;
  } | null;
}

interface ApiListResponse {
  status:  string;
  data: {
    records:    DriverDelivery[];
    pagination: { total: number };
  };
}

const STATUS_STYLE: Record<string, { bg: string; dot: string; text: string; label: string }> = {
  ASSIGNED:         { bg: 'bg-amber-50 border border-amber-200',    dot: 'bg-amber-400',   text: 'text-amber-800',   label: 'Assigned'          },
  IN_TRANSIT:       { bg: 'bg-blue-50 border border-blue-200',      dot: 'bg-blue-500',    text: 'text-blue-800',    label: 'In Transit'        },
  OUT_FOR_DELIVERY: { bg: 'bg-indigo-50 border border-indigo-200',  dot: 'bg-indigo-500',  text: 'text-indigo-800',  label: 'Out for Delivery'  },
  DELIVERED:        { bg: 'bg-green-50 border border-green-200',    dot: 'bg-green-500',   text: 'text-green-800',   label: 'Delivered'         },
  FAILED:           { bg: 'bg-red-50 border border-red-200',        dot: 'bg-red-400',     text: 'text-red-800',     label: 'Failed'            },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: 'bg-slate-50 border border-slate-200', dot: 'bg-slate-400', text: 'text-slate-700', label: status };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', s.bg, s.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

const DRIVER_NEXT: Record<string, { status: string; label: string; primary: boolean; hint?: string }[]> = {
  ASSIGNED:         [
    { status: 'IN_TRANSIT',       label: '🚚 I\'ve picked up the goods',    primary: true  },
  ],
  IN_TRANSIT:       [
    { status: 'OUT_FOR_DELIVERY', label: '📦 I\'m at the delivery address', primary: true  },
    { status: 'FAILED',           label: 'I can\'t complete this delivery',  primary: false },
  ],
  OUT_FOR_DELIVERY: [
    { status: 'DELIVERED',        label: '✓ Delivery completed',            primary: true  },
    { status: 'FAILED',           label: 'Customer not available',           primary: false },
  ],
};

function DeliveryCard({ delivery }: { delivery: DriverDelivery }) {
  const toast = useToast();
  const qc    = useQueryClient();

  const nextActions = DRIVER_NEXT[delivery.status] ?? [];

  const statusMut = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/deliveries/${delivery.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      });
      return res.json();
    },
    onSuccess: (data, newStatus) => {
      const ok = data.status === 'success';
      const label = STATUS_STYLE[newStatus]?.label ?? newStatus;
      toast.show({
        tone:  ok ? 'success' : 'error',
        title: ok ? `Status updated to ${label}` : (data.message ?? 'Update failed'),
      });
      // Always invalidate — outside of ok check
      qc.invalidateQueries({ queryKey: ['driver-deliveries'] });
      qc.invalidateQueries({ queryKey: ['driver-history'] });
    },
    onError: () => {
      toast.show({ tone: 'error', title: 'Network error. Please try again.' });
      qc.invalidateQueries({ queryKey: ['driver-deliveries'] });
    },
  });

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      {/* Header row */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-ink-3">{delivery.tracking_code}</p>
          <p className="mt-0.5 font-semibold text-ink">{delivery.order?.order_number ?? '—'}</p>
        </div>
        <StatusBadge status={delivery.status} />
      </div>

      {/* Customer */}
      {delivery.order?.customer && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <Package size={14} className="shrink-0 text-ink-3" />
          <span className="font-medium text-ink">
            {delivery.order.customer.company_name
              ?? `${delivery.order.customer.first_name} ${delivery.order.customer.last_name}`}
          </span>
        </div>
      )}

      {/* Destination */}
      {delivery.order && (
        <div className="mb-3 flex items-start gap-2 text-sm">
          <MapPin size={14} className="mt-0.5 shrink-0 text-ink-3" />
          <span className="text-ink-2">
            {delivery.order.delivery_address}, {delivery.order.delivery_city}, {delivery.order.delivery_state}
          </span>
        </div>
      )}

      {/* Contact phone */}
      {delivery.order?.customer?.phone && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <Phone size={14} className="shrink-0 text-ink-3" />
          <a
            href={`tel:${delivery.order.customer.phone}`}
            className="text-brand-600 hover:underline"
          >
            {delivery.order.customer.phone}
          </a>
        </div>
      )}

      {/* Order value + dispatched */}
      <div className="mb-4 flex items-center justify-between rounded-xl bg-bg-subtle px-3 py-2 text-sm">
        <span className="text-ink-3">Order value</span>
        <span className="font-semibold text-ink">
          {delivery.order ? formatNaira(delivery.order.total) : '—'}
        </span>
      </div>

      {/* Notes */}
      {delivery.notes && (
        <p className="mb-4 rounded-lg border border-line bg-bg-subtle px-3 py-2 text-xs text-ink-2">
          {delivery.notes}
        </p>
      )}

      {/* Action buttons */}
      {nextActions.length > 0 && (
        <div className="flex flex-col gap-2">
          {nextActions.map(action => (
            <button
              key={action.status}
              type="button"
              disabled={statusMut.isPending}
              onClick={() => statusMut.mutate(action.status)}
              className={cn(
                'rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60',
                action.primary
                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                  : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200',
              )}
            >
              {statusMut.isPending ? 'Updating…' : action.label}
            </button>
          ))}
        </div>
      )}

      {/* Terminal state */}
      {delivery.status === 'DELIVERED' && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2.5">
          <Check size={16} className="text-green-600" />
          <span className="text-sm font-medium text-green-700">
            Delivered {delivery.delivered_at ? formatDate(delivery.delivered_at) : ''}
          </span>
        </div>
      )}
    </div>
  );
}

function KpiStrip({ records }: { records: DriverDelivery[] }) {
  const active     = records.filter(d => !['DELIVERED', 'FAILED', 'RETURNED'].includes(d.status)).length;
  const inTransit  = records.filter(d => d.status === 'IN_TRANSIT').length;
  const outFor     = records.filter(d => d.status === 'OUT_FOR_DELIVERY').length;

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      {[
        { label: 'Active deliveries', value: String(active)   },
        { label: 'In transit',        value: String(inTransit) },
        { label: 'Out for delivery',  value: String(outFor)   },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-xl border border-line bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</div>
          <div className="num mt-1 font-display text-2xl tracking-tight text-ink">{value}</div>
        </div>
      ))}
    </div>
  );
}
// History page shows DELIVERED / FAILED / RETURNED
const ACTIVE_STATUSES = ['ASSIGNED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];

export default function DriverAssignmentsClient() {
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery<ApiListResponse>({
    queryKey: ['driver-deliveries'],
    queryFn:  async () => {
      const res = await fetch('/api/deliveries?limit=50');
      return res.json();
    },
    staleTime:      20_000,
    refetchInterval: 60_000, // auto-refresh every 60s
  });

  const allRecords = data?.data?.records ?? [];
  // Show active + failed (driver may need to see recent failures)
  const active = allRecords.filter(d => ACTIVE_STATUSES.includes(d.status));
  const failed = allRecords.filter(d => d.status === 'FAILED');

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-ink-3">
        <AlertTriangle size={20} />
        <p>Failed to load deliveries. Refresh to try again.</p>
      </div>
    );
  }

  return (
    <>
      <KpiStrip records={allRecords} />

      {active.length === 0 && failed.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-white text-sm text-ink-3">
          <Truck size={24} className="opacity-40" />
          <p>No active assignments right now.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...active, ...failed].map(d => (
            <DeliveryCard key={d.id} delivery={d} />
          ))}
        </div>
      )}
    </>
  );
}
