import { computeWindows } from './analytics-windows';

describe('computeWindows', () => {
  it('creates current and prior 30-day windows', () => {
    const now = new Date('2026-06-23T10:30:00.000Z');

    const windows = computeWindows('30d', now);

    expect(windows.current).toEqual({
      start: new Date('2026-05-24T00:00:00.000Z'),
      end: now,
    });
    expect(windows.baseline).toEqual({
      start: new Date('2026-04-24T00:00:00.000Z'),
      end: new Date('2026-05-24T00:00:00.000Z'),
    });
  });
});
