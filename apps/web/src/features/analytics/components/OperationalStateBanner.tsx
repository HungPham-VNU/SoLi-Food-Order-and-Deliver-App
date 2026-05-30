import type { OperationalState } from '@/features/analytics/types';

const STATUS_STYLES: Record<
  OperationalState['status'],
  { iconBg: string; iconText: string; icon: string; sparkColor: string }
> = {
  healthy: {
    iconBg: 'bg-primary/10',
    iconText: 'text-primary',
    icon: 'speed',
    sparkColor: '#0d631b',
  },
  attention: {
    iconBg: 'bg-secondary-container/40',
    iconText: 'text-on-secondary-container',
    icon: 'warning',
    sparkColor: '#D69E2E',
  },
  critical: {
    iconBg: 'bg-error-container/40',
    iconText: 'text-error',
    icon: 'crisis_alert',
    sparkColor: '#C44545',
  },
};

function formatSecondsDelta(seconds: number): {
  highlight: string;
  qualifier: string;
} {
  const abs = Math.abs(seconds);
  const display =
    abs >= 60
      ? `${Math.floor(abs / 60)}m ${String(abs % 60).padStart(2, '0')}s`
      : `${abs}s`;
  if (seconds < 0) return { highlight: `${display} faster`, qualifier: 'than baseline' };
  if (seconds > 0) return { highlight: `${display} slower`, qualifier: 'than baseline' };
  return { highlight: 'on pace', qualifier: 'with baseline' };
}

function copyForStatus(state: OperationalState): {
  headline: string;
  before: string;
  highlight: string;
  after: string;
} {
  const { highlight, qualifier } = formatSecondsDelta(state.deltaSeconds);

  if (state.status === 'critical') {
    return {
      headline:
        state.stuckOrderCount > 0
          ? `${state.stuckOrderCount} order${state.stuckOrderCount > 1 ? 's' : ''} stuck — review now`
          : 'Operations need attention',
      before: 'Kitchen is running ',
      highlight,
      after: ` ${qualifier}.`,
    };
  }
  if (state.status === 'attention') {
    return {
      headline: 'A small spike, watch closely',
      before: 'Kitchen is running ',
      highlight,
      after: ` ${qualifier}.`,
    };
  }
  return {
    headline: 'Operations are running smoothly',
    before: 'Kitchen is running ',
    highlight,
    after: `${qualifier === 'with baseline' ? '' : ' ' + qualifier}. No stuck orders.`,
  };
}

export function OperationalStateBanner({ state }: { state: OperationalState }) {
  const style = STATUS_STYLES[state.status];
  const copy = copyForStatus(state);

  const sparkline = state.sparkline.length > 0 ? state.sparkline : [0];
  const max = Math.max(...sparkline);
  const min = Math.min(...sparkline);
  const range = Math.max(max - min, 1);
  const points = sparkline
    .map((v, i) => {
      const x = (i / Math.max(sparkline.length - 1, 1)) * 100;
      const y = 30 - ((v - min) / range) * 22 - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastY = 30 - ((sparkline.at(-1)! - min) / range) * 22 - 4;

  return (
    <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm p-6 flex flex-col md:flex-row md:items-center gap-6 md:justify-between">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${style.iconBg}`}>
          <span className={`material-symbols-outlined text-[28px] ${style.iconText}`}>
            {style.icon}
          </span>
        </div>
        <div>
          <h2 className="font-headline text-lg font-bold text-on-surface mb-1">
            {copy.headline}
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {copy.before}
            <span className="font-mono font-semibold text-primary">{copy.highlight}</span>
            {copy.after}
          </p>
        </div>
      </div>

      <div className="h-12 w-48 shrink-0">
        <svg
          viewBox="0 0 100 30"
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id="banner-spark" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={style.sparkColor} stopOpacity="0.32" />
              <stop offset="100%" stopColor={style.sparkColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`${points} 100,30 0,30`} fill="url(#banner-spark)" />
          <polyline
            points={points}
            fill="none"
            stroke={style.sparkColor}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={100} cy={lastY} r={2.2} fill={style.sparkColor} />
        </svg>
      </div>
    </section>
  );
}
