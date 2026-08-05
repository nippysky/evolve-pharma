'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Truck, MapPin, Check, AlertTriangle, ChevronLeft, ChevronRight } from '@/components/icons';
import { formatNaira, formatDate, cn } from '@/lib/utils';

interface HistoryDelivery {
  id:            number;
  tracking_code: string;
  status:        string;
  dispatched_at: string | null;
  delivered_at:  string | null;
  order: {
    order_number:     string;
    delivery_address: string;
    delivery_city:    string;
    delivery_state:   string;
    total:            number;
    customer: {
      company_name: string | null;
      first_name:   string;
      last_name:    string;
    } | null;
  } | null;
}

interface ApiListResponse {
  status: string;
  data: {
    records:    HistoryDelivery[];
    pagination: { page: number; limit: number; total: number; pages: number };
  };
}

const STATUS_STYLE: Record<string, { bg: string; dot: string; text: string; label: string }> = {
  DELIVERED: { bg: 'bg-green-50 border border-green-200', dot: 'bg-green-500', text: 'text-green-800', label: 'Delivered' },
  FAILED:    { bg: 'bg-red-50 border border-red-200',     dot: 'bg-red-400',   text: 'text-red-800',   label: 'Failed'    },
  RETURNED:  { bg: 'bg-orange-50 border border-orange-200', dot: 'bg-orange-400', text: 'text-orange-800', label: 'Returned' },
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

const TABS = [
  { key: '',          label: 'All past'  },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'FAILED',    label: 'Failed'    },
  { key: 'RETURNED',  label: 'Returned'  },
] as const;

export default function DriverHistoryClient() {
  const [page, setPage]           = useState(1);
  const [statusFilter, setStatus] = useState('');

  const { data, isLoading, isError } = useQuery<ApiListResponse>({
    queryKey: ['driver-history', page, statusFilter],
    queryFn:  async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      // Filter to historical statuses only if no specific filter is set
      if (statusFilter) {
        params.set('status', statusFilter);
      }
      // We'll filter client-side for "All past" since API doesn't support OR status filter
      const res = await fetch(`/api/deliveries?${params}`);
      return res.json();
    },
    staleTime: 30_000,
  });

  const allRecords  = data?.data?.records ?? [];
  // For "All past" tab, filter to only terminal statuses client-side
  const records = statusFilter
    ? allRecords
    : allRecords.filter(d => ['DELIVERED', 'FAILED', 'RETURNED'].includes(d.status));

  const pagination = data?.data?.pagination;

  return (
    <>
      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-line bg-bg-subtle p-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setStatus(tab.key); setPage(1); }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              statusFilter === tab.key
                ? 'bg-white text-ink shadow-sm'
                : 'text-ink-3 hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        </div>
      ) : isError ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-ink-3">
          <AlertTriangle size={20} />
          <p>Failed to load history.</p>
        </div>
      ) : records.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-white text-sm text-ink-3">
          <Truck size={24} className="opacity-40" />
          <p>No delivery history yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(d => (
            <div
              key={d.id}
              className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-white px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-medium text-ink">{d.order?.order_number ?? '—'}</span>
                  <StatusBadge status={d.status} />
                </div>
                <p className="mt-1 font-mono text-xs text-ink-3">{d.tracking_code}</p>

                {d.order?.customer && (
                  <p className="mt-2 text-sm text-ink-2">
                    {d.order.customer.company_name
                      ?? `${d.order.customer.first_name} ${d.order.customer.last_name}`}
                  </p>
                )}

                {d.order && (
                  <div className="mt-1 flex items-start gap-1.5 text-xs text-ink-3">
                    <MapPin size={11} className="mt-0.5 shrink-0" />
                    <span>{d.order.delivery_city}, {d.order.delivery_state}</span>
                  </div>
                )}

                {d.delivered_at && (
                  <p className="mt-2 text-xs text-ink-3">
                    Delivered: {formatDate(d.delivered_at)}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                {d.order && (
                  <p className="font-semibold text-ink">{formatNaira(d.order.total)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-3">
          <span>
            Page {pagination.page} of {pagination.pages}
          </span>
          <div className="flex gap-1">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="rounded-lg border border-line p-2 hover:bg-bg-subtle disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={pagination.page >= pagination.pages}
              onClick={() => setPage(p => p + 1)}
              className="rounded-lg border border-line p-2 hover:bg-bg-subtle disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
