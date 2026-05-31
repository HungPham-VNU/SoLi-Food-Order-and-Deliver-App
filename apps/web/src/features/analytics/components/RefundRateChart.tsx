import type { RefundRatePoint } from '@/features/analytics/types';

const W = 800;
const H = 200;
const PAD_X = 0;
const PAD_Y = 12;

function formatHourLabel(iso: string, includeDate: boolean): string {
  try {
    const d = new Date(iso);
    const h = d.getHours();
    const suffix = h >= 12 ? 'pm' : 'am';
    const display = h % 12 === 0 ? 12 : h % 12;
    const time = `${display}${suffix}`;
    if (includeDate) {
      return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
    }
    return time;
  } catch {
    return iso;
  }
}

export function RefundRateChart({ series }: { series: RefundRatePoint[] }) {
  if (series.length === 0) {
    return (
      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm p-6 h-full">
        <h3 className="font-headline text-lg font-bold text-on-surface mb-2">
          Refund Rate Over Time
        </h3>
        <p className="text-sm text-on-surface-variant py-10 text-center">
          No delivered orders in this window yet — nothing to plot.
        </p>
      </section>
    );
  }

  const pctSeries = series.map((p) => p.rate * 100);
  const max = Math.max(...pctSeries, 5);
  const min = 0;
  const stepX = (W - PAD_X * 2) / Math.max(series.length - 1, 1);
  const points = series.map((p, i) => {
    const x = PAD_X + stepX * i;
    const y = PAD_Y + (1 - (p.rate * 100 - min) / (max - min)) * (H - PAD_Y * 2);
    return { x, y, pct: p.rate * 100, hour: p.hour };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${points.at(-1)!.x} ${H} L ${points[0].x} ${H} Z`;

  const criticalY = PAD_Y + (1 - 5 / max) * (H - PAD_Y * 2);

  return (
    <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm p-6 h-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h3 className="font-headline text-lg font-bold text-on-surface">
          Refund Rate Over Time
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
          % of delivered orders
        </span>
      </div>

      <div className="relative h-64">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-full block"
        >
          <defs>
            <linearGradient id="refund-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0d631b" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#0d631b" stopOpacity="0" />
            </linearGradient>
          </defs>

          <rect
            x={0}
            y={PAD_Y}
            width={W}
            height={Math.max(criticalY - PAD_Y, 0)}
            fill="#C44545"
            fillOpacity={0.06}
          />
          <line
            x1={0}
            x2={W}
            y1={criticalY}
            y2={criticalY}
            stroke="#C44545"
            strokeOpacity={0.35}
            strokeDasharray="4 4"
          />

          <path d={areaPath} fill="url(#refund-fill)" />
          <path
            d={linePath}
            fill="none"
            stroke="#0d631b"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.length <= 48 && points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3}
              fill="#0d631b"
              stroke="white"
              strokeWidth={1.5}
            >
              <title>{`${p.pct.toFixed(1)}%`}</title>
            </circle>
          ))}
        </svg>

        <span className="absolute top-1 right-2 text-[10px] font-bold uppercase tracking-wide text-error/80">
          Critical Band &gt; 5%
        </span>
      </div>

      <div className="relative h-6 mt-3 text-[11px] font-mono text-on-surface-variant">
        {points.map((p, i) => {
          const step = Math.max(1, Math.floor(points.length / 6));
          const isFirst = i === 0;
          const isLast = i === points.length - 1;
          const includeDate = points.length > 24;
          
          if (!isFirst && !isLast) {
            if (i % step !== 0) return null;
            // Prevent overlapping with the last label if it's too close
            if (points.length - 1 - i < step * 0.65) return null;
          }
          
          return (
            <span
              key={i}
              className={`absolute top-0 whitespace-nowrap ${isFirst ? 'left-0' : isLast ? 'right-0' : '-translate-x-1/2'}`}
              style={!isFirst && !isLast ? { left: `${(p.x / W) * 100}%` } : undefined}
            >
              {formatHourLabel(p.hour, includeDate)}
            </span>
          );
        })}
      </div>
    </section>
  );
}
