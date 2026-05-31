import type { FailureSegment } from '@/features/analytics/types';

export function FailureDonut({ segments }: { segments: FailureSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const cx = 112;
  const cy = 112;

  // Precompute each arc's dash/offset purely so the JSX callback has no side effects.
  const arcs = segments.reduce<
    Array<{
      seg: FailureSegment;
      dash: number;
      gap: number;
      offset: number;
    }>
  >((acc, seg) => {
    const ratio = total > 0 ? seg.count / total : 0;
    const dash = ratio * circumference;
    const gap = circumference - dash;
    const consumed = acc.reduce((sum, a) => sum + a.dash, 0);
    acc.push({ seg, dash, gap, offset: -consumed });
    return acc;
  }, []);

  return (
    <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm p-6 h-full">
      <h3 className="font-headline text-lg font-bold text-on-surface mb-6">
        Why Orders Failed
      </h3>

      <div className="relative h-56 flex items-center justify-center">
        <svg width="224" height="224" className="-rotate-90">
          <circle cx={cx} cy={cy} r={radius} fill="transparent" stroke="#f3f3f3" strokeWidth={28} />
          {arcs.map(({ seg, dash, gap, offset }) => (
            <circle
              key={seg.label}
              cx={cx}
              cy={cy}
              r={radius}
              fill="transparent"
              stroke={seg.color}
              strokeWidth={28}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-headline font-bold text-4xl text-on-surface font-mono">
            {total}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant mt-1">
            Total Failures
          </span>
        </div>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6">
        {segments.map((seg) => (
          <li
            key={seg.label}
            className="flex items-center gap-3 bg-surface-container-low rounded-lg px-3 py-2"
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-sm font-medium text-on-surface truncate">
              {seg.label}
            </span>
            <span className="ml-auto font-mono text-xs text-on-surface-variant">
              {seg.count}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
