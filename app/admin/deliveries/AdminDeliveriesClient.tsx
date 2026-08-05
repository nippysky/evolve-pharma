import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck, Eye, X, ChevronLeft, ChevronRight,
  MapPin, Phone, Building, Check, AlertTriangle,
  Search, User,
} from '@/components/icons';
import { formatNaira, formatDate, cn } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';

interface AdminDelivery {
  id:            number;
  uuid:          string;
  tracking_code: string;
  status:        string;
  dispatched_at: string | null;
  delivered_at:  string | null;
  notes:         string | null;
  created_at:    string;
  order: {
    id:               number;
    order_number:     string;
    order_status:     string;
    delivery_address: string;
    delivery_city:    string;
    delivery_state:   string;
    total:            number;
    customer: {
      company_name: string | null;
      first_name:   string;
      last_name:    string;
      email:        string;
      phone:        string;
    } | null;
  } | null;
  driver: {
    id:         number;
    first_name: string;
    last_name:  string;
    phone:      string;
  } | null;
}

interface AvailableDriver {
  id:               number;
  first_name:       string;
  last_name:        string;
  driver_status:    string;
  vehicle_type:     string | null;
  vehicle_plate:    string | null;
  driver_record_id: number | null;
}

interface ApiListResponse<T> {
  status:  string;
  message: string;
  data: {
    records:    T[];
    pagination: { page: number; limit: number; total: number; pages: number };
  };
}

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function customerName(d: AdminDelivery) {
  const c = d.order?.customer;
  if (!c) return '—';
  return c.company_name ?? `${c.first_name} ${c.last_name}`;
}

const STATUS_STYLE: Record<string, {
  bg: string; dot: string; text: string; label: string; ring: string;
}> = {
  AWAITING_DISPATCH: { bg: 'bg-slate-100',   dot: 'bg-slate-400',   text: 'text-slate-700',  label: 'Awaiting Dispatch', ring: 'ring-slate-200'  },
  ASSIGNED:          { bg: 'bg-amber-100',   dot: 'bg-amber-400',   text: 'text-amber-800',  label: 'Assigned',          ring: 'ring-amber-200'  },
  IN_TRANSIT:        { bg: 'bg-blue-100',    dot: 'bg-blue-500',    text: 'text-blue-800',   label: 'In Transit',        ring: 'ring-blue-200'   },
  OUT_FOR_DELIVERY:  { bg: 'bg-indigo-100',  dot: 'bg-indigo-500',  text: 'text-indigo-800', label: 'Out for Delivery',  ring: 'ring-indigo-200' },
  DELIVERED:         { bg: 'bg-green-100',   dot: 'bg-green-500',   text: 'text-green-800',  label: 'Delivered',         ring: 'ring-green-200'  },
  FAILED:            { bg: 'bg-red-100',     dot: 'bg-red-400',     text: 'text-red-700',    label: 'Failed',            ring: 'ring-red-200'    },
  RETURNED:          { bg: 'bg-orange-100',  dot: 'bg-orange-400',  text: 'text-orange-800', label: 'Returned',          ring: 'ring-orange-200' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.ASSIGNED!;
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
      s.bg, s.text, s.ring,
    )}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

const ADMIN_NEXT: Record<string, { status: string; label: string; tone: 'primary' | 'warn' | 'danger' }[]> = {
  AWAITING_DISPATCH: [{ status: 'ASSIGNED',         label: 'Mark Assigned',    tone: 'primary' }],
  ASSIGNED:          [{ status: 'IN_TRANSIT',        label: 'Mark In Transit',  tone: 'primary' },
                      { status: 'RETURNED',           label: 'Mark Returned',    tone: 'warn'    }],
  IN_TRANSIT:        [{ status: 'OUT_FOR_DELIVERY',  label: 'Out for Delivery', tone: 'primary' },
                      { status: 'FAILED',             label: 'Mark Failed',      tone: 'danger'  }],
  OUT_FOR_DELIVERY:  [{ status: 'DELIVERED',         label: 'Mark Delivered',   tone: 'primary' },
                      { status: 'FAILED',             label: 'Mark Failed',      tone: 'danger'  }],
  FAILED:            [{ status: 'ASSIGNED',          label: 'Retry',            tone: 'warn'    }],
  DELIVERED:         [],
  RETURNED:          [],
};

function DriverStatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    AVAILABLE:   'bg-green-500',
    ON_DELIVERY: 'bg-amber-400',
    OFFLINE:     'bg-slate-300',
  };
  return (
    <span
      title={status}
      className={cn('inline-block h-2 w-2 rounded-full ring-2 ring-white', map[status] ?? 'bg-slate-300')}
    />
  );
}

function AssignDriverModal({
  deliveryId,
  currentDriverId,
  drivers,
  onClose,
}: {
  deliveryId:      number;
  currentDriverId: number | null;
  drivers:         AvailableDriver[];
  onClose:         () => void;
}) {
  const [q, setQ]               = useState('');
  const [selected, setSelected] = useState<AvailableDriver | null>(null);
  const toast = useToast();
  const qc    = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // All drivers (not just AVAILABLE) so admin can see who's busy — but only AVAILABLE can be selected
  const filtered = useMemo(() => {
    const q2 = q.toLowerCase();
    return drivers.filter(d =>
      d.driver_record_id !== null &&
      (
        `${d.first_name} ${d.last_name}`.toLowerCase().includes(q2) ||
        (d.vehicle_plate ?? '').toLowerCase().includes(q2) ||
        (d.vehicle_type  ?? '').toLowerCase().includes(q2)
      ),
    );
  }, [drivers, q]);

  const available = filtered.filter(d => d.driver_status === 'AVAILABLE');
  const busy      = filtered.filter(d => d.driver_status !== 'AVAILABLE');

  const mut = useMutation({
    mutationFn: async (driver: AvailableDriver) => {
      const res = await fetch(`/api/deliveries/${deliveryId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ driver_id: driver.driver_record_id }),
      });
      return res.json();
    },
    onSuccess: (data, driver) => {
      const ok = data.status === 'success';
      toast.show({
        tone:  ok ? 'success' : 'error',
        title: ok
          ? `Assigned to ${driver.first_name} ${driver.last_name}`
          : (data.message ?? 'Assignment failed'),
      });
      qc.invalidateQueries({ queryKey: ['admin-deliveries'] });
      if (ok) onClose();
    },
    onError: () => {
      toast.show({ tone: 'error', title: 'Network error. Please try again.' });
      qc.invalidateQueries({ queryKey: ['admin-deliveries'] });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4">
          <div>
            <h3 className="text-base font-bold text-ink">Assign a driver</h3>
            <p className="text-xs text-ink-3 mt-0.5">Select an available driver below.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-3 hover:bg-bg-subtle hover:text-ink transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-bg-subtle px-3 py-2">
            <Search size={14} className="shrink-0 text-ink-3" />
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name, plate or vehicle…"
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 outline-none"
            />
            {q && (
              <button onClick={() => setQ('')} className="text-ink-3 hover:text-ink">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Driver list */}
        <div className="overflow-y-auto flex-1 px-3 pb-3">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-3">
              {q ? 'No drivers match your search.' : 'No drivers found.'}
            </p>
          ) : (
            <>
              {/* Available */}
              {available.length > 0 && (
                <div className="mb-1">
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-3">
                    Available ({available.length})
                  </p>
                  {available.map(d => (
                    <DriverRow
                      key={d.id}
                      driver={d}
                      selected={selected?.id === d.id}
                      isCurrent={d.driver_record_id === currentDriverId}
                      onSelect={setSelected}
                    />
                  ))}
                </div>
              )}

              {/* Busy / offline */}
              {busy.length > 0 && (
                <div>
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-3">
                    On delivery / offline ({busy.length})
                  </p>
                  {busy.map(d => (
                    <DriverRow
                      key={d.id}
                      driver={d}
                      selected={false}
                      disabled
                      isCurrent={d.driver_record_id === currentDriverId}
                      onSelect={() => {}}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Confirm button */}
        {selected && (
          <div className="border-t border-line px-4 py-4">
            <button
              type="button"
              disabled={mut.isPending}
              onClick={() => mut.mutate(selected)}
              className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {mut.isPending
                ? 'Assigning…'
                : `Confirm — ${selected.first_name} ${selected.last_name}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DriverRow({
  driver, selected, disabled = false, isCurrent, onSelect,
}: {
  driver:    AvailableDriver;
  selected:  boolean;
  disabled?: boolean;
  isCurrent: boolean;
  onSelect:  (d: AvailableDriver) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(driver)}
      className={cn(
        'relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
        disabled  ? 'opacity-50 cursor-not-allowed'                       : 'hover:bg-bg-subtle',
        selected  ? 'bg-brand-50 ring-1 ring-brand-200'                   : '',
        isCurrent ? 'ring-1 ring-brand-300 bg-brand-50/60'                : '',
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
          {initials(driver.first_name, driver.last_name)}
        </span>
        <span className="absolute -bottom-0.5 -right-0.5">
          <DriverStatusDot status={driver.driver_status} />
        </span>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-ink">
            {driver.first_name} {driver.last_name}
          </span>
          {isCurrent && (
            <span className="shrink-0 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
              Current
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-ink-3">
          {driver.vehicle_type ?? 'Vehicle unset'}
          {driver.vehicle_plate ? ` · ${driver.vehicle_plate}` : ''}
        </div>
      </div>

      {selected && <Check size={16} className="shrink-0 text-brand-600" />}
    </button>
  );
}

function DetailPanel({
  delivery,
  drivers,
  onClose,
  onReassign,
}: {
  delivery:   AdminDelivery;
  drivers:    AvailableDriver[];
  onClose:    () => void;
  onReassign: () => void;
}) {
  const toast = useToast();
  const qc    = useQueryClient();

  const nextActions = ADMIN_NEXT[delivery.status] ?? [];

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
      toast.show({
        tone:  ok ? 'success' : 'error',
        title: ok
          ? `Status → ${STATUS_STYLE[newStatus]?.label ?? newStatus}`
          : (data.message ?? 'Update failed'),
      });
      qc.invalidateQueries({ queryKey: ['admin-deliveries'] });
      if (ok) onClose();
    },
    onError: () => {
      toast.show({ tone: 'error', title: 'Network error. Please try again.' });
      qc.invalidateQueries({ queryKey: ['admin-deliveries'] });
    },
  });

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      <div className="w-full max-w-md overflow-y-auto bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur-sm px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-xs tracking-wider text-ink-3">{delivery.tracking_code}</p>
              <h2 className="mt-0.5 text-lg font-bold text-ink">
                {delivery.order?.order_number ?? '—'}
              </h2>
              <div className="mt-2"><StatusBadge status={delivery.status} /></div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-ink-3 hover:bg-bg-subtle hover:text-ink transition-colors mt-0.5"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 p-6">
          {/* Customer */}
          {delivery.order?.customer && (
            <section>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-ink-3">
                Customer
              </label>
              <div className="rounded-xl border border-line bg-bg-subtle p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Building size={13} className="shrink-0 text-ink-3" />
                  <span className="text-sm font-medium text-ink">
                    {delivery.order.customer.company_name
                      ?? `${delivery.order.customer.first_name} ${delivery.order.customer.last_name}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={13} className="shrink-0 text-ink-3" />
                  <span className="text-sm text-ink-2">{delivery.order.customer.phone}</span>
                </div>
                <p className="pl-5 text-xs text-ink-3">{delivery.order.customer.email}</p>
              </div>
            </section>
          )}

          {/* Destination */}
          {delivery.order && (
            <section>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-ink-3">
                Destination
              </label>
              <div className="flex items-start gap-2.5 rounded-xl border border-line bg-bg-subtle p-4">
                <MapPin size={13} className="mt-0.5 shrink-0 text-ink-3" />
                <div className="text-sm leading-relaxed text-ink-2">
                  {delivery.order.delivery_address}<br />
                  {delivery.order.delivery_city}, {delivery.order.delivery_state}
                </div>
              </div>
            </section>
          )}

          {/* Driver */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-3">
                Driver
              </label>
              {delivery.driver && (
                <button
                  onClick={onReassign}
                  className="text-[11px] font-medium text-brand-600 hover:text-brand-700 hover:underline"
                >
                  Reassign
                </button>
              )}
            </div>
            {delivery.driver ? (
              <div className="flex items-center gap-3 rounded-xl border border-line bg-bg-subtle p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {initials(delivery.driver.first_name, delivery.driver.last_name)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {delivery.driver.first_name} {delivery.driver.last_name}
                  </p>
                  <p className="text-xs text-ink-3">{delivery.driver.phone}</p>
                </div>
              </div>
            ) : (
              <button
                onClick={onReassign}
                className="flex w-full items-center justify-between rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <span>No driver assigned yet</span>
                <span className="font-semibold">+ Assign driver</span>
              </button>
            )}
          </section>

          {/* Order value */}
          {delivery.order && (
            <section>
              <div className="flex items-center justify-between rounded-xl border border-line bg-bg-subtle px-4 py-3">
                <span className="text-sm text-ink-3">Order value</span>
                <span className="font-semibold text-ink">{formatNaira(delivery.order.total)}</span>
              </div>
            </section>
          )}

          {/* Timeline */}
          <section>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-ink-3">
              Timeline
            </label>
            <div className="divide-y divide-line rounded-xl border border-line overflow-hidden">
              {[
                { label: 'Created',    value: delivery.created_at   },
                { label: 'Dispatched', value: delivery.dispatched_at },
                { label: 'Delivered',  value: delivery.delivered_at  },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between bg-bg-subtle px-4 py-2.5 text-sm">
                  <span className="text-ink-3">{label}</span>
                  <span className={cn('font-medium', value ? 'text-ink' : 'text-ink-3')}>
                    {value ? formatDate(value) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Notes */}
          {delivery.notes && (
            <section>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-ink-3">
                Notes
              </label>
              <p className="rounded-xl border border-line bg-bg-subtle p-4 text-sm text-ink-2 leading-relaxed">
                {delivery.notes}
              </p>
            </section>
          )}

          {/* Status actions */}
          {nextActions.length > 0 && (
            <section>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-ink-3">
                Actions
              </label>
              <div className="flex flex-col gap-2">
                {nextActions.map(action => (
                  <button
                    key={action.status}
                    type="button"
                    disabled={statusMut.isPending}
                    onClick={() => statusMut.mutate(action.status)}
                    className={cn(
                      'rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60',
                      action.tone === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700',
                      action.tone === 'warn'    && 'bg-amber-50 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100',
                      action.tone === 'danger'  && 'bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100',
                    )}
                  >
                    {statusMut.isPending ? 'Updating…' : action.label}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { key: '',                 label: 'All'              },
  { key: 'AWAITING_DISPATCH', label: 'Awaiting'        },
  { key: 'ASSIGNED',          label: 'Assigned'        },
  { key: 'IN_TRANSIT',        label: 'In Transit'      },
  { key: 'OUT_FOR_DELIVERY',  label: 'Out for Delivery'},
  { key: 'DELIVERED',         label: 'Delivered'       },
  { key: 'FAILED',            label: 'Failed'          },
] as const;

export default function AdminDeliveriesClient() {
  const [page,         setPage]       = useState(1);
  const [statusFilter, setStatus]     = useState('');
  const [search,       setSearch]     = useState('');
  const [inputValue,   setInputValue] = useState('');
  const [selected,     setSelected]   = useState<AdminDelivery | null>(null);
  const [assigning,    setAssigning]  = useState<AdminDelivery | null>(null);
  const searchTimeout                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  function handleSearchChange(val: string) {
    setInputValue(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(val.trim());
      setPage(1);
    }, 350);
  }

  // ── Deliveries list ──────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery<ApiListResponse<AdminDelivery>>({
    queryKey: ['admin-deliveries', page, statusFilter, search],
    queryFn:  async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (search)       params.set('search', search);
      const res = await fetch(`/api/deliveries?${params}`);
      return res.json();
    },
    staleTime: 30_000,
  });

  // ── Available drivers for assignment ─────────────────────────────────────
  const { data: driversData } = useQuery<ApiListResponse<AvailableDriver>>({
    queryKey: ['admin-drivers-list'],
    queryFn:  async () => {
      const res = await fetch('/api/staff?role=DRIVER&limit=200');
      return res.json();
    },
    staleTime: 60_000,
  });

  const deliveries = data?.data?.records ?? [];
  const pagination = data?.data?.pagination;
  const drivers    = driversData?.data?.records ?? [];

  return (
    <>
      {/* ── Search + controls bar ─────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 shadow-sm">
          <Search size={15} className="shrink-0 text-ink-3" />
          <input
            value={inputValue}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search by tracking code or order number…"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 outline-none min-w-0"
          />
          {inputValue && (
            <button
              onClick={() => { setInputValue(''); setSearch(''); setPage(1); }}
              className="text-ink-3 hover:text-ink"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Status tabs ───────────────────────────────────────────────────── */}
      <div className="mb-4 flex gap-0 overflow-x-auto border-b border-line">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setStatus(tab.key); setPage(1); }}
            className={cn(
              'whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              statusFilter === tab.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-3 hover:text-ink hover:border-line-strong',
            )}
          >
            {tab.label}
            {/* Show total count on active tab */}
            {statusFilter === tab.key && pagination && pagination.total > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                {pagination.total}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        {isLoading ? (
          <div className="flex h-52 items-center justify-center gap-2.5 text-sm text-ink-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            <span>Loading deliveries…</span>
          </div>
        ) : isError ? (
          <div className="flex h-52 flex-col items-center justify-center gap-2 text-sm text-ink-3">
            <AlertTriangle size={22} className="text-red-400" />
            <p>Failed to load. Refresh to retry.</p>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center gap-2 text-sm text-ink-3">
            <Truck size={28} className="opacity-30" />
            <p>{search ? 'No deliveries match your search.' : 'No deliveries found.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg-subtle">
                  {[
                    'Tracking Code',
                    'Order',
                    'Customer',
                    'Destination',
                    'Status',
                    'Driver',
                    '',
                  ].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-ink-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {deliveries.map(d => (
                  <tr
                    key={d.id}
                    onClick={() => setSelected(d)}
                    className="group cursor-pointer hover:bg-brand-50/30 transition-colors"
                  >
                    {/* Tracking code */}
                    <td className="px-4 py-3.5">
                      <span className="rounded-md bg-bg-subtle px-2 py-1 font-mono text-[11px] text-ink-2 ring-1 ring-line">
                        {d.tracking_code}
                      </span>
                    </td>

                    {/* Order number */}
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-ink">{d.order?.order_number ?? '—'}</span>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5 max-w-[160px]">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {d.order?.customer
                            ? initials(d.order.customer.first_name, d.order.customer.last_name)
                            : '?'}
                        </span>
                        <span className="truncate font-medium text-ink">{customerName(d)}</span>
                      </div>
                    </td>

                    {/* Destination */}
                    <td className="px-4 py-3.5">
                      <span className="text-ink-2">
                        {d.order ? `${d.order.delivery_city}, ${d.order.delivery_state}` : '—'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <StatusBadge status={d.status} />
                    </td>

                    {/* Driver */}
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      {d.driver ? (
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                            {initials(d.driver.first_name, d.driver.last_name)}
                          </span>
                          <span className="text-sm font-medium text-ink">
                            {d.driver.first_name} {d.driver.last_name}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAssigning(d)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:border-amber-400 hover:bg-amber-100 transition-colors"
                        >
                          <User size={11} />
                          Assign driver
                        </button>
                      )}
                    </td>

                    {/* View */}
                    <td className="px-4 py-3.5">
                      <span className="grid h-7 w-7 place-items-center rounded-lg text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-bg-subtle transition-all">
                        <Eye size={14} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {pagination && pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-3">
          <span>
            {((pagination.page - 1) * pagination.limit) + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} {pagination.total === 1 ? 'delivery' : 'deliveries'}
          </span>
          <div className="flex gap-1">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="rounded-lg border border-line p-2 hover:bg-bg-subtle disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {/* Page numbers (up to 5 shown) */}
            {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
              const p = pagination.pages <= 5
                ? i + 1
                : pagination.page <= 3
                  ? i + 1
                  : pagination.page >= pagination.pages - 2
                    ? pagination.pages - 4 + i
                    : pagination.page - 2 + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'h-8 w-8 rounded-lg border text-xs font-medium transition-colors',
                    p === pagination.page
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-line hover:bg-bg-subtle text-ink-2',
                  )}
                >
                  {p}
                </button>
              );
            })}
            <button
              disabled={pagination.page >= pagination.pages}
              onClick={() => setPage(p => p + 1)}
              className="rounded-lg border border-line p-2 hover:bg-bg-subtle disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Detail panel ──────────────────────────────────────────────────── */}
      {selected && (
        <DetailPanel
          delivery={selected}
          drivers={drivers}
          onClose={() => setSelected(null)}
          onReassign={() => {
            setAssigning(selected);
            setSelected(null);
          }}
        />
      )}

      {/* ── Assign driver modal ───────────────────────────────────────────── */}
      {assigning && (
        <AssignDriverModal
          deliveryId={assigning.id}
          currentDriverId={assigning.driver?.id ?? null}
          drivers={drivers}
          onClose={() => setAssigning(null)}
        />
      )}
    </>
  );
}
