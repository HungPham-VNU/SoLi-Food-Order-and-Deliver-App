# Báo Cáo Design Pattern: Strategy Pattern trong Module Notification

**Dự án:** SoLi Food Delivery — NestJS Backend
**Pattern được phân tích:** Strategy Pattern
**Module áp dụng:** Notification (Gửi thông báo đa kênh)

---

## 1. Strategy Pattern là gì?

Strategy Pattern là một Behavioral Design Pattern cho phép định nghĩa một nhóm các thuật toán/hành vi có thể hoán đổi cho nhau tại runtime, mà không làm thay đổi code của phần sử dụng chúng (client).

Ý tưởng cốt lõi:
- Tách biệt **"cái gì cần làm"** (interface chung) khỏi **"làm như thế nào"** (từng implementation cụ thể).
- Phần điều phối chỉ cần biết interface — không cần biết kênh cụ thể nào đang chạy.

---

## 2. Bài toán cần giải quyết

Hệ thống Food Delivery cần gửi thông báo cho người dùng (khách hàng, nhà hàng, tài xế) thông qua nhiều kênh khác nhau:

| Kênh         | Công nghệ          | Trường hợp sử dụng                     |
|--------------|--------------------|----------------------------------------|
| Email        | Nodemailer / SMTP  | Xác nhận đơn hàng, biên lai thanh toán |
| Push         | Firebase Admin     | Cập nhật trạng thái đơn hàng realtime  |
| In-app       | WebSocket Gateway  | Thông báo khi đang dùng app            |

**Vấn đề nếu không dùng Strategy:**
- Code điều phối (`ChannelDispatcherService`) sẽ phải có chuỗi `if/else` hoặc `switch` kiểm tra từng loại kênh.
- Mỗi khi thêm kênh mới (SMS, Zalo OA...), phải sửa trực tiếp `ChannelDispatcherService` — vi phạm nguyên tắc Open/Closed.
- Không thể mock từng kênh riêng lẻ trong unit test.

---

## 3. Cách Strategy Pattern được áp dụng

### 3.1 Interface chung — `INotificationChannel`

File: `apps/api/src/module/notification/channels/channel.interface.ts`

```typescript
export interface INotificationChannel {
  deliver(notification: Notification, context: DeliveryContext): Promise<DeliveryResult>;
}
```

Đây là **Strategy interface** — mọi kênh gửi thông báo đều phải implement method `deliver()` này.

`DeliveryResult` trả về `{ success: boolean, errorCode?: string, errorMessage?: string }` để `ChannelDispatcherService` xử lý đồng nhất dù kênh nào thất bại.

### 3.2 Các Concrete Strategy

#### Email Channel

File: `apps/api/src/module/notification/channels/email/email.channel.service.ts`

- Implements `INotificationChannel`.
- Render HTML + text từ `EmailTemplateService`.
- Gọi `IEmailProvider.sendMail()` — bản thân kênh email lại áp dụng Strategy Pattern lần nữa cho provider (Nodemailer hoặc Noop).
- Trả về `errorCode: 'SMTP_SEND_ERROR'` hoặc `'NO_RECIPIENT_EMAIL'` khi thất bại.

#### Push Channel

File: `apps/api/src/module/notification/channels/push/push.channel.service.ts`

- Implements `INotificationChannel`.
- Lấy danh sách device token từ `notification_preferences`.
- Gọi `IFCMProvider.send()` — tương tự có provider thật (`firebase-push.provider.ts`) và stub (`stub-push.provider.ts`).
- Trả về `errorCode: 'NO_ACTIVE_TOKENS'` hoặc `'FCM_SEND_ERROR'` khi thất bại.

#### In-App Channel

File: `apps/api/src/module/notification/channels/in-app/in-app.channel.service.ts`

- Implements `INotificationChannel`.
- Emit sự kiện qua WebSocket Gateway đến đúng socket của người dùng.
- Trả về `errorCode: 'WS_EMIT_ERROR'` nếu WebSocket throw.

### 3.3 Context — `ChannelDispatcherService`

File: `apps/api/src/module/notification/services/channel-dispatcher.service.ts`

- Nhận danh sách các `INotificationChannel` thông qua Dependency Injection.
- Gọi `channel.deliver(notification, context)` cho từng kênh đã được cấu hình.
- Ghi kết quả vào `notification_delivery_logs`.
- Cập nhật trạng thái notification (`sent` / `failed`).

`ChannelDispatcherService` **không biết** đang gọi Email, Push hay In-App. Nó chỉ biết `INotificationChannel.deliver()`.

---

## 4. Kiến trúc tổng thể của module

```
Event xảy ra (VD: OrderPlacedEvent)
        │
        ▼
NotificationEventHandler
        │  tạo Notification record
        ▼
ChannelDispatcherService          ← Context (Strategy Pattern)
        │
        ├── EmailChannelService   ← Concrete Strategy
        ├── PushChannelService    ← Concrete Strategy
        └── InAppChannelService   ← Concrete Strategy
               │
               └── (Email còn có nested Strategy)
                   ├── NodemailerEmailProvider  ← Production
                   └── NoopEmailProvider        ← Testing
```

**Cơ chế chọn kênh tại runtime:**
- Module `notification.module.ts` đăng ký tất cả 3 service implement `INotificationChannel`.
- `ChannelDispatcherService` nhận vào một mảng `INotificationChannel[]` — NestJS inject đầy đủ 3 kênh.
- Tất cả kênh được gọi song song hoặc tuần tự; nếu một kênh thất bại, các kênh còn lại vẫn tiếp tục.

---

## 5. Strategy Pattern hai tầng (nested)

Đây là điểm kỹ thuật đáng chú ý nhất trong module Notification:

**Tầng 1 — Channel Strategy:**
- Interface: `INotificationChannel`
- Concrete: `EmailChannelService`, `PushChannelService`, `InAppChannelService`

**Tầng 2 — Provider Strategy (bên trong Email và Push):**
- Interface: `IEmailProvider` (file: `email-provider.interface.ts`)
- Concrete: `NodemailerEmailProvider` (production), `NoopEmailProvider` (testing/dev)
- Interface: `IPushProvider` (file: `push-provider.interface.ts`)
- Concrete: `FirebasePushProvider` (production), `StubPushProvider` (testing)

**Lợi ích thực tế:** Unit test có thể inject `NoopEmailProvider` → không cần kết nối SMTP thật → test nhanh, không có side effect.

---

## 6. Ưu điểm trong hệ thống Food Delivery

| Ưu điểm | Giải thích |
|---------|-----------|
| Mở rộng dễ dàng | Thêm kênh SMS / Zalo OA chỉ cần viết thêm class implement `INotificationChannel`, không sửa code cũ |
| Open/Closed Principle | `ChannelDispatcherService` không bao giờ cần thay đổi khi thêm kênh mới |
| Isolation of failures | Nếu FCM lỗi, Email và In-App vẫn gửi bình thường; `DeliveryResult` bắt lỗi từng kênh riêng |
| Testability | Mỗi channel service có thể unit-test độc lập; provider stub tránh phụ thuộc SMTP/FCM |
| Separation of Concerns | Logic render email ở `EmailTemplateService`, logic gửi ở `IEmailProvider`, logic điều phối ở `ChannelDispatcherService` |

---

## 7. Kết luận

Strategy Pattern được áp dụng thực sự trong module Notification của SoLi Food Delivery, không chỉ là lý thuyết. Toàn bộ 3 kênh thông báo (Email, Push, In-app) đều implement cùng interface `INotificationChannel`, cho phép `ChannelDispatcherService` điều phối mà không cần biết chi tiết từng kênh. Việc sử dụng Strategy Pattern hai tầng (channel-level + provider-level) cho thấy đội phát triển hiểu rõ nguyên tắc Dependency Inversion và khả năng mở rộng dài hạn của hệ thống.

Nếu cần thêm kênh mới trong tương lai (SMS, Zalo, Telegram...), chỉ cần:
1. Tạo class implement `INotificationChannel`.
2. Đăng ký trong `notification.module.ts`.
3. Không sửa bất kỳ dòng nào trong `ChannelDispatcherService`.
