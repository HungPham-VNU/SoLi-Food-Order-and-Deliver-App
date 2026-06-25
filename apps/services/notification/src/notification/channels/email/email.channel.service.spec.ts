/**
 * email.channel.service.spec.ts
 *
 * Unit tests for EmailChannelService.
 *
 * Verifies:
 *  - Guard: returns NO_RECIPIENT_EMAIL when context.email is null
 *  - Template rendering: calls EmailTemplateService.render with title and body
 *  - sendMail: correct params passed to IEmailProvider
 *  - Success path: returns { success: true }
 *  - Failure paths: SMTP_NOT_CONFIGURED vs SMTP_SEND_ERROR error codes
 *  - Never throws (all errors converted to DeliveryResult)
 *
 * Phase: N-4 — Multi-Channel Delivery
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { EmailChannelService } from './email.channel.service';
import { EmailTemplateService } from './email-template.service';
import { EMAIL_PROVIDER } from './email-provider.interface';
import type { IEmailProvider } from './email-provider.interface';
import type { Notification } from '../../domain/notification.schema';
import type { DeliveryContext } from '../channel.interface';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-uuid-email-001',
    recipientId: 'user-uuid-001',
    recipientRole: 'customer',
    type: 'payment_confirmed',
    channel: 'email',
    title: 'Thanh toán thành công',
    body: 'Đơn hàng #order-001 đã được thanh toán thành công.',
    data: null,
    status: 'pending',
    isRead: false,
    readAt: null,
    orderId: 'order-uuid-001',
    idempotencyKey: 'notif:payment_confirmed:order-001:user-001:email',
    deliveryAttempts: 0,
    lastAttemptAt: null,
    nextRetryAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    sentAt: null,
    expiresAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('EmailChannelService', () => {
  let service: EmailChannelService;
  let emailTemplateService: { render: jest.Mock };
  let emailProvider: jest.Mocked<IEmailProvider>;

  const RENDERED_HTML = '<html><body>Test HTML</body></html>';
  const RENDERED_TEXT = 'Test plain text';

  beforeEach(async () => {
    emailTemplateService = {
      render: jest
        .fn()
        .mockReturnValue({ html: RENDERED_HTML, text: RENDERED_TEXT }),
    };
    emailProvider = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailChannelService,
        { provide: EmailTemplateService, useValue: emailTemplateService },
        { provide: EMAIL_PROVIDER, useValue: emailProvider },
      ],
    }).compile();

    service = module.get<EmailChannelService>(EmailChannelService);
  });

  // ─── Guard: missing email ──────────────────────────────────────────────────

  it('returns NO_RECIPIENT_EMAIL when context.email is null', async () => {
    const context: DeliveryContext = { recipientId: 'user-001', email: null };
    const result = await service.deliver(makeNotification(), context);

    expect(result).toEqual({
      success: false,
      errorCode: 'NO_RECIPIENT_EMAIL',
      errorMessage: expect.any(String),
    });
  });

  it('does NOT call template service or provider when email is missing', async () => {
    const context: DeliveryContext = { recipientId: 'user-001', email: null };
    await service.deliver(makeNotification(), context);

    expect(emailTemplateService.render).not.toHaveBeenCalled();
    expect(emailProvider.sendMail).not.toHaveBeenCalled();
  });

  // ─── Template rendering ────────────────────────────────────────────────────

  it('calls EmailTemplateService.render with notification title and body', async () => {
    const notif = makeNotification({ title: 'Test Title', body: 'Test Body' });
    const context: DeliveryContext = {
      recipientId: 'user-001',
      email: 'user@example.com',
    };

    await service.deliver(notif, context);

    expect(emailTemplateService.render).toHaveBeenCalledWith(
      'Test Title',
      'Test Body',
    );
  });

  // ─── Provider call ─────────────────────────────────────────────────────────

  it('calls emailProvider.sendMail with correct params', async () => {
    const notif = makeNotification({
      title: 'Payment OK',
      body: 'Payment confirmed.',
    });
    const email = 'recipient@example.com';
    const context: DeliveryContext = { recipientId: 'user-001', email };

    await service.deliver(notif, context);

    expect(emailProvider.sendMail).toHaveBeenCalledWith({
      to: email,
      subject: 'Payment OK',
      html: RENDERED_HTML,
      text: RENDERED_TEXT,
    });
  });

  // ─── Success path ──────────────────────────────────────────────────────────

  it('returns { success: true } when provider sendMail resolves', async () => {
    emailProvider.sendMail.mockResolvedValue(undefined);
    const context: DeliveryContext = {
      recipientId: 'user-001',
      email: 'ok@example.com',
    };

    const result = await service.deliver(makeNotification(), context);

    expect(result).toEqual({ success: true });
  });

  // ─── Error mapping ─────────────────────────────────────────────────────────

  it('maps "SMTP_NOT_CONFIGURED" error to SMTP_NOT_CONFIGURED errorCode', async () => {
    emailProvider.sendMail.mockRejectedValue(new Error('SMTP_NOT_CONFIGURED'));
    const context: DeliveryContext = {
      recipientId: 'user-001',
      email: 'user@example.com',
    };

    const result = await service.deliver(makeNotification(), context);

    expect(result).toEqual({
      success: false,
      errorCode: 'SMTP_NOT_CONFIGURED',
      errorMessage: 'SMTP_NOT_CONFIGURED',
    });
  });

  it('maps any other error to SMTP_SEND_ERROR errorCode', async () => {
    emailProvider.sendMail.mockRejectedValue(
      new Error('ECONNRESET: Connection reset by peer'),
    );
    const context: DeliveryContext = {
      recipientId: 'user-001',
      email: 'user@example.com',
    };

    const result = await service.deliver(makeNotification(), context);

    expect(result).toEqual({
      success: false,
      errorCode: 'SMTP_SEND_ERROR',
      errorMessage: expect.stringContaining('ECONNRESET'),
    });
  });

  it('maps authentication error to SMTP_SEND_ERROR, not SMTP_NOT_CONFIGURED', async () => {
    emailProvider.sendMail.mockRejectedValue(
      new Error('535 Authentication failed'),
    );
    const context: DeliveryContext = {
      recipientId: 'user-001',
      email: 'user@example.com',
    };

    const result = await service.deliver(makeNotification(), context);

    expect(result.errorCode).toBe('SMTP_SEND_ERROR');
  });

  // ─── Never throws ──────────────────────────────────────────────────────────

  it('never throws even on catastrophic provider failure', async () => {
    emailProvider.sendMail.mockRejectedValue(new Error('Catastrophic failure'));
    const context: DeliveryContext = {
      recipientId: 'user-001',
      email: 'user@example.com',
    };

    await expect(
      service.deliver(makeNotification(), context),
    ).resolves.toBeDefined();
  });

  it('returns false success (not undefined) when provider throws', async () => {
    emailProvider.sendMail.mockRejectedValue(new Error('Any error'));
    const context: DeliveryContext = {
      recipientId: 'user-001',
      email: 'user@example.com',
    };

    const result = await service.deliver(makeNotification(), context);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBeDefined();
  });
});
