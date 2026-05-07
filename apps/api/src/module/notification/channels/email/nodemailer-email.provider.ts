import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { IEmailProvider, EmailSendOptions } from './email-provider.interface';

/**
 * NodemailerEmailProvider
 *
 * Sends transactional emails via SMTP using Nodemailer.
 *
 * Configuration (from environment — set in docker-compose / .env):
 *   SMTP_HOST    — SMTP server hostname (e.g. smtp.gmail.com, smtp.mailtrap.io)
 *   SMTP_PORT    — Port (default 587 for STARTTLS, 465 for SSL)
 *   SMTP_SECURE  — true for SSL/TLS on port 465 (default false)
 *   SMTP_USER    — SMTP username / account login
 *   SMTP_PASS    — SMTP password or app password
 *   SMTP_FROM    — Sender address (default: noreply@soli.dev)
 *
 * Migration path:
 *  - Replace this class with SendGridEmailProvider / PostmarkEmailProvider
 *    that also implement IEmailProvider, then swap the provider binding in
 *    NotificationModule without touching EmailChannelService or any handlers.
 *
 * Phase: N-4 — Multi-Channel Delivery
 */
@Injectable()
export class NodemailerEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(NodemailerEmailProvider.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.fromAddress =
      configService.get<string>('SMTP_FROM') ?? 'noreply@soli.dev';

    this.transporter = nodemailer.createTransport({
      host: configService.get<string>('SMTP_HOST'),
      port: configService.get<number>('SMTP_PORT') ?? 587,
      secure: configService.get<boolean>('SMTP_SECURE') ?? false,
      auth: {
        user: configService.get<string>('SMTP_USER'),
        pass: configService.get<string>('SMTP_PASS'),
      },
    });

    this.logger.log(
      `[NodemailerEmail] Transporter configured: host=${configService.get('SMTP_HOST')} port=${configService.get('SMTP_PORT') ?? 587}`,
    );
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
