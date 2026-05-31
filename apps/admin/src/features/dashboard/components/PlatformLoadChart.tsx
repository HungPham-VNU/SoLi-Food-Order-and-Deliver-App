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
import type { HourlyLoadPoint } from '../api/platformAnalytics.api';

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

function formatHour(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return iso; }
}

interface Props { data: HourlyLoadPoint[] }

export function PlatformLoadChart({ data }: Props) {
  const chartData = data.map((p) => ({ ...p, hour: formatHour(p.hour), revenue: Math.round(p.revenue / 1_000_000) }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
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
            interval={3}
          />

          <YAxis
            tick={{ fontSize: 10, fill: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono, monospace)' }}
            tickLine={false}
            axisLine={false}
            width={36}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--outline-variant)', strokeWidth: 1 }} />

          <Area
            type="monotone"
            dataKey="orders"
            stroke="#0d631b"
            strokeWidth={2}
            fill="url(#ordersGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#0d631b', strokeWidth: 0 }}
          />

          <Area
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
