'use client';
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, Refresh,
  CreditCard, Box, Truck, Users,
  Building, AlertTriangle,
} from '@/components/icons';
import { formatNaira, cn } from '@/lib/utils';

interface KPIs {
  revenue:           number;
  revenueTrend:      number | null;
  orders:            number;
  ordersTrend:       number | null;
  avgOrderValue:     number;
  activeShipments:   number;
  newCustomers:      number;
  newCustomersTrend: number | null;
}

interface DayRevenue  { date: string; revenue: number }
interface StatusCount { status: string; count: number }
interface Customer    { id: number; name: string; company: string | null; revenue: number; orders: number }
interface Product     { id: number; name: string; sku: string; revenue: number; units: number }
interface Category    { category: string; revenue: number }
interface DeliveryGroup { status: string; count: number }

interface ReportData {
  period:             number;
  kpis:               KPIs;
  revenueByDay:       DayRevenue[];
  ordersByStatus:     StatusCount[];
  topCustomers:       Customer[];
  topProducts:        Product[];
  revenueByCategory:  Category[];
  deliveryMetrics:    { byStatus: DeliveryGroup[] };
}

interface ApiResponse {
  status: string;
  data:   ReportData;
}

const PERIODS = [
  { label: '7D',  value: 7   },
  { label: '30D', value: 30  },
  { label: '90D', value: 90  },
  { label: '1Y',  value: 365 },
] as const;

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING:    '#f59e0b',
  CONFIRMED:  '#3b82f6',
  PROCESSING: '#8b5cf6',
  DISPATCHED: '#06b6d4',
  DELIVERED:  '#22c55e',
  CANCELLED:  '#ef4444',
};

const DELIVERY_STATUS_COLORS: Record<string, string> = {
  AWAITING_DISPATCH: '#94a3b8',
  ASSIGNED:          '#f59e0b',
  IN_TRANSIT:        '#3b82f6',
  OUT_FOR_DELIVERY:  '#8b5cf6',
  DELIVERED:         '#22c55e',
  FAILED:            '#ef4444',
  RETURNED:          '#f97316',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING:    'Pending',
  CONFIRMED:  'Confirmed',
  PROCESSING: 'Processing',
  DISPATCHED: 'Dispatched',
  DELIVERED:  'Delivered',
  CANCELLED:  'Cancelled',
};

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  AWAITING_DISPATCH: 'Awaiting',
  ASSIGNED:          'Assigned',
  IN_TRANSIT:        'In Transit',
  OUT_FOR_DELIVERY:  'Out for Delivery',
  DELIVERED:         'Delivered',
  FAILED:            'Failed',
  RETURNED:          'Returned',
};

function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-ink-3">vs prev. period</span>;
  const up = pct >= 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', up ? 'text-green-600' : 'text-red-500')}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{pct}%
    </span>
  );
}

function KpiCard({
  label, value, trend, icon: Icon, accent,
}: {
  label:  string;
  value:  string;
  trend?: number | null;
  icon:   React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-3">{label}</span>
        <span className={cn('grid h-8 w-8 place-items-center rounded-xl', accent)}>
          <Icon size={15} />
        </span>
      </div>
      <div className="num font-display text-3xl font-bold tracking-tight leading-none text-ink">{value}</div>
      {trend !== undefined && <Trend pct={trend ?? null} />}
    </div>
  );
}

function AreaChart({ data, color = '#16a34a' }: { data: DayRevenue[]; color?: string }) {
  const W = 600, H = 120, PAD_B = 20, PAD_T = 8;
  const plotH = H - PAD_B - PAD_T;

  const values  = data.map(d => d.revenue);
  const maxVal  = Math.max(...values, 1);
  const minVal  = 0;

  const pts = data.map((d, i) => ({
    x: data.length <= 1 ? W / 2 : (i / (data.length - 1)) * W,
    y: PAD_T + plotH - ((d.revenue - minVal) / (maxVal - minVal)) * plotH,
    label: d.date,
    val: d.revenue,
  }));

  if (pts.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-ink-3">
        No revenue data for this period.
      </div>
    );
  }

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1]!.x.toFixed(1)} ${(H - PAD_B).toFixed(1)} L ${pts[0]!.x.toFixed(1)} ${(H - PAD_B).toFixed(1)} Z`;

  // X-axis labels: show ~5 evenly spaced
  const labelIndices = data.length <= 5
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor((3 * data.length) / 4), data.length - 1];

  const gradId = `areaGrad-${color.replace('#', '')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradId})`} />
      {/* Gridlines */}
      {[0.25, 0.5, 0.75, 1].map(frac => {
        const y = PAD_T + plotH * (1 - frac);
        return (
          <line
            key={frac}
            x1="0" y1={y.toFixed(1)} x2={W} y2={y.toFixed(1)}
            stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 3"
          />
        );
      })}
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Data points */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3" fill={color} stroke="white" strokeWidth="1.5" />
      ))}
      {/* X-axis labels */}
      {labelIndices.map(i => {
        const p = pts[i];
        if (!p) return null;
        const raw = data[i]?.date ?? '';
        const label = raw.slice(5); // MM-DD
        return (
          <text
            key={i}
            x={p.x.toFixed(1)}
            y={H - 3}
            textAnchor="middle"
            fontSize="9"
            fill="#9ca3af"
            fontFamily="sans-serif"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

function DonutChart({
  segments,
  labelMap,
  colorMap,
  size = 140,
}: {
  segments: { status: string; count: number }[];
  labelMap: Record<string, string>;
  colorMap: Record<string, string>;
  size?:   number;
}) {
  const total = segments.reduce((s, g) => s + g.count, 0);
  if (total === 0) {
    return <div className="flex h-36 items-center justify-center text-sm text-ink-3">No data.</div>;
  }

  const cx = size / 2, cy = size / 2, r = size * 0.36, strokeW = size * 0.13;
  const circumference = 2 * Math.PI * r;

  let cumFrac = 0;
  const arcs = segments.map(seg => {
    const frac    = seg.count / total;
    const offset  = circumference * (1 - cumFrac);
    const dash    = circumference * frac;
    cumFrac += frac;
    return { ...seg, frac, offset, dash, color: colorMap[seg.status] ?? '#94a3b8' };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeW}
          strokeDasharray={`${arc.dash.toFixed(2)} ${(circumference - arc.dash).toFixed(2)}`}
          strokeDashoffset={arc.offset.toFixed(2)}
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeLinecap="butt"
        />
      ))}
      {/* Centre total */}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={size * 0.13} fontWeight="700" fill="#111827" fontFamily="sans-serif">
        {total}
      </text>
      <text x={cx} y={cy + size * 0.1} textAnchor="middle" fontSize={size * 0.08} fill="#9ca3af" fontFamily="sans-serif">
        total
      </text>
    </svg>
  );
}

function HBar({ label, value, max, color = '#16a34a' }: {
  label: string; value: number; max: number; color?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-xs font-medium text-ink-2" title={label}>{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-bg-subtle h-2">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct.toFixed(1)}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-24 shrink-0 text-right text-xs font-semibold text-ink">{formatNaira(value)}</span>
    </div>
  );
}

function Section({ title, children, action }: {
  title: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-line', className)} />;
}

export default function ReportsClient() {
  const [period, setPeriod] = useState<number>(30);
  const qc = useQueryClient();

  const { data: raw, isLoading, isError, isFetching, dataUpdatedAt } = useQuery<ApiResponse>({
    queryKey:          ['reports', period],
    queryFn:           async () => {
      const res = await fetch(`/api/reports/summary?period=${period}`);
      return res.json();
    },
    staleTime:         5 * 60 * 1000,   // 5-min cache
    refetchOnWindowFocus: false,
  });

  const data = raw?.data;

  // ── Derived ───────────────────────────────────────────────────────────────

  const topCatRevenue = useMemo(
    () => data?.revenueByCategory[0]?.revenue ?? 1,
    [data],
  );

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (isLoading) return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
      <Skeleton className="h-64" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" /><Skeleton className="h-64" />
      </div>
    </div>
  );

  if (isError || !data) return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-white text-sm text-ink-3">
      <AlertTriangle size={22} className="text-red-400" />
      <p>Failed to load reports. Please refresh.</p>
      <button
        onClick={() => qc.invalidateQueries({ queryKey: ['reports', period] })}
        className="mt-1 rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-bg-subtle"
      >
        Try again
      </button>
    </div>
  );

  const { kpis, revenueByDay, ordersByStatus, topCustomers, topProducts, revenueByCategory, deliveryMetrics } = data;

  return (
    <div className="space-y-6">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Period selector */}
        <div className="flex items-center gap-1 rounded-xl border border-line bg-white p-1 shadow-sm">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                period === p.value
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-ink-3 hover:text-ink hover:bg-bg-subtle',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <div className="flex items-center gap-3 text-xs text-ink-3">
          {lastUpdated && <span>Updated {lastUpdated}</span>}
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['reports', period] })}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-bg-subtle disabled:opacity-50 transition-colors"
          >
            <Refresh size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Revenue"
          value={formatNaira(kpis.revenue)}
          trend={kpis.revenueTrend}
          icon={CreditCard}
          accent="bg-green-50 text-green-600"
        />
        <KpiCard
          label="Orders"
          value={kpis.orders.toLocaleString()}
          trend={kpis.ordersTrend}
          icon={Box}
          accent="bg-blue-50 text-blue-600"
        />
        <KpiCard
          label="Avg. Order Value"
          value={formatNaira(kpis.avgOrderValue)}
          icon={CreditCard}
          accent="bg-purple-50 text-purple-600"
        />
        <KpiCard
          label="Active Shipments"
          value={String(kpis.activeShipments)}
          icon={Truck}
          accent="bg-amber-50 text-amber-600"
        />
      </div>

      {/* ── Revenue area chart ───────────────────────────────────────────── */}
      <Section
        title={`Revenue over time — last ${period === 365 ? '12 months' : `${period} days`}`}
        action={
          <span className="text-xs font-semibold text-green-700">
            {formatNaira(kpis.revenue)} total
          </span>
        }
      >
        {revenueByDay.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-ink-3">
            No paid orders in this period.
          </div>
        ) : (
          <AreaChart data={revenueByDay} color="#16a34a" />
        )}
      </Section>

      {/* ── Orders by status + Delivery breakdown ───────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Orders donut */}
        <Section title="Orders by status">
          <div className="flex items-center gap-6">
            <DonutChart
              segments={ordersByStatus}
              labelMap={ORDER_STATUS_LABELS}
              colorMap={ORDER_STATUS_COLORS}
              size={150}
            />
            <div className="flex-1 space-y-2.5">
              {ordersByStatus.map(s => (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: ORDER_STATUS_COLORS[s.status] ?? '#94a3b8' }}
                    />
                    <span className="text-ink-2">{ORDER_STATUS_LABELS[s.status] ?? s.status}</span>
                  </div>
                  <span className="font-semibold text-ink">{s.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Delivery breakdown */}
        <Section title="Delivery status">
          <div className="flex items-center gap-6">
            <DonutChart
              segments={deliveryMetrics.byStatus}
              labelMap={DELIVERY_STATUS_LABELS}
              colorMap={DELIVERY_STATUS_COLORS}
              size={150}
            />
            <div className="flex-1 space-y-2.5">
              {deliveryMetrics.byStatus.map(s => (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: DELIVERY_STATUS_COLORS[s.status] ?? '#94a3b8' }}
                    />
                    <span className="text-ink-2">{DELIVERY_STATUS_LABELS[s.status] ?? s.status}</span>
                  </div>
                  <span className="font-semibold text-ink">{s.count.toLocaleString()}</span>
                </div>
              ))}
              {deliveryMetrics.byStatus.length === 0 && (
                <p className="text-sm text-ink-3">No deliveries yet.</p>
              )}
            </div>
          </div>
        </Section>
      </div>

      {/* ── Top customers + top products ────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top customers */}
        <Section
          title="Top customers by spend"
          action={<span className="text-xs text-ink-3">{period === 365 ? 'This year' : `Last ${period} days`}</span>}
        >
          {topCustomers.length === 0 ? (
            <p className="text-sm text-ink-3">No paid orders in this period.</p>
          ) : (
            <div className="space-y-3">
              {topCustomers.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  {/* Rank */}
                  <span className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                    i === 0 ? 'bg-amber-100 text-amber-700'
                    : i === 1 ? 'bg-slate-100 text-slate-600'
                    : i === 2 ? 'bg-orange-100 text-orange-700'
                    : 'bg-bg-subtle text-ink-3',
                  )}>
                    {i + 1}
                  </span>
                  {/* Avatar */}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {(c.company ?? c.name).charAt(0).toUpperCase()}
                  </span>
                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{c.company ?? c.name}</p>
                    <p className="text-xs text-ink-3">{c.orders.toLocaleString()} order{c.orders !== 1 ? 's' : ''}</p>
                  </div>
                  {/* Revenue */}
                  <span className="shrink-0 text-sm font-bold text-ink">{formatNaira(c.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Top products */}
        <Section
          title="Top products by revenue"
          action={<span className="text-xs text-ink-3">{period === 365 ? 'This year' : `Last ${period} days`}</span>}
        >
          {topProducts.length === 0 ? (
            <p className="text-sm text-ink-3">No paid orders in this period.</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                    i === 0 ? 'bg-amber-100 text-amber-700'
                    : i === 1 ? 'bg-slate-100 text-slate-600'
                    : i === 2 ? 'bg-orange-100 text-orange-700'
                    : 'bg-bg-subtle text-ink-3',
                  )}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                    <p className="text-xs text-ink-3 font-mono">{p.sku} · {p.units.toLocaleString()} units</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-ink">{formatNaira(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* ── Revenue by category ──────────────────────────────────────────── */}
      <Section
        title="Revenue by category"
        action={<span className="text-xs text-ink-3">{period === 365 ? 'This year' : `Last ${period} days`}</span>}
      >
        {revenueByCategory.length === 0 ? (
          <p className="text-sm text-ink-3">No paid orders in this period.</p>
        ) : (
          <div className="space-y-3">
            {revenueByCategory.map((cat, i) => (
              <HBar
                key={cat.category}
                label={cat.category}
                value={cat.revenue}
                max={topCatRevenue}
                color={['#16a34a','#3b82f6','#8b5cf6','#f59e0b','#06b6d4','#ec4899','#f97316','#14b8a6'][i % 8]}
              />
            ))}
          </div>
        )}
      </Section>

      {/* ── New customers + summary footer ──────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-3">New Customers</span>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <Users size={15} />
            </span>
          </div>
          <div className="num font-display text-3xl font-bold tracking-tight leading-none text-ink">
            {kpis.newCustomers.toLocaleString()}
          </div>
          <Trend pct={kpis.newCustomersTrend} />
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-3">Revenue per Customer</span>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-600">
              <Building size={15} />
            </span>
          </div>
          <div className="num font-display text-3xl font-bold tracking-tight leading-none text-ink">
            {kpis.newCustomers > 0
              ? formatNaira(kpis.revenue / kpis.newCustomers)
              : '—'}
          </div>
          <span className="text-xs text-ink-3">avg. per new customer</span>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-3">Order Fill Rate</span>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-teal-50 text-teal-600">
              <Box size={15} />
            </span>
          </div>
          {(() => {
            const total     = ordersByStatus.reduce((s, g) => s + g.count, 0);
            const delivered = ordersByStatus.find(g => g.status === 'DELIVERED')?.count ?? 0;
            const rate      = total > 0 ? Math.round((delivered / total) * 100) : 0;
            return (
              <>
                <div className="num font-display text-3xl font-bold tracking-tight leading-none text-ink">
                  {rate}%
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-subtle">
                  <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${rate}%` }} />
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
