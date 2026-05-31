const BUCKET_LABELS = ['0:00', '1:00', '2:00', '3:00', '4:00', '5:00'];

export function TimeToAcceptHistogram({ buckets }: { buckets: number[] }) {
  const max = Math.max(...buckets);

  return (
    <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm p-6 h-full">
      <div className="flex justify-between items-center mb-8 flex-wrap gap-2">
        <h3 className="font-headline text-lg font-bold text-on-surface">
          Time to Accept Distribution
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
          Seconds Range
        </span>
      </div>

      <div className="relative h-64 flex items-end justify-between gap-2 px-1">
        {/* Target line — kitchen aims for sub-3-minute accept */}
        <div className="absolute top-0 bottom-0 left-[60%] border-l-2 border-dashed border-secondary-container/80 z-10 pointer-events-none flex justify-center">
          <span className="absolute top-2 -translate-x-1/2 bg-surface-container-lowest border border-outline-variant px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-on-secondary-container whitespace-nowrap shadow-sm">
            Target · 3m
          </span>
        </div>

        {buckets.map((value, idx) => {
          const heightPct = Math.max((value / max) * 92, 4);
          const intensity = value / max;
          return (
            <div
              key={idx}
              className="relative flex-1 flex flex-col items-center justify-end h-full"
            >
              <div
                className="w-full rounded-t-sm transition-all hover:brightness-95"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: `color-mix(in oklab, var(--primary) ${20 + intensity * 70}%, white)`,
                }}
                title={`${value} orders`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-4 px-1 text-[11px] font-mono text-on-surface-variant">
        {BUCKET_LABELS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </section>
  );
}
