/**
 * notification.service.spec.ts
 *
 * Unit tests for NotificationService.
 *
 * Covers:
 *  §1  sendFromEvent — core dispatch logic
 *    - Filters channels by user preferences (isChannelEnabled)
 *    - Creates one notification row per enabled channel
 *    - Fires channelDispatcher.dispatch fire-and-forget per new row
 *    - Uses correct idempotency key format
 *    - Returns 0 when all channels are preference-filtered
 *    - Skips duplicate rows (insertIfNotExists returns null)
 *    - Returns 0 and logs on unexpected exception (never throws)
 *    - Assigns correct expiresAt (90-day for in_app, null for others)
 *
 *  §2  isChannelEnabled — preference gate (tested via sendFromEvent)
 *    - Respects per-channel opt-out flags
 *    - Respects mutedTypes list
 *    - system_announcement bypasses muted types
 *    - new_order_received bypasses muted types
 *    - Falls back to DEFAULT_PREFERENCES when no preference row
 *
 *  §2b Quiet hours — push suppression during quiet window
 *    - Push channel suppressed when QuietHoursService returns true
 *    - in_app channel NOT suppressed during quiet hours
 *    - system_announcement bypasses quiet hours for push
 *    - new_order_received bypasses quiet hours for push
 *    - Push suppression does not affect email channel
 *
 *  §3  getPreferences / updatePreferences
 *    - getPreferences returns DEFAULT_PREFERENCES when no row
 *    - getPreferences maps row correctly
 *    - updatePreferences upserts merged values
 *
 *  §4  Push token management
 *    - registerPushToken calls repo.registerOrRefresh and returns { registered: true }
 *    - removePushToken calls repo.deactivate and returns { removed: true }
 *
 *  §5  Inbox / unread methods (spot checks)
 *    - markRead returns false when repo returns null
 *    - markRead returns true and emits WS event when row found
 *    - markAllRead invalidates cache and emits WS all:true
 *
 * Phase: N-4 — Multi-Channel Delivery
 * Phase: N-5 — Preferences + Device Token Cleanup (quiet hours gate)
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
// Mock the gateway module before any imports to avoid loading better-auth (ESM-only package)
// which is incompatible with the CommonJS unit test configuration.
jest.mock('../gateway/notification.gateway', () => ({
  NotificationGateway: class MockNotificationGateway {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationPreferenceRepository } from '../repositories/notification-preference.repository';
import { UserEmailRepository } from '../repositories/user-email.repository';
import { DeviceTokenRepository } from '../repositories/device-token.repository';
import { NotificationTemplateService } from './notification-template.service';
import { ChannelDispatcherService } from './channel-dispatcher.service';
import { QuietHoursService } from './quiet-hours.service';
import { NotificationGateway } from '../gateway/notification.gateway';
import { RedisService } from '@/lib/redis/redis.service';
import { DEFAULT_PREFERENCES } from '../domain/notification-preference.schema';
import type {
  Notification,
  NotificationChannel,
} from '../domain/notification.schema';
import type { NotificationPreference } from '../domain/notification-preference.schema';
import type { SendFromEventParams } from './notification.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotificationRow(
  overrides: Partial<Notification> = {},
): Notification {
  return {
    id: 'notif-uuid-svc-001',
    recipientId: 'user-uuid-001',
    recipientRole: 'customer',
    type: 'order_placed',
    channel: 'in_app',
    title: 'Order Placed',
    body: 'Your order has been placed.',
    data: null,
    status: 'pending',
    isRead: false,
    readAt: null,
    orderId: 'order-uuid-001',
    idempotencyKey: 'notif:order_placed:order-001:user-001:in_app',
    deliveryAttempts: 0,
    lastAttemptAt: null,
    nextRetryAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    sentAt: null,
    expiresAt: null,
    ...overrides,
  };
}

function makePreferenceRow(
  overrides: Partial<NotificationPreference> = {},
): NotificationPreference {
  return {
    id: 'pref-uuid-001',
    userId: 'user-uuid-001',
    pushEnabled: true,
    inAppEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    mutedTypes: [],
    email: 'user@example.com',
    timezone: 'Asia/Ho_Chi_Minh',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSendParams(
  overrides: Partial<SendFromEventParams> = {},
): SendFromEventParams {
  return {
    type: 'order_placed',
    recipientId: 'user-uuid-001',
    recipientRole: 'customer',
    sourceId: 'order-uuid-001',
    templateData: { orderId: 'order-uuid-001' },
    channels: ['in_app', 'push'] as NotificationChannel[],
    orderId: 'order-uuid-001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('NotificationService', () => {
  let service: NotificationService;
  let userEmailRepo: { findEmailByUserId: jest.Mock };
  let notificationRepo: {
    insertIfNotExists: jest.Mock;
    markRead: jest.Mock;
    markAllRead: jest.Mock;
    countUnread: jest.Mock;
    findInboxByUserId: jest.Mock;
    countInbox: jest.Mock;
    updateStatus: jest.Mock;
  };
  let preferenceRepo: { findByUserId: jest.Mock; upsert: jest.Mock };
  let deviceTokenRepo: {
    registerOrRefresh: jest.Mock;
    deactivate: jest.Mock;
    findByUserId: jest.Mock;
  };
  let templateService: { render: jest.Mock };
  let redisService: {
    del: jest.Mock;
    get: jest.Mock;
    setWithExpiry: jest.Mock;
  };
  let channelDispatcher: { dispatch: jest.Mock };
  let gateway: { sendToUser: jest.Mock };
  let quietHours: { isQuietHours: jest.Mock };

  beforeEach(async () => {
    userEmailRepo = {
      findEmailByUserId: jest.fn().mockResolvedValue(null),
    };
    notificationRepo = {
      insertIfNotExists: jest.fn().mockResolvedValue(makeNotificationRow()),
      markRead: jest.fn().mockResolvedValue(null),
      markAllRead: jest.fn().mockResolvedValue(0),
      countUnread: jest.fn().mockResolvedValue(0),
      findInboxByUserId: jest.fn().mockResolvedValue([]),
      countInbox: jest.fn().mockResolvedValue(0),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    preferenceRepo = {
      findByUserId: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    deviceTokenRepo = {
      registerOrRefresh: jest.fn().mockResolvedValue(undefined),
      deactivate: jest.fn().mockResolvedValue(undefined),
      findByUserId: jest.fn().mockResolvedValue([]),
    };
    templateService = {
      render: jest
        .fn()
        .mockReturnValue({ title: 'Rendered Title', body: 'Rendered body.' }),
    };
    redisService = {
      del: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      setWithExpiry: jest.fn().mockResolvedValue(undefined),
    };
    channelDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
    gateway = {
      sendToUser: jest.fn(),
    };
    // Default: quiet hours NOT active (push not suppressed)
    quietHours = {
      isQuietHours: jest.fn().mockReturnValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: NotificationRepository, useValue: notificationRepo },
        { provide: NotificationPreferenceRepository, useValue: preferenceRepo },
        { provide: UserEmailRepository, useValue: userEmailRepo },
        { provide: DeviceTokenRepository, useValue: deviceTokenRepo },
        { provide: NotificationTemplateService, useValue: templateService },
        { provide: RedisService, useValue: redisService },
        { provide: ChannelDispatcherService, useValue: channelDispatcher },
        { provide: QuietHoursService, useValue: quietHours },
        { provide: NotificationGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  // =========================================================================
  // §1  sendFromEvent
  // =========================================================================

  describe('sendFromEvent', () => {
    it('persists one row per enabled channel and returns the count', async () => {
      // Both channels enabled (default preferences)
      const rows = [
        makeNotificationRow({ channel: 'in_app' }),
        makeNotificationRow({ channel: 'push' }),
      ];
      notificationRepo.insertIfNotExists
        .mockResolvedValueOnce(rows[0])
        .mockResolvedValueOnce(rows[1]);

      const count = await service.sendFromEvent(
        makeSendParams({ channels: ['in_app', 'push'] }),
      );

      expect(count).toBe(2);
      expect(notificationRepo.insertIfNotExists).toHaveBeenCalledTimes(2);
    });

    it('fires channelDispatcher.dispatch for each newly persisted row', async () => {
      const row = makeNotificationRow({ channel: 'in_app' });
      notificationRepo.insertIfNotExists.mockResolvedValue(row);

      await service.sendFromEvent(makeSendParams({ channels: ['in_app'] }));

      expect(channelDispatcher.dispatch).toHaveBeenCalledWith(
        row,
        expect.objectContaining({ recipientId: 'user-uuid-001' }),
      );
    });

    it('does NOT fire dispatch for duplicate rows (insertIfNotExists returns null)', async () => {
      notificationRepo.insertIfNotExists.mockResolvedValue(null);

      const count = await service.sendFromEvent(
        makeSendParams({ channels: ['in_app', 'push'] }),
      );

      expect(count).toBe(0);
      expect(channelDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('uses correct idempotency key: notif:{type}:{sourceId}:{recipientId}:{channel}', async () => {
      await service.sendFromEvent(
        makeSendParams({
          type: 'payment_confirmed',
          sourceId: 'order-xyz',
          recipientId: 'user-abc',
          channels: ['email'],
        }),
      );

      const insertCall = notificationRepo.insertIfNotExists.mock.calls[0][0];
      expect(insertCall.idempotencyKey).toBe(
        'notif:payment_confirmed:order-xyz:user-abc:email',
      );
    });

    it('assigns 90-day expiresAt for in_app channel', async () => {
      const before = Date.now();
      await service.sendFromEvent(makeSendParams({ channels: ['in_app'] }));
      const after = Date.now();

      const insertCall = notificationRepo.insertIfNotExists.mock.calls[0][0];
      const expectedMs = 90 * 24 * 60 * 60 * 1000;
      const expiresAtMs = insertCall.expiresAt.getTime();

      expect(expiresAtMs).toBeGreaterThanOrEqual(before + expectedMs - 100);
      expect(expiresAtMs).toBeLessThanOrEqual(after + expectedMs + 100);
    });

    it('assigns null expiresAt for email and push channels', async () => {
      notificationRepo.insertIfNotExists
        .mockResolvedValueOnce(makeNotificationRow({ channel: 'email' }))
        .mockResolvedValueOnce(makeNotificationRow({ channel: 'push' }));

      await service.sendFromEvent(
        makeSendParams({ channels: ['email', 'push'] }),
      );

      const emailCall = notificationRepo.insertIfNotExists.mock.calls.find(
        (c) => c[0].channel === 'email',
      );
      const pushCall = notificationRepo.insertIfNotExists.mock.calls.find(
        (c) => c[0].channel === 'push',
      );
      expect(emailCall![0].expiresAt).toBeNull();
      expect(pushCall![0].expiresAt).toBeNull();
    });

    it('renders template once and uses title/body for all channels', async () => {
      templateService.render.mockReturnValue({ title: 'T', body: 'B' });
      notificationRepo.insertIfNotExists
        .mockResolvedValueOnce(
          makeNotificationRow({ channel: 'in_app', title: 'T', body: 'B' }),
        )
        .mockResolvedValueOnce(
          makeNotificationRow({ channel: 'push', title: 'T', body: 'B' }),
        );

      await service.sendFromEvent(
        makeSendParams({ channels: ['in_app', 'push'] }),
      );

      expect(templateService.render).toHaveBeenCalledTimes(1);
      // Both inserts use the same rendered title/body
      notificationRepo.insertIfNotExists.mock.calls.forEach((call) => {
        expect(call[0].title).toBe('T');
        expect(call[0].body).toBe('B');
      });
    });

    it('includes context.email from preference row in dispatch call', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ email: 'test@example.com' }),
      );
      const row = makeNotificationRow({ channel: 'email' });
      notificationRepo.insertIfNotExists.mockResolvedValue(row);

      await service.sendFromEvent(makeSendParams({ channels: ['email'] }));

      expect(channelDispatcher.dispatch).toHaveBeenCalledWith(
        row,
        expect.objectContaining({ email: 'test@example.com' }),
      );
    });

    it('passes null email in context when no preference row exists and user table also has no email', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(null);
      userEmailRepo.findEmailByUserId.mockResolvedValue(null);
      const row = makeNotificationRow({ channel: 'email' });
      notificationRepo.insertIfNotExists.mockResolvedValue(row);

      await service.sendFromEvent(makeSendParams({ channels: ['email'] }));

      expect(channelDispatcher.dispatch).toHaveBeenCalledWith(
        row,
        expect.objectContaining({ email: null }),
      );
    });

    it('resolves email from user table when preference row has no email', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ email: null }),
      );
      userEmailRepo.findEmailByUserId.mockResolvedValue('fallback@example.com');
      const row = makeNotificationRow({ channel: 'email' });
      notificationRepo.insertIfNotExists.mockResolvedValue(row);

      await service.sendFromEvent(makeSendParams({ channels: ['email'] }));

      expect(channelDispatcher.dispatch).toHaveBeenCalledWith(
        row,
        expect.objectContaining({ email: 'fallback@example.com' }),
      );
    });

    it('backfills email into notification_preferences after resolving from user table', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ email: null }),
      );
      userEmailRepo.findEmailByUserId.mockResolvedValue('backfill@example.com');
      preferenceRepo.upsert.mockResolvedValue(undefined);
      notificationRepo.insertIfNotExists.mockResolvedValue(
        makeNotificationRow({ channel: 'email' }),
      );

      await service.sendFromEvent(makeSendParams({ channels: ['email'] }));

      // Give the fire-and-forget upsert a tick to run
      await new Promise((r) => setImmediate(r));
      expect(preferenceRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid-001',
          email: 'backfill@example.com',
        }),
      );
    });

    it('does NOT call userEmailRepo when preference row already has an email', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ email: 'already@example.com' }),
      );
      notificationRepo.insertIfNotExists.mockResolvedValue(
        makeNotificationRow({ channel: 'email' }),
      );

      await service.sendFromEvent(makeSendParams({ channels: ['email'] }));

      expect(userEmailRepo.findEmailByUserId).not.toHaveBeenCalled();
    });

    it('returns 0 and never throws on unexpected exception', async () => {
      preferenceRepo.findByUserId.mockRejectedValue(new Error('DB crashed'));

      const result = await service.sendFromEvent(makeSendParams());

      expect(result).toBe(0);
    });
  });

  // =========================================================================
  // §2  isChannelEnabled — tested via sendFromEvent
  // =========================================================================

  describe('isChannelEnabled (via sendFromEvent)', () => {
    it('skips push channel when pushEnabled=false in preferences', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ pushEnabled: false }),
      );

      await service.sendFromEvent(
        makeSendParams({ channels: ['in_app', 'push'] }),
      );

      const insertedChannels =
        notificationRepo.insertIfNotExists.mock.calls.map((c) => c[0].channel);
      expect(insertedChannels).toContain('in_app');
      expect(insertedChannels).not.toContain('push');
    });

    it('skips email channel when emailEnabled=false in preferences', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ emailEnabled: false }),
      );

      await service.sendFromEvent(
        makeSendParams({ channels: ['in_app', 'email'] }),
      );

      const insertedChannels =
        notificationRepo.insertIfNotExists.mock.calls.map((c) => c[0].channel);
      expect(insertedChannels).toContain('in_app');
      expect(insertedChannels).not.toContain('email');
    });

    it('skips in_app channel when inAppEnabled=false', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ inAppEnabled: false }),
      );

      await service.sendFromEvent(
        makeSendParams({ channels: ['in_app', 'push'] }),
      );

      const insertedChannels =
        notificationRepo.insertIfNotExists.mock.calls.map((c) => c[0].channel);
      expect(insertedChannels).not.toContain('in_app');
    });

    it('returns 0 when all channels filtered by preferences', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ inAppEnabled: false, pushEnabled: false }),
      );

      const count = await service.sendFromEvent(
        makeSendParams({ channels: ['in_app', 'push'] }),
      );

      expect(count).toBe(0);
      expect(notificationRepo.insertIfNotExists).not.toHaveBeenCalled();
    });

    it('skips muted notification type channels', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ mutedTypes: ['order_placed'] }),
      );

      await service.sendFromEvent(
        makeSendParams({ type: 'order_placed', channels: ['in_app', 'push'] }),
      );

      expect(notificationRepo.insertIfNotExists).not.toHaveBeenCalled();
    });

    it('system_announcement bypasses mutedTypes (critical notifications)', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ mutedTypes: ['system_announcement'] }),
      );

      await service.sendFromEvent(
        makeSendParams({ type: 'system_announcement', channels: ['in_app'] }),
      );

      expect(notificationRepo.insertIfNotExists).toHaveBeenCalled();
    });

    it('new_order_received bypasses mutedTypes', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ mutedTypes: ['new_order_received'] }),
      );

      await service.sendFromEvent(
        makeSendParams({ type: 'new_order_received', channels: ['in_app'] }),
      );

      expect(notificationRepo.insertIfNotExists).toHaveBeenCalled();
    });

    it('falls back to DEFAULT_PREFERENCES when no preference row', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(null);

      await service.sendFromEvent(
        makeSendParams({ channels: ['in_app', 'push'] }),
      );

      // DEFAULT_PREFERENCES has inAppEnabled:true and pushEnabled:true
      expect(notificationRepo.insertIfNotExists).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // §2b  Quiet hours — push suppression (via sendFromEvent)
  // =========================================================================

  describe('quiet hours push suppression (via sendFromEvent)', () => {
    it('suppresses push channel when QuietHoursService.isQuietHours returns true', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ quietHoursStart: 22, quietHoursEnd: 7 }),
      );
      quietHours.isQuietHours.mockReturnValue(true);

      await service.sendFromEvent(
        makeSendParams({
          type: 'order_status_changed',
          channels: ['in_app', 'push'],
        }),
      );

      const insertedChannels =
        notificationRepo.insertIfNotExists.mock.calls.map((c) => c[0].channel);
      expect(insertedChannels).toContain('in_app');
      expect(insertedChannels).not.toContain('push');
    });

    it('in_app channel is NOT suppressed during quiet hours', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ quietHoursStart: 22, quietHoursEnd: 7 }),
      );
      quietHours.isQuietHours.mockReturnValue(true);

      await service.sendFromEvent(makeSendParams({ channels: ['in_app'] }));

      expect(notificationRepo.insertIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'in_app' }),
      );
    });

    it('email channel is NOT suppressed during quiet hours (only push is suppressed)', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ quietHoursStart: 22, quietHoursEnd: 7 }),
      );
      quietHours.isQuietHours.mockReturnValue(true);
      notificationRepo.insertIfNotExists
        .mockResolvedValueOnce(makeNotificationRow({ channel: 'in_app' }))
        .mockResolvedValueOnce(makeNotificationRow({ channel: 'email' }));

      await service.sendFromEvent(
        makeSendParams({ channels: ['in_app', 'email', 'push'] }),
      );

      const insertedChannels =
        notificationRepo.insertIfNotExists.mock.calls.map((c) => c[0].channel);
      expect(insertedChannels).toContain('in_app');
      expect(insertedChannels).toContain('email');
      expect(insertedChannels).not.toContain('push');
    });

    it('system_announcement bypasses quiet hours — push is delivered even during quiet window', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ quietHoursStart: 22, quietHoursEnd: 7 }),
      );
      quietHours.isQuietHours.mockReturnValue(true);
      notificationRepo.insertIfNotExists
        .mockResolvedValueOnce(makeNotificationRow({ channel: 'in_app' }))
        .mockResolvedValueOnce(makeNotificationRow({ channel: 'push' }));

      await service.sendFromEvent(
        makeSendParams({
          type: 'system_announcement',
          channels: ['in_app', 'push'],
        }),
      );

      const insertedChannels =
        notificationRepo.insertIfNotExists.mock.calls.map((c) => c[0].channel);
      // system_announcement bypasses ALL preference gates including quiet hours
      expect(insertedChannels).toContain('in_app');
      expect(insertedChannels).toContain('push');
      // QuietHoursService should NOT have been called for system_announcement
      expect(quietHours.isQuietHours).not.toHaveBeenCalled();
    });

    it('new_order_received bypasses quiet hours — push is delivered even during quiet window', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ quietHoursStart: 22, quietHoursEnd: 7 }),
      );
      quietHours.isQuietHours.mockReturnValue(true);
      notificationRepo.insertIfNotExists
        .mockResolvedValueOnce(makeNotificationRow({ channel: 'in_app' }))
        .mockResolvedValueOnce(makeNotificationRow({ channel: 'push' }));

      await service.sendFromEvent(
        makeSendParams({
          type: 'new_order_received',
          channels: ['in_app', 'push'],
        }),
      );

      const insertedChannels =
        notificationRepo.insertIfNotExists.mock.calls.map((c) => c[0].channel);
      expect(insertedChannels).toContain('in_app');
      expect(insertedChannels).toContain('push');
      expect(quietHours.isQuietHours).not.toHaveBeenCalled();
    });

    it('quiet hours check is skipped entirely when pushEnabled=false (push already filtered)', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({
          pushEnabled: false,
          quietHoursStart: 22,
          quietHoursEnd: 7,
        }),
      );
      quietHours.isQuietHours.mockReturnValue(true);

      await service.sendFromEvent(
        makeSendParams({ channels: ['in_app', 'push'] }),
      );

      // push was already filtered by pushEnabled=false, so quiet hours check is never reached
      expect(quietHours.isQuietHours).not.toHaveBeenCalled();
    });

    it('does NOT suppress push when QuietHoursService returns false', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ quietHoursStart: 22, quietHoursEnd: 7 }),
      );
      quietHours.isQuietHours.mockReturnValue(false); // NOT in quiet hours
      notificationRepo.insertIfNotExists
        .mockResolvedValueOnce(makeNotificationRow({ channel: 'in_app' }))
        .mockResolvedValueOnce(makeNotificationRow({ channel: 'push' }));

      await service.sendFromEvent(
        makeSendParams({ type: 'order_placed', channels: ['in_app', 'push'] }),
      );

      const insertedChannels =
        notificationRepo.insertIfNotExists.mock.calls.map((c) => c[0].channel);
      expect(insertedChannels).toContain('in_app');
      expect(insertedChannels).toContain('push');
    });
  });

  // =========================================================================
  // §3  getPreferences / updatePreferences
  // =========================================================================

  describe('getPreferences', () => {
    it('returns DEFAULT_PREFERENCES shape when no preference row exists', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(null);

      const prefs = await service.getPreferences('user-001');

      expect(prefs.pushEnabled).toBe(DEFAULT_PREFERENCES.pushEnabled);
      expect(prefs.inAppEnabled).toBe(DEFAULT_PREFERENCES.inAppEnabled);
      expect(prefs.emailEnabled).toBe(DEFAULT_PREFERENCES.emailEnabled);
      expect(prefs.smsEnabled).toBe(DEFAULT_PREFERENCES.smsEnabled);
      expect(prefs.mutedTypes).toEqual([]);
      expect(prefs.email).toBeNull();
      expect(prefs.timezone).toBe('Asia/Ho_Chi_Minh');
    });

    it('maps existing preference row to response DTO correctly', async () => {
      const row = makePreferenceRow({
        pushEnabled: false,
        email: 'stored@example.com',
        timezone: 'America/New_York',
        mutedTypes: ['order_preparing'],
      });
      preferenceRepo.findByUserId.mockResolvedValue(row);

      const prefs = await service.getPreferences('user-001');

      expect(prefs.pushEnabled).toBe(false);
      expect(prefs.email).toBe('stored@example.com');
      expect(prefs.timezone).toBe('America/New_York');
      expect(prefs.mutedTypes).toEqual(['order_preparing']);
    });
  });

  describe('updatePreferences', () => {
    it('upserts with merged values and returns the updated DTO', async () => {
      const existing = makePreferenceRow({
        pushEnabled: true,
        emailEnabled: true,
      });
      preferenceRepo.findByUserId.mockResolvedValue(existing);
      const updated = makePreferenceRow({
        pushEnabled: false,
        emailEnabled: true,
      });
      preferenceRepo.upsert.mockResolvedValue(updated);

      const result = await service.updatePreferences('user-001', {
        pushEnabled: false,
      });

      expect(preferenceRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          pushEnabled: false,
          emailEnabled: true, // unchanged
        }),
      );
      expect(result.pushEnabled).toBe(false);
    });

    it('uses DEFAULT_PREFERENCES as base when no row exists', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(null);
      const savedRow = makePreferenceRow({ timezone: 'Europe/London' });
      preferenceRepo.upsert.mockResolvedValue(savedRow);

      await service.updatePreferences('user-001', {
        timezone: 'Europe/London',
      });

      const upsertCall = preferenceRepo.upsert.mock.calls[0][0];
      // Should have default values for fields not provided
      expect(upsertCall.pushEnabled).toBe(DEFAULT_PREFERENCES.pushEnabled);
      expect(upsertCall.inAppEnabled).toBe(DEFAULT_PREFERENCES.inAppEnabled);
    });

    it('passes null email to upsert when dto.email is explicitly null', async () => {
      preferenceRepo.findByUserId.mockResolvedValue(
        makePreferenceRow({ email: 'old@example.com' }),
      );
      const savedRow = makePreferenceRow({ email: null });
      preferenceRepo.upsert.mockResolvedValue(savedRow);

      await service.updatePreferences('user-001', { email: null });

      const upsertCall = preferenceRepo.upsert.mock.calls[0][0];
      expect(upsertCall.email).toBeNull();
    });
  });

  // =========================================================================
  // §4  Push token management
  // =========================================================================

  describe('registerPushToken', () => {
    it('calls deviceTokenRepo.registerOrRefresh with correct data', async () => {
      await service.registerPushToken('user-001', {
        token: 'fcm-token-abc',
        platform: 'android',
      });

      expect(deviceTokenRepo.registerOrRefresh).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-001',
          token: 'fcm-token-abc',
          platform: 'android',
          isActive: true,
        }),
      );
    });

    it('returns { registered: true }', async () => {
      const result = await service.registerPushToken('user-001', {
        token: 'fcm-token-abc',
        platform: 'ios',
      });
      expect(result).toEqual({ registered: true });
    });
  });

  describe('removePushToken', () => {
    it('calls deviceTokenRepo.deactivate with userId and token', async () => {
      await service.removePushToken('user-001', 'fcm-token-xyz');

      expect(deviceTokenRepo.deactivate).toHaveBeenCalledWith(
        'user-001',
        'fcm-token-xyz',
      );
    });

    it('returns { removed: true }', async () => {
      const result = await service.removePushToken('user-001', 'some-token');
      expect(result).toEqual({ removed: true });
    });
  });

  // =========================================================================
  // §5  Inbox / unread methods (spot checks)
  // =========================================================================

  describe('markRead', () => {
    it('returns false when repo.markRead returns null (not found or wrong owner)', async () => {
      notificationRepo.markRead.mockResolvedValue(null);
      const result = await service.markRead('user-001', 'notif-uuid');
      expect(result).toBe(false);
    });

    it('returns true and emits WS event when repo marks successfully', async () => {
      const row = makeNotificationRow({
        readAt: new Date('2024-01-01T12:00:00Z'),
      });
      notificationRepo.markRead.mockResolvedValue(row);

      const result = await service.markRead('user-001', 'notif-uuid');

      expect(result).toBe(true);
      expect(gateway.sendToUser).toHaveBeenCalled();
    });

    it('invalidates Redis unread cache on success', async () => {
      notificationRepo.markRead.mockResolvedValue(makeNotificationRow());

      await service.markRead('user-001', 'notif-uuid');

      expect(redisService.del).toHaveBeenCalledWith('unread:user-001');
    });

    it('does NOT invalidate cache or emit WS when mark fails (row not found)', async () => {
      notificationRepo.markRead.mockResolvedValue(null);

      await service.markRead('user-001', 'notif-uuid');

      expect(redisService.del).not.toHaveBeenCalled();
      expect(gateway.sendToUser).not.toHaveBeenCalled();
    });
  });

  describe('markAllRead', () => {
    it('returns the count of updated rows', async () => {
      notificationRepo.markAllRead.mockResolvedValue(5);
      const result = await service.markAllRead('user-001');
      expect(result).toBe(5);
    });

    it('invalidates Redis cache when rows were updated', async () => {
      notificationRepo.markAllRead.mockResolvedValue(3);

      await service.markAllRead('user-001');

      expect(redisService.del).toHaveBeenCalledWith('unread:user-001');
    });

    it('emits WS event with all:true when rows were updated', async () => {
      notificationRepo.markAllRead.mockResolvedValue(2);

      await service.markAllRead('user-001');

      expect(gateway.sendToUser).toHaveBeenCalledWith(
        'user-001',
        expect.any(String),
        expect.objectContaining({ all: true }),
      );
    });

    it('does NOT invalidate cache or emit WS when count is 0 (already all read)', async () => {
      notificationRepo.markAllRead.mockResolvedValue(0);

      await service.markAllRead('user-001');

      expect(redisService.del).not.toHaveBeenCalled();
      expect(gateway.sendToUser).not.toHaveBeenCalled();
    });
  });

  describe('getUnreadCount', () => {
    it('returns cached count from Redis without hitting DB', async () => {
      redisService.get.mockResolvedValue('7');

      const count = await service.getUnreadCount('user-001');

      expect(count).toBe(7);
      expect(notificationRepo.countUnread).not.toHaveBeenCalled();
    });

    it('queries DB and caches result on Redis miss', async () => {
      redisService.get.mockResolvedValue(null);
      notificationRepo.countUnread.mockResolvedValue(3);

      const count = await service.getUnreadCount('user-001');

      expect(count).toBe(3);
      expect(notificationRepo.countUnread).toHaveBeenCalledWith('user-001');
      expect(redisService.setWithExpiry).toHaveBeenCalledWith(
        'unread:user-001',
        '3',
        expect.any(Number),
      );
    });

    it('falls back to DB query when Redis throws', async () => {
      redisService.get.mockRejectedValue(new Error('Redis down'));
      notificationRepo.countUnread.mockResolvedValue(5);

      const count = await service.getUnreadCount('user-001');

      expect(count).toBe(5);
    });
  });

  describe('getMyTokens', () => {
    it('returns masked tokenSuffix and never exposes the full token', async () => {
      (deviceTokenRepo as any).findByUserId.mockResolvedValue([
        {
          id: 'uuid-1',
          token: 'abcdefgh12345678',
          platform: 'web',
          isActive: true,
          lastSeenAt: new Date('2026-01-01T10:00:00Z'),
          createdAt: new Date('2026-01-01T09:00:00Z'),
        },
      ]);
      const result = await service.getMyTokens('user-001');
      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0].tokenSuffix).toBe('\u202612345678');
      expect(result.tokens[0]).not.toHaveProperty('token');
      expect(result.tokens[0].platform).toBe('web');
      expect(result.tokens[0].isActive).toBe(true);
    });

    it('returns empty array when no tokens are registered', async () => {
      (deviceTokenRepo as any).findByUserId.mockResolvedValue([]);
      const result = await service.getMyTokens('user-001');
      expect(result.tokens).toHaveLength(0);
    });

    it('returns multiple tokens sorted by caller order', async () => {
      (deviceTokenRepo as any).findByUserId.mockResolvedValue([
        {
          id: 'uuid-1',
          token: 'token-aaaaaa11',
          platform: 'web',
          isActive: true,
          lastSeenAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 'uuid-2',
          token: 'token-bbbbbb22',
          platform: 'android',
          isActive: false,
          lastSeenAt: new Date(),
          createdAt: new Date(),
        },
      ]);
      const result = await service.getMyTokens('user-001');
      expect(result.tokens).toHaveLength(2);
      expect(result.tokens[0].tokenSuffix).toBe('\u2026aaaaaa11');
      expect(result.tokens[1].tokenSuffix).toBe('\u2026bbbbbb22');
      expect(result.tokens[1].isActive).toBe(false);
    });
  });
});
