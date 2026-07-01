import { Injectable } from '@nestjs/common';

export interface EmailTemplate {
  /** Full HTML email body */
  html: string;
  /** Plain-text fallback (for clients that don't render HTML) */
  text: string;
}

/**
 * EmailTemplateService
 *
 * Renders a branded HTML + plain-text email from a notification's
 * title and body text.
 *
 * Design:
 *  - Pure function (no I/O, easily unit-tested).
 *  - Localization-ready: all Vietnamese copy is in one place.
 *  - Separate from NotificationTemplateService (which renders in-app text).
 *  - HTML is inline-styled for maximum email client compatibility.
 *  - HTML entities are escaped to prevent XSS in email clients.
 *  - Future: swap render() for a Handlebars / MJML template lookup.
 *
 * Phase: N-4 — Multi-Channel Delivery
 */
@Injectable()
export class EmailTemplateService {
  /**
   * Render a branded HTML + plaintext email for a notification.
   *
   * @param title  Short notification title (rendered as <h2>)
   * @param body   Full notification body text (rendered as <p>)
   */
  render(title: string, body: string): EmailTemplate {
    const safeTitle = this.escapeHtml(title);
    const safeBody = this.escapeHtml(body);

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
          <!-- Header -->
          <tr>
            <td style="background:#f97316;padding:20px 32px;">
              <span style="color:#fff;font-size:22px;font-weight:bold;letter-spacing:-0.5px;">UITFood</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">${safeTitle}</h2>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#374151;">${safeBody}</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px;" />
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                Đây là email tự động từ UITFood. Vui lòng không trả lời email này.<br />
                Bạn nhận được email này vì tài khoản của bạn đã bật thông báo qua email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;text-align:center;">
              <span style="font-size:11px;color:#9ca3af;">© UITFood. Giao hàng nhanh, chất lượng đảm bảo.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = `${title}\n\n${body}\n\n---\nUITFood — Đây là email tự động, vui lòng không trả lời.`;

    return { html, text };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
