// ---------------------------------------------------------------------------
// IEmailProvider
//
// Strategy interface for email transport providers.
// Implementing this interface allows future migration from Nodemailer
// (self-hosted SMTP) to SendGrid, Postmark, or SES without touching
// EmailChannelService or any business logic.
//
// Phase: N-4 — Multi-Channel Delivery
// ---------------------------------------------------------------------------

export interface EmailSendOptions {
  /** Recipient email address */
  to: string;
  /** Email subject line (mapped from notification.title) */
  subject: string;
  /** HTML body (rendered by EmailTemplateService) */
  html: string;
  /** Plain-text fallback body (rendered by EmailTemplateService) */
  text: string;
}

export interface IEmailProvider {
  sendMail(options: EmailSendOptions): Promise<void>;
}

/**
 * NestJS injection token for IEmailProvider.
 * The module provides either NodemailerEmailProvider (when SMTP is configured)
 * or NoopEmailProvider (when SMTP env vars are absent).
 */
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';
