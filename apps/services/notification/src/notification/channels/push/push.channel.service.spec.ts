/**
 * push.channel.service.spec.ts
 *
 * Unit tests for PushChannelService.
 *
 * Verifies:
 *  - Returns NO_ACTIVE_TOKENS when device token lookup returns empty array
 *  - Fans out to all active tokens via IPushProvider.send()
 *  - Deactivates invalid tokens returned by provider
 *  - Returns { success: true } when at least one token delivered
 *  - Returns { success: false, errorCode: 'FCM_SEND_ERROR' } when all tokens fail
 *  - Returns failure when token lookup throws
 *  - Returns failure when provider throws
 *  - Never throws (all errors expressed as DeliveryResult)
 *
 * Phase: N-4 — Multi-Channel Delivery
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Test, TestingModule } from '@nestjs/testing';
import { PushChannelService } from './push.channel.service';
import { DeviceTokenRepository } from '../../repositories/device-token.repository';
import { PUSH_PROVIDER } from './push-provider.interface';
import type { IPushProvider } from './push-provider.interface';
import type { DeviceToken } from '../../domain/device-token.schema';
import type { Notification } from '../../domain/notification.schema';
import type { DeliveryContext } from '../channel.interface';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-uuid-push-001',
    recipientId: 'user-uuid-001',
    recipientRole: 'customer',
    type: 'order_placed',
    channel: 'push',
    title: 'Order Placed',
    body: 'Your order has been received.',
    data: { orderId: 'order-001' },
    status: 'pending',
    isRead: false,
    readAt: null,
    orderId: 'order-uuid-001',
    idempotencyKey: 'notif:order_placed:order-001:user-001:push',
    deliveryAttempts: 0,
    lastAttemptAt: null,
    nextRetryAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    sentAt: null,
    expiresAt: null,
    ...overrides,
  };
}

function makeToken(
  token: string,
  overrides: Partial<DeviceToken> = {},
): DeviceToken {
  return {
    id: `token-uuid-${token}`,
    userId: 'user-uuid-001',
    token,
    platform: 'android',
    isActive: true,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

const CONTEXT: DeliveryContext = { recipientId: 'user-uuid-001', email: null };

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PushChannelService', () => {
  let service: PushChannelService;
  let deviceTokenRepo: { findActiveByUserId: jest.Mock; deactivate: jest.Mock };
  let pushProvider: jest.Mocked<IPushProvider>;

  beforeEach(async () => {
    deviceTokenRepo = {
      findActiveByUserId: jest.fn().mockResolvedValue([]),
      deactivate: jest.fn().mockResolvedValue(undefined),
    };
    pushProvider = {
      send: jest.fn().mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        invalidTokens: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushChannelService,
        { provide: DeviceTokenRepository, useValue: deviceTokenRepo },
        { provide: PUSH_PROVIDER, useValue: pushProvider },
      ],
    }).compile();

    service = module.get<PushChannelService>(PushChannelService);
  });

  // ─── No tokens ─────────────────────────────────────────────────────────────

  it('returns NO_ACTIVE_TOKENS when user has no active device tokens', async () => {
    deviceTokenRepo.findActiveByUserId.mockResolvedValue([]);

    const result = await service.deliver(makeNotification(), CONTEXT);

    expect(result).toEqual({
      success: false,
      errorCode: 'NO_ACTIVE_TOKENS',
      errorMessage: expect.any(String),
    });
  });

  it('does NOT call provider when no active tokens', async () => {
    deviceTokenRepo.findActiveByUserId.mockResolvedValue([]);
    await service.deliver(makeNotification(), CONTEXT);

    expect(pushProvider.send).not.toHaveBeenCalled();
  });

  // ─── Fan-out to all active tokens ──────────────────────────────────────────

  it('passes all active token strings to provider.send', async () => {
    const tokens = [
      makeToken('token-abc'),
      makeToken('token-def'),
      makeToken('token-ghi'),
    ];
    deviceTokenRepo.findActiveByUserId.mockResolvedValue(tokens);

    await service.deliver(makeNotification(), CONTEXT);

    expect(pushProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['token-abc', 'token-def', 'token-ghi'],
      }),
    );
  });

  it('passes notification title, body, and data to provider.send', async () => {
    const notif = makeNotification({
      title: 'Push Title',
      body: 'Push body text',
      data: { screen: 'OrderDetail', orderId: 'abc' },
    });
    deviceTokenRepo.findActiveByUserId.mockResolvedValue([
      makeToken('token-x'),
    ]);

    await service.deliver(notif, CONTEXT);

    expect(pushProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Push Title',
        body: 'Push body text',
        data: { screen: 'OrderDetail', orderId: 'abc' },
      }),
    );
  });

  it('passes null data as undefined to provider (not as null)', async () => {
    const notif = makeNotification({ data: null });
    deviceTokenRepo.findActiveByUserId.mockResolvedValue([
      makeToken('token-x'),
    ]);

    await service.deliver(notif, CONTEXT);

    const callArg = pushProvider.send.mock.calls[0][0];
    // data should be undefined (not null) in provider call
    expect(callArg.data).toBeUndefined();
  });

  // ─── Success path ──────────────────────────────────────────────────────────

  it('returns { success: true } when at least one token delivered', async () => {
    deviceTokenRepo.findActiveByUserId.mockResolvedValue([
      makeToken('token-1'),
      makeToken('token-2'),
    ]);
    pushProvider.send.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      invalidTokens: [],
    });

    const result = await service.deliver(makeNotification(), CONTEXT);

    expect(result).toEqual({ success: true });
  });

  it('returns { success: true } when all tokens delivered (full success)', async () => {
    deviceTokenRepo.findActiveByUserId.mockResolvedValue([
      makeToken('token-1'),
      makeToken('token-2'),
    ]);
    pushProvider.send.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      invalidTokens: [],
    });

    const result = await service.deliver(makeNotification(), CONTEXT);

    expect(result.success).toBe(true);
  });

  // ─── Failure path ──────────────────────────────────────────────────────────

  it('returns FCM_SEND_ERROR when successCount is 0', async () => {
    deviceTokenRepo.findActiveByUserId.mockResolvedValue([
      makeToken('token-1'),
    ]);
    pushProvider.send.mockResolvedValue({
      successCount: 0,
      failureCount: 1,
      invalidTokens: [],
    });

    const result = await service.deliver(makeNotification(), CONTEXT);

    expect(result).toEqual({
      success: false,
      errorCode: 'FCM_SEND_ERROR',
      errorMessage: expect.stringContaining('failed'),
    });
  });

  // ─── Invalid token deactivation ────────────────────────────────────────────

  it('deactivates each invalid token returned by the provider', async () => {
    const tokens = [
      makeToken('valid-token'),
      makeToken('stale-token'),
      makeToken('another-stale'),
    ];
    deviceTokenRepo.findActiveByUserId.mockResolvedValue(tokens);
    pushProvider.send.mockResolvedValue({
      successCount: 1,
      failureCount: 2,
      invalidTokens: ['stale-token', 'another-stale'],
    });

    await service.deliver(makeNotification(), CONTEXT);

    expect(deviceTokenRepo.deactivate).toHaveBeenCalledWith(
      'user-uuid-001',
      'stale-token',
    );
    expect(deviceTokenRepo.deactivate).toHaveBeenCalledWith(
      'user-uuid-001',
      'another-stale',
    );
    expect(deviceTokenRepo.deactivate).toHaveBeenCalledTimes(2);
  });

  it('does NOT deactivate any token when invalidTokens is empty', async () => {
    deviceTokenRepo.findActiveByUserId.mockResolvedValue([
      makeToken('good-token'),
    ]);
    pushProvider.send.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      invalidTokens: [],
    });

    await service.deliver(makeNotification(), CONTEXT);

    expect(deviceTokenRepo.deactivate).not.toHaveBeenCalled();
  });

  it('continues processing and returns success even if one token deactivation fails', async () => {
    deviceTokenRepo.findActiveByUserId.mockResolvedValue([
      makeToken('good-token'),
      makeToken('invalid-token'),
    ]);
    deviceTokenRepo.deactivate.mockRejectedValue(new Error('DB error'));
    pushProvider.send.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      invalidTokens: ['invalid-token'],
    });

    // Should resolve and return success (deactivation failure is non-fatal)
    const result = await service.deliver(makeNotification(), CONTEXT);
    expect(result.success).toBe(true);
  });

  // ─── Token lookup failure ──────────────────────────────────────────────────

  it('returns FCM_SEND_ERROR when device token lookup throws', async () => {
    deviceTokenRepo.findActiveByUserId.mockRejectedValue(
      new Error('DB connection lost'),
    );

    const result = await service.deliver(makeNotification(), CONTEXT);

    expect(result).toEqual({
      success: false,
      errorCode: 'FCM_SEND_ERROR',
      errorMessage: expect.stringContaining('DB connection lost'),
    });
    expect(pushProvider.send).not.toHaveBeenCalled();
  });

  // ─── Provider exception ────────────────────────────────────────────────────

  it('returns FCM_SEND_ERROR when provider.send throws', async () => {
    deviceTokenRepo.findActiveByUserId.mockResolvedValue([
      makeToken('token-a'),
    ]);
    pushProvider.send.mockRejectedValue(new Error('FCM API unreachable'));

    const result = await service.deliver(makeNotification(), CONTEXT);

    expect(result).toEqual({
      success: false,
      errorCode: 'FCM_SEND_ERROR',
      errorMessage: 'FCM API unreachable',
    });
  });

  it('never throws even on catastrophic failure', async () => {
    deviceTokenRepo.findActiveByUserId.mockRejectedValue(
      new Error('Catastrophic'),
    );
    await expect(
      service.deliver(makeNotification(), CONTEXT),
    ).resolves.toBeDefined();
  });
});
