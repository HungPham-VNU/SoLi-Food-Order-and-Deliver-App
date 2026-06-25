import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  EMAIL_PROVIDER,
  type IEmailProvider,
} from '../channels/email/email-provider.interface';
import { EmailTemplateService } from '../channels/email/email-template.service';
import type { TestEmailResponseDto } from '../dto/test-email.dto';

/**
 * TestEmailService
 *
 * Thin service used exclusively by the development test email endpoint.
 * Delegates directly to the EMAIL_PROVIDER token so the test endpoint
 * exercises the real NodemailerEmailProvider (or NoopEmailProvider in CI).
 *
 * TODO: Remove this service (and TestEmailDto + the controller endpoint)
 *       before going to production.
 *
 * Phase: N-4 — Email Channel Testing
 */
@Injectable()
export class TestEmailService {
  private readonly logger = new Logger(TestEmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
    private readonly templateService: EmailTemplateService,
  ) {}

  /**
   * Send a test email to verify the SMTP configuration end-to-end.
   *
   * @param to      Recipient address
   * @param subject Email subject (optional)
   * @param body    Email body text (optional)
   */
  async send(
    to: string,
    subject = 'SoLi Food — SMTP Integration Test',
    body = 'This is a test email from the SoLi Notification Boundary Context. If you see this, SMTP is working correctly!',
  ): Promise<TestEmailResponseDto> {
    this.logger.log(`[TestEmail] Sending test email to <${to}>`);
    try {
      const { html, text } = this.templateService.render(subject, body);
      await this.emailProvider.sendMail({ to, subject, html, text });
      this.logger.log(`[TestEmail] ✓ Test email delivered to <${to}>`);
      return {
        success: true,
        message: `Test email delivered to <${to}>`,
      };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(
        `[TestEmail] ✗ Failed to deliver test email to <${to}>: ${message}`,
        (err as Error).stack,
      );
      return {
        success: false,
        message: `SMTP delivery failed: ${message}`,
      };
    }
  }
}
