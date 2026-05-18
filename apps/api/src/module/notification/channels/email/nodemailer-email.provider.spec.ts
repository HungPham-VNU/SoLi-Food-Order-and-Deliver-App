/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NodemailerEmailProvider } from './nodemailer-email.provider';
import type { EmailSendOptions } from './email-provider.interface';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal ConfigService stub that returns values from a map.
 * SMTP_SECURE must come back as a boolean (after env.schema.ts transform).
 */
function makeConfigService(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: 587,
    SMTP_SECURE: false, // boolean — already transformed by env schema
    SMTP_USER: 'test@example.com',
    SMTP_PASS: 'app-password',
    SMTP_FROM: 'test@example.com',
  };
  const map = { ...defaults, ...overrides };
  return { get: (key: string) => map[key] } as unknown as ConfigService;
}

// ---------------------------------------------------------------------------
// Mock nodemailer at module level so all tests share the same mock references
// ---------------------------------------------------------------------------

const mockVerify = jest.fn();
const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({
  verify: mockVerify,
  sendMail: mockSendMail,
}));

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => mockCreateTransport(...args),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NodemailerEmailProvider', () => {
  let provider: NodemailerEmailProvider;
  let module: TestingModule;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue(undefined);
    mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });

    module = await Test.createTestingModule({
      providers: [
        NodemailerEmailProvider,
        {
          provide: ConfigService,
          useValue: makeConfigService(),
        },
      ],
    }).compile();

    provider = module.get(NodemailerEmailProvider);
  });

  afterEach(async () => {
    await module.close();
  });

  // -------------------------------------------------------------------------
  // Constructor / transporter configuration
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('creates a transporter with the configured SMTP options', () => {
      expect(mockCreateTransport).toHaveBeenCalledTimes(1);
      const callArg = mockCreateTransport.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArg.host).toBe('smtp.gmail.com');
      expect(callArg.port).toBe(587);
      expect(callArg.secure).toBe(false);
      expect(callArg.auth).toEqual({
        user: 'test@example.com',
        pass: 'app-password',
      });
    });

    it('sets requireTLS=true when secure=false (STARTTLS path)', () => {
      const callArg = mockCreateTransport.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArg.requireTLS).toBe(true);
    });

    it('sets requireTLS=false when secure=true (direct SSL path)', async () => {
      jest.clearAllMocks();
      mockVerify.mockResolvedValue(undefined);
      mockSendMail.mockResolvedValue({});

      const mod = await Test.createTestingModule({
        providers: [
          NodemailerEmailProvider,
          {
            provide: ConfigService,
            useValue: makeConfigService({ SMTP_PORT: 465, SMTP_SECURE: true }),
          },
        ],
      }).compile();

      const callArg = mockCreateTransport.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArg.requireTLS).toBe(false);
      await mod.close();
    });

    it('uses SMTP_FROM as the fromAddress', () => {
      // Confirmed indirectly: sendMail should pass this value to nodemailer
      const sendOptions: EmailSendOptions = {
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>hi</p>',
        text: 'hi',
      };
      void provider.sendMail(sendOptions);
      const sendArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
      expect(sendArg.from).toBe('test@example.com');
    });

    it('falls back to SMTP_USER when SMTP_FROM is the default placeholder', async () => {
      jest.clearAllMocks();
      mockVerify.mockResolvedValue(undefined);
      mockSendMail.mockResolvedValue({});

      const mod = await Test.createTestingModule({
        providers: [
          NodemailerEmailProvider,
          {
            provide: ConfigService,
            useValue: makeConfigService({
              SMTP_FROM: 'noreply@soli.dev', // default placeholder
              SMTP_USER: 'user@company.com',
            }),
          },
        ],
      }).compile();

      const prov = mod.get(NodemailerEmailProvider);
      await prov.sendMail({
        to: 'r@e.com',
        subject: 'S',
        html: '<p>B</p>',
        text: 'B',
      });
      const arg = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
      expect(arg.from).toBe('user@company.com');
      await mod.close();
    });

    it('sets connectionTimeout and greetingTimeout on the transporter', () => {
      const callArg = mockCreateTransport.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArg.connectionTimeout).toBe(10_000);
      expect(callArg.greetingTimeout).toBe(10_000);
    });
  });

  // -------------------------------------------------------------------------
  // onModuleInit — SMTP verification
  // -------------------------------------------------------------------------

  describe('onModuleInit', () => {
    it('calls transporter.verify() on init', async () => {
      await provider.onModuleInit();
      expect(mockVerify).toHaveBeenCalledTimes(1);
    });

    it('does NOT throw when verify() succeeds', async () => {
      mockVerify.mockResolvedValueOnce(undefined);
      await expect(provider.onModuleInit()).resolves.toBeUndefined();
    });

    it('does NOT throw when verify() rejects (swallows SMTP errors)', async () => {
      mockVerify.mockRejectedValueOnce(new Error('ECONNREFUSED 0.0.0.0:587'));
      await expect(provider.onModuleInit()).resolves.toBeUndefined();
    });

    it('logs an ERROR when verify() fails', async () => {
      const logSpy = jest.spyOn(
        (provider as unknown as { logger: { error: jest.Mock } }).logger,
        'error',
      );
      mockVerify.mockRejectedValueOnce(new Error('DNS lookup failed'));
      await provider.onModuleInit();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('SMTP connection verification FAILED'),
        expect.anything(),
      );
    });
  });

  // -------------------------------------------------------------------------
  // sendMail
  // -------------------------------------------------------------------------

  describe('sendMail', () => {
    const baseOptions: EmailSendOptions = {
      to: 'user@example.com',
      subject: 'Order confirmed',
      html: '<h1>Order confirmed!</h1>',
      text: 'Order confirmed!',
    };

    it('calls transporter.sendMail with the correct fields', async () => {
      await provider.sendMail(baseOptions);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'user@example.com',
        subject: 'Order confirmed',
        html: '<h1>Order confirmed!</h1>',
        text: 'Order confirmed!',
      });
    });

    it('resolves successfully when transporter.sendMail resolves', async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: 'abc123' });
      await expect(provider.sendMail(baseOptions)).resolves.toBeUndefined();
    });

    it('propagates errors thrown by transporter.sendMail', async () => {
      const smtpError = Object.assign(new Error('Invalid login'), {
        responseCode: 535,
      });
      mockSendMail.mockRejectedValueOnce(smtpError);
      await expect(provider.sendMail(baseOptions)).rejects.toThrow(
        'Invalid login',
      );
    });
  });
});
