import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type {
  IEmailProvider,
  EmailSendOptions,
} from './email-provider.interface';

/**
 * NodemailerEmailProvider
 *
 * Sends transactional emails via SMTP using Nodemailer.
 *
 * Configuration (from environment — set in docker-compose / .env):
 *   SMTP_HOST    — SMTP server hostname (e.g. smtp.gmail.com)
 *   SMTP_PORT    — Port (default 587 for STARTTLS, 465 for direct SSL)
 *   SMTP_SECURE  — 'true' for direct SSL on port 465 (default false = STARTTLS)
 *   SMTP_USER    — SMTP username / Google Workspace / Gmail account
 *   SMTP_PASS    — App Password (Google: Account → Security → App Passwords)
 *   SMTP_FROM    — Sender address — MUST match authenticated SMTP_USER for Gmail
 *
 * Gmail / Google Workspace notes:
 *   - Use SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_SECURE=false
 *   - SMTP_PASS must be a 16-character App Password (requires 2FA on the account)
 *   - SMTP_FROM must match SMTP_USER — Google rejects FROM addresses that are
 *     not the authenticated sender or a verified "Send as" alias
 *
 * Migration path:
 *  - Replace this class with SendGridEmailProvider / PostmarkEmailProvider
 *    that also implement IEmailProvider, then swap the provider binding in
 *    NotificationModule without touching EmailChannelService or any handlers.
 *
 * Phase: N-4 — Multi-Channel Delivery
 */
@Injectable()
export class NodemailerEmailProvider implements IEmailProvider, OnModuleInit {
  private readonly logger = new Logger(NodemailerEmailProvider.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const host = configService.get<string>('SMTP_HOST') ?? '';
    const port = configService.get<number>('SMTP_PORT') ?? 587;
    const secure = configService.get<boolean>('SMTP_SECURE') ?? false;
    const user = configService.get<string>('SMTP_USER') ?? '';

    // SMTP_FROM must match the authenticated SMTP_USER when using Gmail/Google Workspace.
    // Fall back to the authenticated user address if SMTP_FROM is the default placeholder.
    const configuredFrom = configService.get<string>('SMTP_FROM') ?? '';
    this.fromAddress =
      configuredFrom && configuredFrom !== 'noreply@soli.dev'
        ? configuredFrom
        : user;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      // requireTLS: true forces STARTTLS upgrade when secure=false (port 587).
      // Prevents accidental plain-text SMTP fallback if the server drops TLS.
      requireTLS: !secure,
      auth: {
        user,
        pass: configService.get<string>('SMTP_PASS'),
      },
      tls: {
        // In non-production, allow self-signed certs for dev/test SMTP servers.
        // Production always enforces a valid certificate chain.
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
    });

    this.logger.log(
      `[NodemailerEmail] Transporter configured: host=${host} port=${port} secure=${secure} user=${user} from=${this.fromAddress}`,
    );
  }

  /**
   * Verify the SMTP connection during module initialisation.
   * A failed verification is logged as an ERROR but does NOT prevent the app
   * from starting — email delivery failures are recorded per-notification in
   * notification_delivery_logs and the channel contract never throws.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log(
        '[NodemailerEmail] ✓ SMTP connection verified — ready to send mail',
      );
    } catch (err) {
      this.logger.error(
        `[NodemailerEmail] ✗ SMTP connection verification FAILED: ${(err as Error).message}` +
          '\n  → Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in your .env file.' +
          '\n  → For Gmail/Google Workspace: use smtp.gmail.com:587 with an App Password.',
        (err as Error).stack,
      );
      // Intentionally swallowed — app starts, individual sends will also fail
      // and the EmailChannelService will log SMTP_SEND_ERROR delivery records.
    }
  }

  async sendMail(options: EmailSendOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    this.logger.log(
      `[NodemailerEmail] Mail sent to <${options.to}>: "${options.subject}"`,
    );
  }
}
