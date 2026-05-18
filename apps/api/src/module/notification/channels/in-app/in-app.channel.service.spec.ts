/**
 * in-app.channel.service.spec.ts
 *
 * Unit tests for InAppChannelService.
 *
 * Verifies:
 *  - Redis unread cache invalidation (DEL `unread:{userId}`)
 *  - WebSocket emission via NotificationGateway with correct payload
 *  - Always returns { success: true } regardless of gateway / Redis errors
 *  - Graceful handling when gateway is not injected (@Optional)
 *
 * Phase: N-4 — Multi-Channel Delivery
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
// Mock the gateway module before any imports to avoid loading better-auth (ESM-only package)
// which is incompatible with the CommonJS unit test configuration.
jest.mock('../../gateway/notification.gateway', () => ({
  NotificationGateway: class MockNotificationGateway {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { InAppChannelService } from './in-app.channel.service';
import { NotificationGateway } from '../../gateway/notification.gateway';
import { RedisService } from '@/lib/redis/redis.service';
import { WS_NOTIFICATION_CREATED } from '../../gateway/notification-payload.dto';
import type { Notification } from '../../domain/notification.schema';
import type { DeliveryContext } from '../channel.interface';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-uuid-inapp-001',
    recipientId: 'user-uuid-001',
    recipientRole: 'customer',
    type: 'order_placed',
    channel: 'in_app',
    title: 'Order Placed',
    body: 'Your order has been placed.',
    data: { orderId: 'order-001' },
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

const CONTEXT: DeliveryContext = { recipientId: 'user-uuid-001', email: null };

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('InAppChannelService', () => {
  let service: InAppChannelService;
  let redisService: {
    del: jest.Mock;
    setWithExpiry: jest.Mock;
    get: jest.Mock;
  };
  let gateway: { sendToUser: jest.Mock };

  beforeEach(async () => {
    redisService = {
      del: jest.fn().mockResolvedValue(undefined),
      setWithExpiry: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
    };
    gateway = { sendToUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InAppChannelService,
        { provide: RedisService, useValue: redisService },
        { provide: NotificationGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<InAppChannelService>(InAppChannelService);
  });

  // ─── Redis cache invalidation ──────────────────────────────────────────────

  it('deletes the unread cache key for the notification recipient', async () => {
    const notif = makeNotification({ recipientId: 'user-abc-123' });
    await service.deliver(notif, CONTEXT);

    expect(redisService.del).toHaveBeenCalledWith('unread:user-abc-123');
  });

  it('does NOT call setWithExpiry — only invalidates, never sets', async () => {
    await service.deliver(makeNotification(), CONTEXT);
    expect(redisService.setWithExpiry).not.toHaveBeenCalled();
  });

  // ─── WebSocket emission ────────────────────────────────────────────────────

  it('emits WS_NOTIFICATION_CREATED to the recipient via the gateway', async () => {
    const notif = makeNotification();
    await service.deliver(notif, CONTEXT);

    expect(gateway.sendToUser).toHaveBeenCalledWith(
      notif.recipientId,
      WS_NOTIFICATION_CREATED,
      expect.objectContaining({
        id: notif.id,
        type: notif.type,
        title: notif.title,
        body: notif.body,
        isRead: notif.isRead,
      }),
    );
  });

  it('includes createdAt as ISO string in the WS payload', async () => {
    const createdAt = new Date('2024-06-15T10:30:00Z');
    const notif = makeNotification({ createdAt });
    await service.deliver(notif, CONTEXT);

    const payload = gateway.sendToUser.mock.calls[0][2];
    expect(payload.createdAt).toBe(createdAt.toISOString());
  });

  it('includes data in WS payload when notification has data', async () => {
    const notif = makeNotification({
      data: { orderId: 'order-xyz', screen: 'OrderDetail' },
    });
    await service.deliver(notif, CONTEXT);

    const payload = gateway.sendToUser.mock.calls[0][2];
    expect(payload.data).toEqual({
      orderId: 'order-xyz',
      screen: 'OrderDetail',
    });
  });

  it('includes orderId in WS payload when notification has orderId', async () => {
    const notif = makeNotification({ orderId: 'order-uuid-999' });
    await service.deliver(notif, CONTEXT);

    const payload = gateway.sendToUser.mock.calls[0][2];
    expect(payload.orderId).toBe('order-uuid-999');
  });

  it('omits data and orderId in WS payload when they are null', async () => {
    const notif = makeNotification({ data: null, orderId: null });
    await service.deliver(notif, CONTEXT);

    const payload = gateway.sendToUser.mock.calls[0][2];
    expect(payload.data).toBeUndefined();
    expect(payload.orderId).toBeUndefined();
  });

  // ─── Always returns success ────────────────────────────────────────────────

  it('returns { success: true } after normal delivery', async () => {
    const result = await service.deliver(makeNotification(), CONTEXT);
    expect(result).toEqual({ success: true });
  });

  // ─── Graceful error handling ───────────────────────────────────────────────

  it('returns { success: true } even when Redis DEL throws', async () => {
    redisService.del.mockRejectedValue(new Error('Redis connection refused'));
    const result = await service.deliver(makeNotification(), CONTEXT);
    expect(result).toEqual({ success: true });
  });

  it('still attempts WS emit even when Redis DEL throws', async () => {
    redisService.del.mockRejectedValue(new Error('Redis down'));
    await service.deliver(makeNotification(), CONTEXT);
    // WS emit should still be attempted
    expect(gateway.sendToUser).toHaveBeenCalled();
  });

  it('returns { success: true } even when gateway.sendToUser throws', async () => {
    gateway.sendToUser.mockImplementation(() => {
      throw new Error('WS emit failed');
    });
    const result = await service.deliver(makeNotification(), CONTEXT);
    expect(result).toEqual({ success: true });
  });

  // ─── Optional gateway ─────────────────────────────────────────────────────

  it('returns { success: true } when gateway is not injected (@Optional)', async () => {
    // Rebuild module without the gateway provider
    const moduleWithoutGateway: TestingModule = await Test.createTestingModule({
      providers: [
        InAppChannelService,
        { provide: RedisService, useValue: redisService },
        // NotificationGateway intentionally omitted (@Optional)
      ],
    }).compile();

    const serviceWithoutGateway =
      moduleWithoutGateway.get<InAppChannelService>(InAppChannelService);
    const result = await serviceWithoutGateway.deliver(
      makeNotification(),
      CONTEXT,
    );
    expect(result).toEqual({ success: true });
  });

  it('skips WS emit silently when gateway is not injected', async () => {
    const moduleWithoutGateway: TestingModule = await Test.createTestingModule({
      providers: [
        InAppChannelService,
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    const serviceWithoutGateway =
      moduleWithoutGateway.get<InAppChannelService>(InAppChannelService);
    // Should not throw, WS is best-effort
    await expect(
      serviceWithoutGateway.deliver(makeNotification(), CONTEXT),
    ).resolves.toEqual({ success: true });
  });
});
