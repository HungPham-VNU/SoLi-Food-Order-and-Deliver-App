import { Test, TestingModule } from '@nestjs/testing';
import { QuietHoursService } from './quiet-hours.service';

/**
 * QuietHoursService unit tests
 *
 * All tests use Jest's fake-timer helpers to control the current instant so
 * results are deterministic regardless of when the test suite runs.
 *
 * The timezone used throughout is 'Asia/Ho_Chi_Minh' (UTC+7) unless a
 * specific per-test timezone is exercised.
 *
 * Covered scenarios
 * ─────────────────
 * Normal (daytime) window:
 *   1.  Hour inside window → true
 *   2.  Hour equal to start boundary → true (inclusive)
 *   3.  Hour equal to end boundary → false (exclusive)
 *   4.  Hour outside window → false
 *
 * Overnight (midnight-crossing) window:
 *   5.  Hour after start (evening) → true
 *   6.  Hour before end (early morning) → true
 *   7.  Exactly midnight (hour 0) inside overnight window → true
 *   8.  Hour inside the daytime gap of overnight window → false
 *   9.  Hour equal to end of overnight window → false (exclusive)
 *
 * Disabled configurations:
 *  10.  quietHoursStart is null → false
 *  11.  quietHoursEnd is null → false
 *  12.  Both null → false
 *  13.  start === end (zero-length window) → false
 *
 * Invalid timezone:
 *  14.  Invalid timezone string → false (graceful fallback)
 *
 * Default instant (no 'now' argument):
 *  15.  Called without 'now' parameter — should not throw
 *
 * Phase: N-5
 */
describe('QuietHoursService', () => {
  let service: QuietHoursService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuietHoursService],
    }).compile();

    service = module.get<QuietHoursService>(QuietHoursService);
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Build a Date object representing the given local time in
   * 'Asia/Ho_Chi_Minh' (UTC+7). Returns the UTC Date that corresponds to
   * that local hour inside the timezone.
   */
  function makeHCMTime(localHour: number): Date {
    // UTC offset for 'Asia/Ho_Chi_Minh' is +07:00.
    // We derive the UTC hour by subtracting 7 (mod 24).
    const utcHour = (((localHour - 7) % 24) + 24) % 24;
    const d = new Date('2025-01-15T00:00:00.000Z'); // fixed date, any date
    d.setUTCHours(utcHour, 0, 0, 0);
    return d;
  }

  const TZ = 'Asia/Ho_Chi_Minh';

  // ── Normal daytime window ────────────────────────────────────────────────────

  describe('normal daytime window (start < end)', () => {
    const prefs = { quietHoursStart: 9, quietHoursEnd: 17, timezone: TZ };

    it('returns true when hour is inside the window (midday, hour=12)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(12))).toBe(true);
    });

    it('returns true at start boundary (hour=9 — inclusive)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(9))).toBe(true);
    });

    it('returns false at end boundary (hour=17 — exclusive)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(17))).toBe(false);
    });

    it('returns false before window (hour=8)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(8))).toBe(false);
    });

    it('returns false after window (hour=18)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(18))).toBe(false);
    });
  });

  // ── Overnight (midnight-crossing) window ────────────────────────────────────

  describe('overnight window (start > end) — e.g. 22:00–07:00', () => {
    const prefs = { quietHoursStart: 22, quietHoursEnd: 7, timezone: TZ };

    it('returns true at start boundary (hour=22)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(22))).toBe(true);
    });

    it('returns true in the evening portion (hour=23)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(23))).toBe(true);
    });

    it('returns true exactly at midnight (hour=0)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(0))).toBe(true);
    });

    it('returns true in the early-morning portion (hour=3)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(3))).toBe(true);
    });

    it('returns true at hour=6 (inside, one before end)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(6))).toBe(true);
    });

    it('returns false at end boundary (hour=7 — exclusive)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(7))).toBe(false);
    });

    it('returns false in the daytime gap (hour=12)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(12))).toBe(false);
    });

    it('returns false just before start (hour=21)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(21))).toBe(false);
    });
  });

  // ── Edge: start=23, end=0 (one-hour overnight window) ───────────────────────

  describe('narrow overnight window: start=23, end=0', () => {
    const prefs = { quietHoursStart: 23, quietHoursEnd: 0, timezone: TZ };

    it('returns true at hour=23 (start boundary)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(23))).toBe(true);
    });

    it('returns false at hour=0 (end boundary, exclusive)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(0))).toBe(false);
    });

    it('returns false at hour=22 (before window)', () => {
      expect(service.isQuietHours(prefs, makeHCMTime(22))).toBe(false);
    });
  });

  // ── Disabled configurations ──────────────────────────────────────────────────

  describe('disabled quiet hours', () => {
    it('returns false when quietHoursStart is null', () => {
      const prefs = { quietHoursStart: null, quietHoursEnd: 7, timezone: TZ };
      expect(service.isQuietHours(prefs, makeHCMTime(3))).toBe(false);
    });

    it('returns false when quietHoursEnd is null', () => {
      const prefs = { quietHoursStart: 22, quietHoursEnd: null, timezone: TZ };
      expect(service.isQuietHours(prefs, makeHCMTime(23))).toBe(false);
    });

    it('returns false when both are null', () => {
      const prefs = {
        quietHoursStart: null,
        quietHoursEnd: null,
        timezone: TZ,
      };
      expect(service.isQuietHours(prefs, makeHCMTime(12))).toBe(false);
    });

    it('returns false when start === end (zero-length window)', () => {
      const prefs = { quietHoursStart: 8, quietHoursEnd: 8, timezone: TZ };
      expect(service.isQuietHours(prefs, makeHCMTime(8))).toBe(false);
    });

    it('returns false when start === end === 0', () => {
      const prefs = { quietHoursStart: 0, quietHoursEnd: 0, timezone: TZ };
      expect(service.isQuietHours(prefs, makeHCMTime(0))).toBe(false);
    });
  });

  // ── Invalid timezone ─────────────────────────────────────────────────────────

  describe('invalid timezone', () => {
    it('returns false and does not throw for an invalid timezone string', () => {
      const prefs = {
        quietHoursStart: 22,
        quietHoursEnd: 7,
        timezone: 'Not/A_Valid_Timezone',
      };
      expect(() => service.isQuietHours(prefs, new Date())).not.toThrow();
      expect(service.isQuietHours(prefs, new Date())).toBe(false);
    });
  });

  // ── No 'now' argument ────────────────────────────────────────────────────────

  describe('default clock (no now parameter)', () => {
    it('does not throw when called without a now argument', () => {
      const prefs = { quietHoursStart: 22, quietHoursEnd: 7, timezone: TZ };
      expect(() => service.isQuietHours(prefs)).not.toThrow();
    });
  });

  // ── UTC timezone cross-check ─────────────────────────────────────────────────

  describe('different timezone (UTC)', () => {
    const utcPrefs = { quietHoursStart: 0, quietHoursEnd: 6, timezone: 'UTC' };

    it('returns true at UTC 00:00 (midnight)', () => {
      // Midnight UTC
      const midnight = new Date('2025-01-15T00:30:00.000Z');
      expect(service.isQuietHours(utcPrefs, midnight)).toBe(true);
    });

    it('returns false at UTC 06:00 (end boundary, exclusive)', () => {
      const sixAm = new Date('2025-01-15T06:00:00.000Z');
      expect(service.isQuietHours(utcPrefs, sixAm)).toBe(false);
    });

    it('returns false at UTC 12:00 (noon)', () => {
      const noon = new Date('2025-01-15T12:00:00.000Z');
      expect(service.isQuietHours(utcPrefs, noon)).toBe(false);
    });
  });
});
