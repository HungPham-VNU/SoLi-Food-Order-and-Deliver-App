import { Injectable, Logger } from '@nestjs/common';
import type { NotificationPreference } from '../domain/notification-preference.schema';

/**
 * QuietHoursService
 *
 * Timezone-aware quiet-hours evaluation.  All inputs are validated here;
 * invalid or missing configuration always returns `false` (not quiet) so that
 * notifications are never silently suppressed due to bad preference data.
 *
 * Design decisions
 * ─────────────────
 * • Quiet hours suppress only the **push** channel.  In-app notifications are
 *   always persisted regardless of quiet hours so users can review them in
 *   their inbox when they wake up.
 * • Critical notification types (`system_announcement`, `new_order_received`)
 *   bypass quiet hours — the caller is responsible for that gate.
 * • Overnight ranges are supported: start=22, end=7 means 22:00–06:59.
 * • Evaluation uses `Intl.DateTimeFormat` which relies on the host's ICU data;
 *   no external timezone libraries are required.
 */
@Injectable()
export class QuietHoursService {
  private readonly logger = new Logger(QuietHoursService.name);

  /**
   * Returns `true` when the given instant falls inside the user's configured
   * quiet-hours window, evaluated in the user's own timezone.
   *
   * @param prefs  The user's notification preference row (may be partial / default).
   * @param now    The instant to evaluate.  Defaults to `new Date()`.
   */
  isQuietHours(
    prefs: Pick<
      NotificationPreference,
      'quietHoursStart' | 'quietHoursEnd' | 'timezone'
    >,
    now: Date = new Date(),
  ): boolean {
    const { quietHoursStart: start, quietHoursEnd: end, timezone } = prefs;

    // Feature disabled when either boundary is null / undefined.
    if (start === null || start === undefined) return false;
    if (end === null || end === undefined) return false;

    // A zero-length window (start === end) is treated as disabled to avoid
    // accidentally suppressing all notifications.
    if (start === end) return false;

    const localHour = this.getLocalHour(now, timezone ?? 'Asia/Ho_Chi_Minh');
    if (localHour === null) return false;

    // Normal daytime window:  [start, end)
    if (start < end) {
      return localHour >= start && localHour < end;
    }

    // Overnight window:  [start, 24) ∪ [0, end)
    // e.g. start=22, end=7 → quiet from 22:00 until 06:59
    return localHour >= start || localHour < end;
  }

  /**
   * Returns the local hour (0–23) for the given instant in the specified
   * IANA timezone, or `null` when the timezone string is invalid.
   */
  private getLocalHour(now: Date, timezone: string): number | null {
    try {
      const parts = new Intl.DateTimeFormat('en', {
        hour: 'numeric',
        hour12: false,
        timeZone: timezone,
      }).formatToParts(now);

      const hourPart = parts.find((p) => p.type === 'hour');
      if (!hourPart) return null;

      // `Intl` may return "24" for midnight in some environments; normalise it.
      return Number(hourPart.value) % 24;
    } catch {
      this.logger.warn(
        `Invalid timezone "${timezone}" in notification preferences; quiet-hours disabled.`,
      );
      return null;
    }
  }
}
