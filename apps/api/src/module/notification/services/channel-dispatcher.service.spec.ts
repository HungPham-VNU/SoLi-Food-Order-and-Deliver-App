/**
 * channel-dispatcher.service.spec.ts
 *
 * Unit tests for ChannelDispatcherService.
 *
 * Verifies:
 *  - Correct channel adapter routing (in_app → InAppChannelService, etc.)
 *  - Exception isolation (adapter exceptions → DeliveryResult, no rethrow)
 *  - Delivery log writes (success and failure paths)
 *  - Notification status updates (sent | failed, with/without sentAt)
 *  - Resilience: log-write failure and status-update failure are non-fatal
 *  - Unknown channel: graceful skip (no error, no log, no status update)
 *
 * Phase: N-4 — Multi-Channel Delivery
 */

// Mock the gateway module before any imports to avoid loading better-auth (ESM-only package)
// which is incompatible with the CommonJS unit test configuration.
jest.mock('../gateway/notification.gateway', () => ({
  NotificationGateway: class MockNotificationGateway {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ChannelDispatcherService } from './channel-dispatcher.service';
import { InAppChannelService } from '../channels/in-app/in-app.channel.service';
import { EmailChannelService } from '../channels/email/email.channel.service';
import { PushChannelService } from '../channels/push/push.channel.service';
import { UserPresenceService } from './user-presence.service';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationDeliveryLogRepository } from '../repositories/notification-delivery-log.repository';
import type { Notification } from '../domain/notification.schema';
import type { DeliveryContext } from '../channels/channel.interface';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-uuid-001',
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

function makeContext(overrides: Partial<DeliveryContext> = {}): DeliveryContext {
  return {
    recipientId: 'user-uuid-001',
    email: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ChannelDispatcherService', () => {
  let service: ChannelDispatcherService;
  let inAppChannel: { deliver: jest.Mock };
  let emailChannel: { deliver: jest.Mock };
  let pushChannel: { deliver: jest.Mock };
  let notificationRepo: { updateStatus: jest.Mock };
  let deliveryLogRepo: { log: jest.Mock };
  let presenceService: { isOnline: jest.Mock };

  beforeEach(async () => {
    inAppChannel = { deliver: jest.fn().mockResolvedValue({ success: true }) };
    emailChannel = { deliver: jest.fn().mockResolvedValue({ success: true }) };
    pushChannel = { deliver: jest.fn().mockResolvedValue({ success: true }) };
    notificationRepo = { updateStatus: jest.fn().mockResolvedValue(undefined) };
    deliveryLogRepo = { log: jest.fn().mockResolvedValue(undefined) };
    // Default: user is OFFLINE — push delivers normally.
    // Override to { isOnline: true } in suppression tests.
    presenceService = { isOnline: jest.fn().mockResolvedValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelDispatcherService,
        { provide: InAppChannelService, useValue: inAppChannel },
        { provide: EmailChannelService, useValue: emailChannel },
        { provide: PushChannelService, useValue: pushChannel },
        { provide: NotificationRepository, useValue: notificationRepo },
        { provide: NotificationDeliveryLogRepository, useValue: deliveryLogRepo },
        { provide: UserPresenceService, useValue: presenceService },
      ],
    }).compile();

    service = module.get<ChannelDispatcherService>(ChannelDispatcherService);
  });

  // ─── Channel routing ───────────────────────────────────────────────────────

  it('routes in_app notification to InAppChannelService', async () => {
    const notif = makeNotification({ channel: 'in_app' });
    await service.dispatch(notif, makeContext());
    expect(inAppChannel.deliver).toHaveBeenCalledWith(notif, expect.objectContaining({ recipientId: notif.recipientId }));
    expect(emailChannel.deliver).not.toHaveBeenCalled();
    expect(pushChannel.deliver).not.toHaveBeenCalled();
  });

  it('routes email notification to EmailChannelService', async () => {
    const notif = makeNotification({ channel: 'email' });
    await service.dispatch(notif, makeContext());
    expect(emailChannel.deliver).toHaveBeenCalledWith(notif, expect.any(Object));
    expect(inAppChannel.deliver).not.toHaveBeenCalled();
    expect(pushChannel.deliver).not.toHaveBeenCalled();
  });

  it('routes push notification to PushChannelService', async () => {
    const notif = makeNotification({ channel: 'push' });
    await service.dispatch(notif, makeContext());
    expect(pushChannel.deliver).toHaveBeenCalledWith(notif, expect.any(Object));
    expect(inAppChannel.deliver).not.toHaveBeenCalled();
    expect(emailChannel.deliver).not.toHaveBeenCalled();
  });

  // ─── Unknown channel ───────────────────────────────────────────────────────

  it('silently skips and does not throw for an unregistered channel', async () => {
    const notif = makeNotification({ channel: 'sms' });
    await expect(service.dispatch(notif, makeContext())).resolves.toBeUndefined();
    expect(deliveryLogRepo.log).not.toHaveBeenCalled();
    expect(notificationRepo.updateStatus).not.toHaveBeenCalled();
  });

  // ─── Adapter exception isolation ──────────────────────────────────────────

  it('catches adapter exception and records failure result without rethrowing', async () => {
    inAppChannel.deliver.mockRejectedValue(new Error('Unexpected adapter crash'));
    const notif = makeNotification({ channel: 'in_app' });

    await expect(service.dispatch(notif, makeContext())).resolves.toBeUndefined();

    expect(deliveryLogRepo.log).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', errorCode: 'ADAPTER_EXCEPTION' }),
    );
    expect(notificationRepo.updateStatus).toHaveBeenCalledWith(
      notif.id,
      'failed',
      expect.objectContaining({ deliveryAttempts: 1 }),
    );
  });

  it('records errorMessage from adapter exception in delivery log', async () => {
    const errorMessage = 'Redis connection refused';
    inAppChannel.deliver.mockRejectedValue(new Error(errorMessage));
    const notif = makeNotification({ channel: 'in_app' });

    await service.dispatch(notif, makeContext());

    expect(deliveryLogRepo.log).toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage }),
    );
  });

  // ─── Delivery log writes ───────────────────────────────────────────────────

  it('writes a success log entry after successful delivery', async () => {
    inAppChannel.deliver.mockResolvedValue({ success: true });
    const notif = makeNotification({ channel: 'in_app' });

    await service.dispatch(notif, makeContext());

    expect(deliveryLogRepo.log).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: notif.id,
        channel: 'in_app',
        status: 'success',
        attemptNumber: 1,
        errorCode: null,
        errorMessage: null,
      }),
    );
  });

  it('writes a failed log entry when adapter returns success=false', async () => {
    emailChannel.deliver.mockResolvedValue({
      success: false,
      errorCode: 'SMTP_NOT_CONFIGURED',
      errorMessage: 'SMTP not configured',
    });
    const notif = makeNotification({ channel: 'email' });

    await service.dispatch(notif, makeContext());

    expect(deliveryLogRepo.log).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorCode: 'SMTP_NOT_CONFIGURED',
        errorMessage: 'SMTP not configured',
      }),
    );
  });

  it('increments attemptNumber from notification.deliveryAttempts', async () => {
    // Notification has already been attempted once (retry scenario)
    const notif = makeNotification({ channel: 'in_app', deliveryAttempts: 2 });

    await service.dispatch(notif, makeContext());

    expect(deliveryLogRepo.log).toHaveBeenCalledWith(
      expect.objectContaining({ attemptNumber: 3 }),
    );
    expect(notificationRepo.updateStatus).toHaveBeenCalledWith(
      notif.id,
      'sent',
      expect.objectContaining({ deliveryAttempts: 3 }),
    );
  });

  // ─── Status updates ────────────────────────────────────────────────────────

  it('updates notification status to "sent" with sentAt on success', async () => {
    inAppChannel.deliver.mockResolvedValue({ success: true });
    const notif = makeNotification({ channel: 'in_app' });

    await service.dispatch(notif, makeContext());

    expect(notificationRepo.updateStatus).toHaveBeenCalledWith(
      notif.id,
      'sent',
      expect.objectContaining({
        deliveryAttempts: 1,
        lastAttemptAt: expect.any(Date),
        sentAt: expect.any(Date),
      }),
    );
  });

  it('updates notification status to "failed" without sentAt on failure', async () => {
    pushChannel.deliver.mockResolvedValue({
      success: false,
      errorCode: 'NO_ACTIVE_TOKENS',
    });
    const notif = makeNotification({ channel: 'push' });

    await service.dispatch(notif, makeContext());

    const call = notificationRepo.updateStatus.mock.calls[0];
    // Third argument: extra fields
    expect(call[1]).toBe('failed');
    // sentAt should be undefined (not set on failure)
    expect(call[2]).not.toHaveProperty('sentAt', expect.any(Date));
  });

  // ─── Resilience ────────────────────────────────────────────────────────────

  it('proceeds with status update even if delivery log write fails', async () => {
    deliveryLogRepo.log.mockRejectedValue(new Error('DB write failed'));
    const notif = makeNotification({ channel: 'in_app' });

    await service.dispatch(notif, makeContext());

    // Status update should still happen
    expect(notificationRepo.updateStatus).toHaveBeenCalled();
  });

  it('does not throw even if both log write and status update fail', async () => {
    deliveryLogRepo.log.mockRejectedValue(new Error('DB write failed'));
    notificationRepo.updateStatus.mockRejectedValue(new Error('Status update failed'));
    const notif = makeNotification({ channel: 'in_app' });

    await expect(service.dispatch(notif, makeContext())).resolves.toBeUndefined();
  });

  it('does not throw even if status update alone fails', async () => {
    notificationRepo.updateStatus.mockRejectedValue(new Error('DB error'));
    const notif = makeNotification({ channel: 'in_app' });

    await expect(service.dispatch(notif, makeContext())).resolves.toBeUndefined();
  });

  // ─── Push suppression (Rule 1: online user → suppress push) ────────────────────────────

  describe('push suppression', () => {
    it('checks presence before delivering push notification', async () => {
      const notif = makeNotification({ channel: 'push' });
      await service.dispatch(notif, makeContext());
      expect(presenceService.isOnline).toHaveBeenCalledWith(notif.recipientId);
    });

    it('does NOT invoke pushChannel.deliver when user is online', async () => {
      presenceService.isOnline.mockResolvedValue(true);
      const notif = makeNotification({ channel: 'push' });
      await service.dispatch(notif, makeContext());
      expect(pushChannel.deliver).not.toHaveBeenCalled();
    });

    it('marks push notification as sent when suppressed (delivered via WS)', async () => {
      presenceService.isOnline.mockResolvedValue(true);
      const notif = makeNotification({ channel: 'push' });
      await service.dispatch(notif, makeContext());
      expect(notificationRepo.updateStatus).toHaveBeenCalledWith(
        notif.id,
        'sent',
        expect.objectContaining({
          deliveryAttempts: 1,
          lastAttemptAt: expect.any(Date),
          sentAt: expect.any(Date),
        }),
      );
    });

    it('writes a delivery log with PUSH_SUPPRESSED_USER_ONLINE code when suppressed', async () => {
      presenceService.isOnline.mockResolvedValue(true);
      const notif = makeNotification({ channel: 'push' });
      await service.dispatch(notif, makeContext());
      expect(deliveryLogRepo.log).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationId: notif.id,
          channel: 'push',
          status: 'success',
          errorCode: 'PUSH_SUPPRESSED_USER_ONLINE',
        }),
      );
    });

    it('delivers push normally when user is offline (default)', async () => {
      presenceService.isOnline.mockResolvedValue(false);
      const notif = makeNotification({ channel: 'push' });
      await service.dispatch(notif, makeContext());
      expect(pushChannel.deliver).toHaveBeenCalledWith(notif, expect.any(Object));
    });

    it('does NOT check presence for in_app channel', async () => {
      const notif = makeNotification({ channel: 'in_app' });
      await service.dispatch(notif, makeContext());
      expect(presenceService.isOnline).not.toHaveBeenCalled();
    });

    it('does NOT check presence for email channel', async () => {
      const notif = makeNotification({ channel: 'email' });
      await service.dispatch(notif, makeContext());
      expect(presenceService.isOnline).not.toHaveBeenCalled();
    });

    it('delivers push as fallback when presence check throws unexpectedly', async () => {
      // isOnline should never throw (it absorbs errors), but if it somehow does,
      // the dispatcher's internal catch should still deliver push.
      presenceService.isOnline.mockRejectedValue(new Error('Unexpected presence error'));
      const notif = makeNotification({ channel: 'push' });
      await service.dispatch(notif, makeContext());
      // Should fall through to normal push delivery
      expect(pushChannel.deliver).toHaveBeenCalled();
    });

    it('does not throw when suppression log write fails', async () => {
      presenceService.isOnline.mockResolvedValue(true);
      deliveryLogRepo.log.mockRejectedValue(new Error('DB error'));
      const notif = makeNotification({ channel: 'push' });
      await expect(service.dispatch(notif, makeContext())).resolves.toBeUndefined();
    });

    it('does not throw when suppression status update fails', async () => {
      presenceService.isOnline.mockResolvedValue(true);
      notificationRepo.updateStatus.mockRejectedValue(new Error('DB error'));
      const notif = makeNotification({ channel: 'push' });
      await expect(service.dispatch(notif, makeContext())).resolves.toBeUndefined();
    });
  });
});
