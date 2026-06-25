import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Notification } from '../../domain/notification.schema';
import { EmailTemplateService } from './email-template.service';
import { EMAIL_PROVIDER } from './email-provider.interface';
import type { IEmailProvider } from './email-provider.interface';
import type {
  INotificationChannel,
  DeliveryContext,
  DeliveryResult,
} from '../channel.interface';

/**
 * EmailChannelService
 *
 * Delivers a notification via email (SMTP).
 *
 * Flow:
 *  1. Check that the recipient has an email address on record
 *     (from notification_preferences.email — denormalised from IAM).
 *  2. Render an HTML + plaintext email via EmailTemplateService.
 *  3. Dispatch via IEmailProvider (Nodemailer in prod, Noop in dev/CI).
 *  4. Return DeliveryResult (success | failure with error code).
 *
 * Error codes:
 *   NO_RECIPIENT_EMAIL   — preferences row has no email address
 *   SMTP_NOT_CONFIGURED  — SMTP env vars absent (Noop provider active)
 *   SMTP_SEND_ERROR      — Nodemailer returned an SMTP error
 *
 * MUST NOT throw — all errors are caught and expressed as DeliveryResult.
 *
 * Migration path: swap EMAIL_PROVIDER binding in NotificationModule to
 * SendGridEmailProvider / PostmarkEmailProvider without any changes here.
 *
 * Phase: N-4 — Multi-Channel Delivery
 */
@Injectable()
export class EmailChannelService implements INotificationChannel {
  private readonly logger = new Logger(EmailChannelService.name);

  constructor(
    private readonly emailTemplateService: EmailTemplateService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
  ) {}

  async deliver(
    notification: Notification,
    context: DeliveryContext,
  ): Promise<DeliveryResult> {
    // Guard: recipient must have an email address on record
    if (!context.email) {
      this.logger.warn(
        `[Email] No recipient email for userId=${context.recipientId} — skipping email for notification ${notification.id}`,
      );
      return {
        success: false,
        errorCode: 'NO_RECIPIENT_EMAIL',
        errorMessage: 'No email address on file for recipient',
      };
    }

    const { html, text } = this.emailTemplateService.render(
      notification.title,
      notification.body,
    );

    try {
      await this.emailProvider.sendMail({
        to: context.email,
        subject: notification.title,
        html,
        text,
      });
      this.logger.log(
        `[Email] Sent to <${context.email}> for notification ${notification.id} (type=${notification.type})`,
      );
      return { success: true };
    } catch (err) {
      const msg = (err as Error).message;
      const errorCode =
        msg === 'SMTP_NOT_CONFIGURED'
          ? 'SMTP_NOT_CONFIGURED'
          : 'SMTP_SEND_ERROR';
      this.logger.warn(
        `[Email] Failed to send to <${context.email}> for notification ${notification.id}: ${msg}`,
      );
      return {
        success: false,
        errorCode,
        errorMessage: msg,
      };
    }
  }
}
