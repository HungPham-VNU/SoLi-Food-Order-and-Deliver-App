import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  type TooltipProps,
} from 'recharts';
import type { AnalyticsRange, HourlyLoadPoint } from '../api/platformAnalytics.api';

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] px-4 py-3 text-sm">
      <p className="font-mono text-xs text-on-surface-variant mb-2">{label}</p>
      <p className="font-headline font-semibold text-primary">
        {payload[0]?.value} orders
      </p>
      <p className="font-mono text-on-surface-variant text-xs mt-0.5">
        ₫{payload[1]?.value?.toFixed(1)}M revenue
      </p>
    </div>
  );
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHour(iso: string, range: AnalyticsRange): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (range === '7d') {
      return `${DAY_SHORT[d.getDay()]} ${hh}:${mm}`;
    }
    return `${hh}:${mm}`;
  } catch {
    return iso;
  }
}

interface Props { data: HourlyLoadPoint[]; range: AnalyticsRange }

export function PlatformLoadChart({ data, range }: Props) {
  // For 7d, tick every 12 hours (~14 visible ticks across 168 points).
  // For today/yesterday, tick every 4 hours (~6 ticks across ≤24 points).
  const tickInterval = range === '7d' ? 11 : 3;

  const chartData = data.map((p) => ({ ...p, hour: formatHour(p.hour, range), revenue: Math.round(p.revenue / 1_000_000) }));

  if (chartData.length === 0) {
    return (
      <div className="h-64 w-full flex flex-col items-center justify-center gap-2 text-center rounded-xl bg-surface-container/40 border border-dashed border-outline-variant/30">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">bar_chart</span>
        <p className="text-sm font-medium text-on-surface-variant">No orders in this window</p>
        <p className="text-xs text-on-surface-variant/60">Load data will appear once orders are placed</p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 4, right: 52, left: 8, bottom: 0 }}
        >
          <defs>
            <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#0d631b" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#0d631b" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ff9800" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#ff9800" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(0,0,0,0.05)"
            vertical={false}
          />

          <XAxis
            dataKey="hour"
            tick={{ fontSize: 10, fill: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono, monospace)' }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
          />

          {/* Left axis — order count */}
          <YAxis
            yAxisId="orders"
            orientation="left"
            tick={{ fontSize: 10, fill: '#0d631b', fontFamily: 'var(--font-mono, monospace)' }}
            tickLine={false}
            axisLine={false}
            width={32}
            allowDecimals={false}
          />

          {/* Right axis — revenue in ₫M */}
          <YAxis
            yAxisId="revenue"
            orientation="right"
            tick={{ fontSize: 10, fill: '#ff9800', fontFamily: 'var(--font-mono, monospace)' }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => `₫${v}M`}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--outline-variant)', strokeWidth: 1 }} />

          <Area
            yAxisId="orders"
            type="monotone"
            dataKey="orders"
            stroke="#0d631b"
            strokeWidth={2}
            fill="url(#ordersGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#0d631b', strokeWidth: 0 }}
          />

          <Area
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            stroke="#ff9800"
            strokeWidth={1.5}
            fill="url(#revenueGradient)"
            dot={false}
            activeDot={{ r: 3, fill: '#ff9800', strokeWidth: 0 }}
            strokeDasharray="4 2"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
