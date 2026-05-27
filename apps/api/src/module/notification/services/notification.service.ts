import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  type NotificationType,
  type NotificationChannel,
  type Notification,
} from '../domain/notification.schema';
import type { NotificationPreference } from '../domain/notification-preference.schema';
import { DEFAULT_PREFERENCES } from '../domain/notification-preference.schema';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationPreferenceRepository } from '../repositories/notification-preference.repository';
import { UserEmailRepository } from '../repositories/user-email.repository';
import { DeviceTokenRepository } from '../repositories/device-token.repository';
import { NotificationTemplateService } from './notification-template.service';
import { ChannelDispatcherService } from './channel-dispatcher.service';
import { QuietHoursService } from './quiet-hours.service';
import { NotificationGateway } from '../gateway/notification.gateway';
import { WS_NOTIFICATION_READ } from '../gateway/notification-payload.dto';
import { RedisService } from '@/lib/redis/redis.service';
import type {
  NotificationInboxQueryDto,
  NotificationInboxResponseDto,
  NotificationItemDto,
} from '../dto/notification.dto';
import type {
  RegisterPushTokenDto,
  RegisterPushTokenResponseDto,
  RemovePushTokenResponseDto,
  PushTokenListResponseDto,
} from '../dto/device-token.dto';
import type {
  UpdateNotificationPreferenceDto,
  NotificationPreferenceResponseDto,
} from '../dto/preference.dto';
import { runObserved } from '@/observability/trace';

// ---------------------------------------------------------------------------
// Input type for sendFromEvent
// ---------------------------------------------------------------------------
export interface SendFromEventParams {
  /** Notification type — determines template + routing */
  type: NotificationType;
  /** IAM userId of the recipient */
  recipientId: string;
  /** Role string stored on the notification row (for admin queries) */
  recipientRole: string;
  /**
   * Source entity ID used to derive the idempotency key.
   * For order events: orderId.
   * For payment events: orderId (the payment row is linked by orderId).
   */
  sourceId: string;
  /** Template interpolation variables (all values must be strings) */
  templateData: Record<string, string>;
  /** Channels to attempt delivery on */
  channels: NotificationChannel[];
  /** Optional — stored on the notification row for admin queries */
  orderId?: string;
}

// ---------------------------------------------------------------------------
// NotificationService
//
// Phase N-4 additions over N-3:
//   sendFromEvent() now delegates per-channel delivery to ChannelDispatcherService
//   (fire-and-forget) instead of handling in-app WebSocket directly. The
//   ChannelDispatcherService routes to InAppChannelService, EmailChannelService,
//   or PushChannelService and records delivery logs + status updates.
//
//   New public methods (N-4):
//     getPreferences(userId)          — GET /notifications/my/preferences
//     updatePreferences(userId, dto)  — PATCH /notifications/my/preferences
//     registerPushToken(userId, dto)  — POST /notifications/my/push-tokens
//     removePushToken(userId, token)  — DELETE /notifications/my/push-tokens
//
// Phase N-3 adds:
//   getInbox, getUnreadCount, markRead, markAllRead (inbox REST API).
//
// Phase N-2 adds:
//   In-app WebSocket delivery (now extracted to InAppChannelService).
//
// Architecture decisions:
//  - NEVER throw from sendFromEvent — it is called from @EventsHandler.
//  - Idempotency key: notif:{type}:{sourceId}:{recipientId}:{channel}
//  - Channel dispatch is fire-and-forget (void) — delivery failures never
//    propagate back to the originating event handler.
//  - markRead / markAllRead still emit WS read-state events directly
//    (they are not "deliveries" — they are cross-tab synchronization).
//
// Phase: N-4 — Multi-Channel Delivery
// Phase: N-5 — Preferences + Device Token Cleanup
//   isChannelEnabled() now accepts the current instant so it can evaluate
//   quiet hours. QuietHoursService handles timezone-aware computation.
//   Only the push channel is suppressed during quiet hours; in_app is
//   always persisted. Critical types (system_announcement,
//   new_order_received) bypass quiet hours the same way they bypass mutes.
// ---------------------------------------------------------------------------
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /** Redis key for the per-user unread count cache. TTL: 5 minutes. */
  private static readonly UNREAD_CACHE_TTL_SECONDS = 300;

  constructor(
    private readonly notificationRepo: NotificationRepository,
    private readonly preferenceRepo: NotificationPreferenceRepository,
    private readonly userEmailRepo: UserEmailRepository,
    private readonly deviceTokenRepo: DeviceTokenRepository,
    private readonly templateService: NotificationTemplateService,
    private readonly redisService: RedisService,
    private readonly channelDispatcher: ChannelDispatcherService,
    private readonly quietHours: QuietHoursService,
    // @Optional() prevents a hard DI error when NotificationGateway is not
    // yet registered (e.g. in unit tests that only test DB persistence).
    // In production, the gateway is always present in NotificationModule.
    //
    // IMPORTANT: Do NOT use a union type like `NotificationGateway | null` here.
    // TypeScript compiles union types to `Object` in Reflect.metadata (emitDecoratorMetadata).
    // NestJS reads that metadata to resolve DI tokens. With `Object` as the type, NestJS
    // cannot match the `NotificationGateway` provider and @Optional() silently injects
    // `undefined`, causing `this.notificationGateway` to always be falsy and the realtime
    // emit to be skipped silently. The plain class type is required for correct DI resolution.
    @Optional() private readonly notificationGateway: NotificationGateway,
  ) {
    this.logger.log(
      `[NotificationService] Gateway DI: ${notificationGateway ? 'NotificationGateway injected — realtime enabled' : 'NotificationGateway NOT injected — realtime disabled (unit test mode)'}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Redis helpers
  // ---------------------------------------------------------------------------

  /** Redis key for the user's unread in-app notification count. */
  private unreadCacheKey(userId: string): string {
    return `unread:${userId}`;
  }

  /**
   * Invalidate the cached unread count for a user.
   * Called after any write operation that changes the unread count:
   *   - New in_app notification persisted (sendFromEvent)
   *   - markRead
   *   - markAllRead
   *
   * Uses DEL so the next getUnreadCount call re-computes from the DB.
   */
  private async invalidateUnreadCache(userId: string): Promise<void> {
    try {
      await this.redisService.del(this.unreadCacheKey(userId));
    } catch (err) {
      // Cache invalidation failure must never crash business logic.
      this.logger.warn(
        `[Notification] Failed to invalidate unread cache for userId=${userId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Persist one notification row per requested channel after verifying
   * recipient opt-in preferences.
   *
   * Returns the count of rows successfully persisted (0 when all channels
   * are filtered out by preferences or all rows already existed).
   *
   * After persisting, dispatches each new row to ChannelDispatcherService
   * as a fire-and-forget operation. Channel delivery failures never affect
   * the return value or propagate to the caller.
   */
  async sendFromEvent(params: SendFromEventParams): Promise<number> {
    return runObserved(
      'notification.send',
      {
        type: params.type,
        recipientRole: params.recipientRole,
        channelCount: params.channels.length,
        channels: params.channels.join(','),
        hasOrderId: params.orderId !== undefined,
      },
      () => this.sendFromEventInternal(params),
    );
  }

  private async sendFromEventInternal(
    params: SendFromEventParams,
  ): Promise<number> {
    const {
      type,
      recipientId,
      recipientRole,
      sourceId,
      templateData,
      channels,
      orderId,
    } = params;

    this.logger.log(
      `[Notification] sendFromEvent start: type=${type} recipientId=${recipientId} sourceId=${sourceId} channels=[${channels.join(',')}]`,
    );

    try {
      // 1. Load preferences (fall back to defaults when no row exists)
      const prefRow = await this.preferenceRepo.findByUserId(recipientId);
      const prefs = prefRow ?? DEFAULT_PREFERENCES;

      // 2. Filter to opted-in channels (preference gate + quiet hours)
      const now = new Date();
      const enabledChannels = channels.filter((ch) =>
        this.isChannelEnabled(prefs, type, ch, now),
      );

      this.logger.log(
        `[Notification] Channels after preference filter: requested=[${channels.join(',')}] enabled=[${enabledChannels.join(',')}]`,
      );

      if (enabledChannels.length === 0) {
        this.logger.debug(
          `[Notification] All channels filtered by preferences for user=${recipientId} type=${type}`,
        );
        return 0;
      }

      // 3. Render template (compute once for all channels)
      const { title, body } = this.templateService.render(type, templateData);

      // 4. Resolve recipient email for the delivery context.
      //
      // Primary source: notification_preferences.email (denormalised, set by
      //   the user via PATCH /notifications/my/preferences).
      // Fallback source: user.email (Better Auth table) — used when the user
      //   has never explicitly set their notification email. This is the
      //   common case for new users who have not called the preferences API.
      //
      // When we resolve via fallback and the email channel is requested,
      // we also backfill notification_preferences.email so that subsequent
      // sends skip the user table lookup (fire-and-forget, errors absorbed).
      let resolvedEmail: string | null = prefRow?.email ?? null;

      if (!resolvedEmail && enabledChannels.includes('email')) {
        const authEmail =
          await this.userEmailRepo.findEmailByUserId(recipientId);
        if (authEmail) {
          resolvedEmail = authEmail;
          this.logger.log(
            `[Notification] Resolved email from user table for recipientId=${recipientId}: ${authEmail}. Backfilling notification_preferences.`,
          );
          // Backfill: upsert the email into notification_preferences so the
          // next event delivery is fast (no user table lookup needed).
          void this.preferenceRepo
            .upsert({
              userId: recipientId,
              email: authEmail,
              // Merge with existing prefs or use defaults — only email column changes.
              pushEnabled:
                prefRow?.pushEnabled ?? DEFAULT_PREFERENCES.pushEnabled,
              inAppEnabled:
                prefRow?.inAppEnabled ?? DEFAULT_PREFERENCES.inAppEnabled,
              emailEnabled:
                prefRow?.emailEnabled ?? DEFAULT_PREFERENCES.emailEnabled,
              smsEnabled: prefRow?.smsEnabled ?? DEFAULT_PREFERENCES.smsEnabled,
              quietHoursStart:
                prefRow?.quietHoursStart ?? DEFAULT_PREFERENCES.quietHoursStart,
              quietHoursEnd:
                prefRow?.quietHoursEnd ?? DEFAULT_PREFERENCES.quietHoursEnd,
              mutedTypes: prefRow?.mutedTypes ?? DEFAULT_PREFERENCES.mutedTypes,
              timezone: prefRow?.timezone ?? DEFAULT_PREFERENCES.timezone,
            })
            .catch((upsertErr: Error) => {
              this.logger.warn(
                `[Notification] Failed to backfill email into notification_preferences for userId=${recipientId}: ${upsertErr.message}`,
              );
            });
        } else {
          this.logger.warn(
            `[Notification] No email found for recipientId=${recipientId} in notification_preferences or user table — email channel will be skipped`,
          );
        }
      }

      const deliveryContext = {
        recipientId,
        email: resolvedEmail,
      };

      // 5. Persist one row per enabled channel (idempotent via ON CONFLICT DO NOTHING)
      let persisted = 0;
      for (const channel of enabledChannels) {
        const idempotencyKey = `notif:${type}:${sourceId}:${recipientId}:${channel}`;

        // Expiry: 90 days from now for in_app; no expiry for audit channels
        const expiresAt =
          channel === 'in_app'
            ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
            : null;

        const row = await this.notificationRepo.insertIfNotExists({
          recipientId,
          recipientRole,
          type,
          channel,
          title,
          body,
          data: templateData,
          status: 'pending',
          isRead: false,
          orderId: orderId ?? null,
          idempotencyKey,
          deliveryAttempts: 0,
          expiresAt,
        });

        if (row) {
          persisted++;
          this.logger.log(
            `[Notification] Persisted: id=${row.id} type=${type} channel=${channel} recipient=${recipientId}`,
          );

          // Fire-and-forget: dispatch to channel adapter.
          // The ChannelDispatcherService handles in_app (WS + cache),
          // email (SMTP), and push (FCM). Errors are absorbed internally.
          void this.channelDispatcher.dispatch(row, deliveryContext);
        } else {
          this.logger.debug(
            `[Notification] Skipped duplicate: idempotencyKey=${idempotencyKey}`,
          );
        }
      }

      return persisted;
    } catch (err) {
      // NEVER propagate — event handlers must not fail upstream transactions
      this.logger.error(
        `[Notification] sendFromEvent failed for type=${type} recipient=${recipientId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Preference helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns true when the channel is enabled AND the notification type is
   * not muted by the user AND (for push) it is not currently quiet hours.
   *
   * Gate order:
   *  1. Per-channel opt-in flag (pushEnabled, inAppEnabled, emailEnabled…)
   *  2. Admin/system bypass — critical types skip mute + quiet-hours checks
   *  3. Muted notification types
   *  4. Quiet hours (push channel only — in_app is always persisted)
   *
   * The `now` parameter is injected by sendFromEvent so tests can control
   * the clock without patching global Date.
   */
  private isChannelEnabled(
    prefs: typeof DEFAULT_PREFERENCES,
    type: NotificationType,
    channel: NotificationChannel,
    now: Date = new Date(),
  ): boolean {
    const isAdminOrSystem =
      type === 'system_announcement' || type === 'new_order_received';

    // 1. Per-channel opt-in
    const channelEnabled = {
      in_app: prefs.inAppEnabled,
      push: prefs.pushEnabled,
      email: prefs.emailEnabled,
      sms: prefs.smsEnabled,
    }[channel];

    if (!channelEnabled) return false;

    // 2. Critical types bypass all preference gates
    if (isAdminOrSystem) return true;

    // 3. Muted notification types
    if (prefs.mutedTypes?.includes(type)) return false;

    // 4. Quiet hours — only suppresses the push channel
    //    In-app notifications are always persisted so users can review them
    //    in their inbox when they wake up.
    if (channel === 'push' && this.quietHours.isQuietHours(prefs, now)) {
      this.logger.debug(
        `[Notification] Push suppressed by quiet hours for type=${type}`,
      );
      return false;
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // Phase N-3 — Inbox REST API methods
  // ---------------------------------------------------------------------------

  /**
   * Map a Notification domain row to the NotificationItemDto shape.
   */
  private toItemDto(row: Notification): NotificationItemDto {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: row.data ?? undefined,
      orderId: row.orderId ?? undefined,
      isRead: row.isRead,
      readAt: row.readAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Fetch a paginated page of a user's in-app inbox.
   *
   * Runs three parallel queries:
   *  1. Fetch the page of notification rows (with optional filters)
   *  2. Count total matching rows (for pagination metadata)
   *  3. Read the user's current unread count (Redis-cached or DB fallback)
   *
   * Phase N-3
   */
  async getInbox(
    userId: string,
    query: NotificationInboxQueryDto,
  ): Promise<NotificationInboxResponseDto> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const filters = { unreadOnly: query.unreadOnly, type: query.type };

    const [rows, total, unreadCount] = await Promise.all([
      this.notificationRepo.findInboxByUserId(userId, limit, offset, filters),
      this.notificationRepo.countInbox(userId, filters),
      this.getUnreadCount(userId),
    ]);

    return {
      items: rows.map((r) => this.toItemDto(r)),
      total,
      unreadCount,
      offset,
      limit,
      hasMore: offset + rows.length < total,
    };
  }

  /**
   * Return the total unread in-app notification count for a user.
   *
   * Redis cache strategy:
   *  - Cache key: `unread:{userId}` (TTL: 5 minutes)
   *  - On cache hit: return parsed integer directly (no DB query)
   *  - On cache miss: query DB via countUnread(), store result, return
   *  - Cache is invalidated (DEL) by: markRead, markAllRead, and sendFromEvent
   *    when a new in_app notification is persisted.
   *
   * Phase N-3
   */
  async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = this.unreadCacheKey(userId);
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached !== null) {
        return Number(cached);
      }
    } catch (err) {
      this.logger.warn(
        `[Notification] Redis cache read failed for userId=${userId}: ${(err as Error).message}`,
      );
    }

    const count = await this.notificationRepo.countUnread(userId);

    try {
      await this.redisService.setWithExpiry(
        cacheKey,
        String(count),
        NotificationService.UNREAD_CACHE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(
        `[Notification] Redis cache write failed for userId=${userId}: ${(err as Error).message}`,
      );
    }

    return count;
  }

  /**
   * Mark a single notification as read (idempotent).
   *
   * Ownership is enforced at the DB level: the UPDATE WHERE clause includes
   * both `id = :id` AND `recipient_id = :userId`. If the notification belongs
   * to a different user, or does not exist, the repository returns null and
   * this method returns false.
   *
   * After a successful mark-read:
   *  - Redis unread count cache is invalidated.
   *  - A `notification.read` WebSocket event is emitted to the user's room
   *    so that other open tabs reflect the read state immediately.
   *
   * Phase N-3
   */
  async markRead(userId: string, notificationId: string): Promise<boolean> {
    const row = await this.notificationRepo.markRead(notificationId, userId);
    if (!row) {
      // Either not found or belongs to a different user — return false (not 404)
      // so the controller can respond with { success: false } without leaking
      // whether the notification exists.
      return false;
    }

    // Invalidate unread cache
    void this.invalidateUnreadCache(userId);

    // Emit cross-tab sync event
    if (this.notificationGateway) {
      try {
        this.notificationGateway.sendToUser(userId, WS_NOTIFICATION_READ, {
          id: notificationId,
          readAt: row.readAt?.toISOString() ?? new Date().toISOString(),
        });
      } catch (wsErr) {
        this.logger.warn(
          `[Notification] WS emit failed after markRead for id=${notificationId}: ${(wsErr as Error).message}`,
        );
      }
    }

    return true;
  }

  /**
   * Mark all unread in-app notifications as read for a user.
   *
   * After the bulk update:
   *  - Redis unread count cache is invalidated.
   *  - A `notification.read` WebSocket event with `{ all: true }` is emitted
   *    to the user's room so that all open tabs clear their unread indicators.
   *
   * Returns the count of rows that were updated (0 when already all read).
   *
   * Phase N-3
   */
  async markAllRead(userId: string): Promise<number> {
    const count = await this.notificationRepo.markAllRead(userId);

    if (count > 0) {
      // Only invalidate cache and emit if rows were actually changed.
      void this.invalidateUnreadCache(userId);

      if (this.notificationGateway) {
        try {
          this.notificationGateway.sendToUser(userId, WS_NOTIFICATION_READ, {
            all: true,
            readAt: new Date().toISOString(),
          });
        } catch (wsErr) {
          this.logger.warn(
            `[Notification] WS emit failed after markAllRead for userId=${userId}: ${(wsErr as Error).message}`,
          );
        }
      }
    }

    return count;
  }

  // ---------------------------------------------------------------------------
  // Phase N-4 — Push Token Management
  // ---------------------------------------------------------------------------

  /**
   * Register (or refresh) a push device token for the current user.
   *
   * Uses ON CONFLICT DO UPDATE: re-registering an existing token refreshes
   * lastSeenAt (prevents premature cleanup by the stale-token cron) and
   * re-activates it if it was previously deactivated.
   *
   * Phase N-4
   */
  /**
   * Return all device tokens registered for a user (active + inactive).
   * Token values are masked to the last 8 chars for security — callers
   * only need to identify devices by platform and active state.
   *
   * Phase N-4
   */
  async getMyTokens(userId: string): Promise<PushTokenListResponseDto> {
    const rows = await this.deviceTokenRepo.findByUserId(userId);
    return {
      tokens: rows.map((t) => ({
        id: t.id,
        tokenSuffix: `…${t.token.slice(-8)}`,
        platform: t.platform,
        isActive: t.isActive,
        lastSeenAt: t.lastSeenAt.toISOString(),
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  async registerPushToken(
    userId: string,
    dto: RegisterPushTokenDto,
  ): Promise<RegisterPushTokenResponseDto> {
    await this.deviceTokenRepo.registerOrRefresh({
      userId,
      token: dto.token,
      platform: dto.platform,
      isActive: true,
      lastSeenAt: new Date(),
    });
    this.logger.log(
      `[Notification] Push token registered/refreshed for userId=${userId} platform=${dto.platform}`,
    );
    return { registered: true };
  }

  /**
   * Deactivate a push device token for the current user.
   *
   * Ownership is enforced at the DB level: the UPDATE WHERE clause includes
   * both `user_id = :userId` AND `token = :token`. A token belonging to
   * another user is silently ignored (returns { removed: true } regardless —
   * idempotent and does not leak whether the token exists for another user).
   *
   * Phase N-4
   */
  async removePushToken(
    userId: string,
    token: string,
  ): Promise<RemovePushTokenResponseDto> {
    await this.deviceTokenRepo.deactivate(userId, token);
    this.logger.log(
      `[Notification] Push token deactivated for userId=${userId}`,
    );
    return { removed: true };
  }

  // ---------------------------------------------------------------------------
  // Phase N-4 — Notification Preference Management
  // ---------------------------------------------------------------------------

  /**
   * Fetch the current user's notification preferences.
   * Returns system defaults when no preference row exists.
   *
   * Phase N-4
   */
  async getPreferences(
    userId: string,
  ): Promise<NotificationPreferenceResponseDto> {
    const row = await this.preferenceRepo.findByUserId(userId);
    if (!row) {
      return {
        pushEnabled: DEFAULT_PREFERENCES.pushEnabled,
        inAppEnabled: DEFAULT_PREFERENCES.inAppEnabled,
        emailEnabled: DEFAULT_PREFERENCES.emailEnabled,
        smsEnabled: DEFAULT_PREFERENCES.smsEnabled,
        quietHoursStart: DEFAULT_PREFERENCES.quietHoursStart,
        quietHoursEnd: DEFAULT_PREFERENCES.quietHoursEnd,
        mutedTypes: DEFAULT_PREFERENCES.mutedTypes ?? [],
        email: null,
        timezone: DEFAULT_PREFERENCES.timezone,
      };
    }
    return this.toPreferenceDto(row);
  }

  /**
   * Partially update the current user's notification preferences.
   *
   * Upserts a preference row (creates it on first update).
   * Only provided fields are changed — omitted fields retain their current
   * values (or defaults when the row does not exist yet).
   *
   * Phase N-4
   */
  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceResponseDto> {
    const existing = await this.preferenceRepo.findByUserId(userId);

    // Compute effective base values (existing row or system defaults)
    const base = {
      pushEnabled: existing?.pushEnabled ?? DEFAULT_PREFERENCES.pushEnabled,
      inAppEnabled: existing?.inAppEnabled ?? DEFAULT_PREFERENCES.inAppEnabled,
      emailEnabled: existing?.emailEnabled ?? DEFAULT_PREFERENCES.emailEnabled,
      smsEnabled: existing?.smsEnabled ?? DEFAULT_PREFERENCES.smsEnabled,
      quietHoursStart:
        existing?.quietHoursStart ?? DEFAULT_PREFERENCES.quietHoursStart,
      quietHoursEnd:
        existing?.quietHoursEnd ?? DEFAULT_PREFERENCES.quietHoursEnd,
      mutedTypes: existing?.mutedTypes ?? DEFAULT_PREFERENCES.mutedTypes ?? [],
      email: existing?.email ?? null,
      timezone: existing?.timezone ?? DEFAULT_PREFERENCES.timezone,
    };

    const updated = await this.preferenceRepo.upsert({
      userId,
      pushEnabled: dto.pushEnabled ?? base.pushEnabled,
      inAppEnabled: dto.inAppEnabled ?? base.inAppEnabled,
      emailEnabled: dto.emailEnabled ?? base.emailEnabled,
      smsEnabled: dto.smsEnabled ?? base.smsEnabled,
      quietHoursStart:
        dto.quietHoursStart !== undefined
          ? dto.quietHoursStart
          : base.quietHoursStart,
      quietHoursEnd:
        dto.quietHoursEnd !== undefined
          ? dto.quietHoursEnd
          : base.quietHoursEnd,
      mutedTypes: dto.mutedTypes ?? base.mutedTypes,
      email: dto.email !== undefined ? dto.email : base.email,
      timezone: dto.timezone ?? base.timezone,
    });

    this.logger.log(`[Notification] Preferences updated for userId=${userId}`);
    return this.toPreferenceDto(updated);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private toPreferenceDto(
    row: NotificationPreference,
  ): NotificationPreferenceResponseDto {
    return {
      pushEnabled: row.pushEnabled,
      inAppEnabled: row.inAppEnabled,
      emailEnabled: row.emailEnabled,
      smsEnabled: row.smsEnabled,
      quietHoursStart: row.quietHoursStart,
      quietHoursEnd: row.quietHoursEnd,
      mutedTypes: (row.mutedTypes as string[]) ?? [],
      email: row.email ?? null,
      timezone: row.timezone,
    };
  }
}
