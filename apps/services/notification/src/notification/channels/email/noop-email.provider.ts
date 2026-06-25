import { Injectable, Logger } from '@nestjs/common';
import type {
  IEmailProvider,
  EmailSendOptions,
} from './email-provider.interface';

/**
 * NoopEmailProvider
 *
 * Fallback email provider used when SMTP is not configured in the current
 * environment (SMTP_HOST not set).
 *
 * Behaviour:
 *  - Logs a warning with the suppressed email's recipient and subject.
 *  - Throws a recognisable error ('SMTP_NOT_CONFIGURED') so that
 *    EmailChannelService can record a delivery failure in the audit log.
 *
 * This provider is never used in production — it acts as a safe default
 * for development, test, and CI environments where an SMTP server is not
 * available. The delivery failure is expected and observable via the
 * notification_delivery_logs table.
 *
 * Phase: N-4 — Multi-Channel Delivery
 */
@Injectable()
export class NoopEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(NoopEmailProvider.name);

  sendMail(options: EmailSendOptions): Promise<void> {
    this.logger.warn(
      `[NoopEmail] SMTP not configured — suppressing email to <${options.to}>: "${options.subject}"`,
    );
    throw new Error('SMTP_NOT_CONFIGURED');
  }
}
