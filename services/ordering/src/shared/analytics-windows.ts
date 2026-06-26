export interface DateWindow {
  start: Date;
  end: Date;
}

export type AnalyticsRange = 'today' | 'yesterday' | '7d';

export const ANALYTICS_RANGES = ['today', 'yesterday', '7d'] as const;

function startOfDayUtc(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

export function computeWindows(
  range: AnalyticsRange,
  now: Date,
): { current: DateWindow; baseline: DateWindow } {
  const todayStart = startOfDayUtc(now);

  switch (range) {
    case 'today': {
      return {
        current: { start: todayStart, end: now },
        baseline: { start: addDays(todayStart, -7), end: todayStart },
      };
    }
    case 'yesterday': {
      const yd = addDays(todayStart, -1);
      return {
        current: { start: yd, end: todayStart },
        baseline: { start: addDays(todayStart, -8), end: yd },
      };
    }
    case '7d': {
      const ago7 = addDays(todayStart, -7);
      return {
        current: { start: ago7, end: now },
        baseline: { start: addDays(todayStart, -14), end: ago7 },
      };
    }
  }
}
