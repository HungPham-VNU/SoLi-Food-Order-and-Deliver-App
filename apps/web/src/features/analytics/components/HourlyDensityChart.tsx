import type { HourlyDensityPoint } from '@/features/analytics/types';

function formatHourLabel(iso: string, includeDate: boolean = false): string {
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

/**
 * Merge two hourly series (current + baseline) on the union of hours so the
 * chart can render aligned bars even when the windows differ in length.
 */
function mergeSeries(
  current: HourlyDensityPoint[],
  baseline: HourlyDensityPoint[] | undefined,
) {
  const map = new Map<string, { current: number; baseline: number }>();
  for (const p of current) {
    const key = formatHourLabel(p.hour);
    const entry = map.get(key) ?? { current: 0, baseline: 0 };
    entry.current = p.count;
    map.set(key, entry);
  }
  if (baseline) {
    for (const p of baseline) {
      const key = formatHourLabel(p.hour);
      const entry = map.get(key) ?? { current: 0, baseline: 0 };
      entry.baseline = p.count;
      map.set(key, entry);
    }
  }
  return Array.from(map.entries()).map(([hour, v]) => ({ hour, ...v }));
}

export function HourlyDensityChart({
  current,
  baseline,
  showBaseline,
}: {
  current: HourlyDensityPoint[];
  baseline?: HourlyDensityPoint[];
  showBaseline: boolean;
}) {
  const merged = mergeSeries(current, showBaseline ? baseline : undefined);

  if (merged.length === 0) {
    return (
      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm p-6">
        <h3 className="font-headline text-lg font-bold text-on-surface mb-2">
          Hourly Order Density
        </h3>
        <p className="text-sm text-on-surface-variant py-10 text-center">
          No orders in this window yet.
        </p>
      </section>
    );
  }

  const max = Math.max(...merged.flatMap((p) => [p.current, p.baseline]), 1);

  return (
    <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h3 className="font-headline text-lg font-bold text-on-surface">
          Hourly Order Density
        </h3>
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
            <span className="w-3 h-3 rounded-full bg-primary" /> Current
          </span>
          {showBaseline && (
            <span className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
              <span className="w-3 h-3 rounded-full bg-on-surface-variant/30" /> 7-day Average
            </span>
          )}
        </div>
      </div>

      <div className="relative h-64 w-full">
        <div className="absolute left-0 top-0 bottom-6 w-10 flex flex-col justify-between text-[10px] font-mono text-on-surface-variant/70 pb-1">
          <span>{max}</span>
          <span>{Math.round(max * 0.75)}</span>
          <span>{Math.round(max * 0.5)}</span>
          <span>{Math.round(max * 0.25)}</span>
          <span>0</span>
        </div>

        <div className="ml-10 h-[calc(100%-1.5rem)] border-l border-b border-outline-variant/40 relative overflow-x-auto overflow-y-hidden custom-scrollbar">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none min-w-[800px]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-full border-t border-outline-variant/15" />
            ))}
          </div>

          <div className="absolute inset-0 flex items-end justify-around px-2 min-w-[800px]" style={{ minWidth: `${Math.max(merged.length * 16, 800)}px` }}>
            {merged.map((point) => (
              <div key={point.hour} className="group flex items-end gap-1 h-full shrink-0">
                <div
                  className="w-3 sm:w-4 bg-primary rounded-t-sm transition-all group-hover:brightness-110"
                  style={{ height: `${(point.current / max) * 100}%` }}
                  title={`Current · ${point.current}`}
                />
                {showBaseline && (
                  <div
                    className="w-3 sm:w-4 bg-on-surface-variant/25 rounded-t-sm transition-all group-hover:bg-on-surface-variant/40"
                    style={{ height: `${(point.baseline / max) * 100}%` }}
                    title={`Baseline · ${point.baseline}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="ml-10 mt-2 flex justify-around text-[11px] font-mono text-on-surface-variant uppercase overflow-hidden relative">
          <div className="flex justify-around w-full" style={{ minWidth: `${Math.max(merged.length * 16, 800)}px` }}>
            {merged.map((p, i) => {
              const step = Math.max(1, Math.floor(merged.length / 8));
              return (
                <span key={p.hour} className={i % step !== 0 && i !== merged.length - 1 ? 'invisible' : ''}>
                  {p.hour}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
