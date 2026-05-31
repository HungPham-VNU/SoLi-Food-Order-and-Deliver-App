import type { KitchenKpi, KpiDelta } from '@/features/analytics/types';

type Tone = 'good' | 'bad' | 'flat';

/**
 * Resolve a metric's `direction` into a tone. `up` is bad here — all the
 * metrics on the page (time, refund rate, auto-cancel) are improvements when
 * they shrink.
 */
function toneFor(direction: KpiDelta['direction']): Tone {
  if (direction === 'down') return 'good';
  if (direction === 'up') return 'bad';
  return 'flat';
}

function presentation(tone: Tone) {
  if (tone === 'good') {
    return { bg: 'bg-primary/10', text: 'text-primary', icon: 'arrow_downward' };
  }
  if (tone === 'bad') {
    return {
      bg: 'bg-error-container/40',
      text: 'text-error',
      icon: 'arrow_upward',
    };
  }
  return {
    bg: 'bg-surface-container',
    text: 'text-on-surface-variant',
    icon: 'horizontal_rule',
  };
}

/** Build the human-readable delta phrase for a metric. */
function deltaPhrase(card: KpiDelta, units: 'seconds' | 'percent'): string {
  if (card.direction === 'flat') return 'Stable vs baseline';
  const abs = Math.abs(card.delta);
  if (units === 'seconds') {
    const display =
      abs >= 60
        ? `${Math.floor(abs / 60)}m ${String(abs % 60).padStart(2, '0')}s`
        : `${abs}s`;
    return card.direction === 'down' ? `${display} faster` : `${display} slower`;
  }
  const pct = (abs * 100).toFixed(1);
  return card.direction === 'down' ? `${pct}% improvement` : `${pct}% worse`;
}

function unitsFor(label: string): 'seconds' | 'percent' {
  return label.toLowerCase().includes('rate') ? 'percent' : 'seconds';
}

export function KpiRow({ kpi }: { kpi: KitchenKpi }) {
  const heroTone = toneFor(kpi.hero.direction);
  const heroPres = presentation(heroTone);

  return (
    <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
      {/* Hero KPI */}
      <article className="md:col-span-4 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm p-6 relative overflow-hidden flex flex-col justify-between min-h-[180px]">
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant mb-1">
            Kitchen Velocity
          </p>
          <p className="text-sm text-on-surface-variant">{kpi.hero.label}</p>
        </div>
        <div className="relative z-10 mt-6 flex items-baseline justify-between gap-3 flex-wrap">
          <span className="font-headline font-bold text-4xl md:text-5xl text-on-surface font-mono tracking-tight">
            {kpi.hero.value}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ${heroPres.bg} ${heroPres.text}`}
          >
            <span className="material-symbols-outlined text-[16px]">{heroPres.icon}</span>
            {deltaPhrase(kpi.hero, 'seconds')}
          </span>
        </div>

        <svg
          className="absolute bottom-0 left-0 right-0 h-20 z-0 opacity-60"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id="hero-spark" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0d631b" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0d631b" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,100 C20,80 40,90 60,40 C80,-10 90,60 100,20 L100,100 Z"
            fill="url(#hero-spark)"
          />
        </svg>
      </article>

      {/* Supporting trio */}
      <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
        {kpi.supporting.map((card) => {
          const tone = toneFor(card.direction);
          const pres = presentation(tone);
          const units = unitsFor(card.label);
          return (
            <article
              key={card.label}
              className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm p-6 flex flex-col justify-center"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant mb-2">
                {card.label}
              </p>
              <p className="font-headline font-bold text-2xl text-on-surface font-mono tracking-tight mb-3">
                {card.value}
              </p>
              <div className={`inline-flex items-center gap-1 text-xs font-semibold ${pres.text}`}>
                <span className="material-symbols-outlined text-[16px]">{pres.icon}</span>
                <span>{deltaPhrase(card, units)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
