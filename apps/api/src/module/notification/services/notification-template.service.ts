import { Injectable } from '@nestjs/common';
import type { NotificationType } from '../domain/notification.schema';

// ---------------------------------------------------------------------------
// Template data shape
// ---------------------------------------------------------------------------
export interface NotificationTemplate {
  title: string;
  body: string;
}

// ---------------------------------------------------------------------------
// NotificationTemplateService
//
// Resolves a { title, body } pair for every notification type given
// a plain-object data bag of interpolation variables.
//
// Design:
//  - Pure function — no I/O, no dependencies, easily unit-tested.
//  - Templates are defined inline (no file-system lookup).
//  - Variable interpolation: JavaScript template literals inside arrow functions.
//  - Unknown keys fall back to '—' — templates never throw on missing data.
//  - Amount formatting: VND uses integer values (no decimals after
//    the money-integer refactor, migration 0011).
//
// Phase: N-1 — Foundation
//        N-5  — Replace templates with i18n catalogue (future)
// ---------------------------------------------------------------------------
@Injectable()
export class NotificationTemplateService {
  // ---------------------------------------------------------------------------
  // Template registry
  //
  // Every NotificationType must have a corresponding entry here.
  // Keys use the exact enum values from notification.schema.ts.
  // ---------------------------------------------------------------------------
  private readonly TEMPLATES: Record<
    NotificationType,
    (data: Record<string, string>) => NotificationTemplate
  > = {
    // --- Customer receives confirmation the order was placed ---
    order_placed: (d) => ({
      title: 'Đặt hàng thành công',
      body: `Đơn hàng #${d.orderId ?? '—'} từ ${d.restaurantName ?? 'nhà hàng'} đã được đặt. Tổng: ${this.formatVnd(d.totalAmount)}.`,
    }),

    // --- Restaurant confirmed and will prepare the order ---
    order_confirmed: (d) => ({
      title: 'Nhà hàng đã xác nhận đơn',
      body: `${d.restaurantName ?? 'Nhà hàng'} đã xác nhận đơn #${d.orderId ?? '—'}. Món ăn đang được chuẩn bị.`,
    }),

    // --- Restaurant started cooking ---
    order_preparing: (d) => ({
      title: 'Đang chuẩn bị món ăn',
      body: `Đơn hàng #${d.orderId ?? '—'} đang được ${d.restaurantName ?? 'nhà hàng'} chế biến.`,
    }),

    // --- Order ready for pickup (restaurant triggered: preparing → ready_for_pickup) ---
    order_ready_for_pickup: (d) => ({
      title: 'Đơn hàng sẵn sàng lấy',
      body: `Đơn hàng #${d.orderId ?? '—'} đã sẵn sàng. Tài xế đang đến lấy hàng.`,
    }),

    // --- Shipper has collected the order ---
    order_picked_up: (d) => ({
      title: 'Đã lấy hàng',
      body: `Tài xế đã nhận đơn #${d.orderId ?? '—'} từ ${d.restaurantName ?? 'nhà hàng'}.`,
    }),

    // --- Shipper is en route to the customer ---
    order_delivering: (d) => ({
      title: 'Đơn hàng đang giao',
      body: `Đơn hàng #${d.orderId ?? '—'} đang trên đường đến bạn.`,
    }),

    // --- Order delivered successfully ---
    order_delivered: (d) => ({
      title: 'Giao hàng thành công 🎉',
      body: `Đơn hàng #${d.orderId ?? '—'} đã được giao. Cảm ơn bạn đã sử dụng SoLi!`,
    }),

    // --- Order cancelled ---
    order_cancelled: (d) => ({
      title: 'Đơn hàng đã bị huỷ',
      body: `Đơn hàng #${d.orderId ?? '—'} đã bị huỷ${d.reason ? `: ${d.reason}.` : '.'}`,
    }),

    // --- Refund processed (cancelled VNPay order) ---
    order_refunded: (d) => ({
      title: 'Hoàn tiền thành công',
      body: `${this.formatVnd(d.amount)} đã được hoàn về tài khoản của bạn cho đơn #${d.orderId ?? '—'}.`,
    }),

    // --- VNPay payment succeeded ---
    payment_confirmed: (d) => ({
      title: 'Thanh toán thành công',
      body: `Thanh toán ${this.formatVnd(d.paidAmount)} cho đơn #${d.orderId ?? '—'} đã được xác nhận qua VNPay.`,
    }),

    // --- VNPay payment failed ---
    payment_failed: (d) => ({
      title: 'Thanh toán thất bại',
      body: `Thanh toán cho đơn #${d.orderId ?? '—'} không thành công${d.reason ? `: ${d.reason}.` : '. Vui lòng thử lại.'}`,
    }),

    // --- Refund process started ---
    refund_initiated: (d) => ({
      title: 'Đang xử lý hoàn tiền',
      body: `Yêu cầu hoàn ${this.formatVnd(d.paidAmount)} cho đơn #${d.orderId ?? '—'} đang được xử lý.`,
    }),

    // [RESERVED] — Not yet triggered (Payment BC refund webhook)
    refund_completed: (d) => ({
      title: 'Hoàn tiền hoàn tất',
      body: `${this.formatVnd(d.amount)} đã được hoàn thành công cho đơn #${d.orderId ?? '—'}.`,
    }),

    // --- Restaurant owner receives new order notification ---
    new_order_received: (d) => ({
      title: 'Đơn hàng mới!',
      body: `Bạn có đơn hàng mới #${d.orderId ?? '—'}. Tổng: ${this.formatVnd(d.totalAmount)}. Vui lòng xác nhận sớm.`,
    }),

    // --- Restaurant owner receives new review notification (UC-22) ---
    new_review: (d) => ({
      title: 'Đánh giá mới!',
      body: `Nhà hàng ${d.restaurantName ?? 'của bạn'} vừa nhận được đánh giá ${d.stars ?? '?'} sao cho đơn #${d.orderId ?? '—'}.`,
    }),

    // [RESERVED] — Not yet triggered (Delivery BC shipper)
    pickup_request: (d) => ({
      title: 'Yêu cầu lấy hàng',
      body: `Đơn hàng #${d.orderId ?? '—'} tại ${d.restaurantName ?? 'nhà hàng'} sẵn sàng để lấy.`,
    }),

    // --- Admin broadcast ---
    system_announcement: (d) => ({
      title: d.title ?? 'Thông báo hệ thống',
      body: d.message ?? '',
    }),
  };

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Resolve the { title, body } pair for a notification type.
   * `templateData` is a flat string-valued map of interpolation variables.
   * All keys from the template are substituted; unknown keys become ''.
   */
  render(
    type: NotificationType,
    templateData: Record<string, string>,
  ): NotificationTemplate {
    const templateFn = this.TEMPLATES[type];
    return templateFn(templateData);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Format an integer VND amount string.
   * e.g. "150000" → "150.000 ₫"
   * Falls back to "—" when the string is missing or non-numeric.
   */
  private formatVnd(value: string | undefined): string {
    if (!value) return '—';
    const num = parseInt(value, 10);
    if (isNaN(num)) return '—';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(num);
  }
}
