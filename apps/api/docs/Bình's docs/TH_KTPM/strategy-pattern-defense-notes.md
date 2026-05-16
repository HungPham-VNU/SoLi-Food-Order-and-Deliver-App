# Ghi Chú Bảo Vệ — Strategy Pattern (Notification Channels)

> Đây là tài liệu chuẩn bị riêng cho phần hỏi vấn đáp. Không dùng nộp báo cáo.

---

## Mở file nào đầu tiên khi demo?

Mở theo thứ tự này:

1. `apps/api/src/module/notification/channels/channel.interface.ts` — **Đây là Strategy interface. Mở cái này trước.**
2. `apps/api/src/module/notification/channels/email/email.channel.service.ts` — Concrete Strategy 1
3. `apps/api/src/module/notification/channels/push/push.channel.service.ts` — Concrete Strategy 2
4. `apps/api/src/module/notification/channels/in-app/in-app.channel.service.ts` — Concrete Strategy 3
5. `apps/api/src/module/notification/services/channel-dispatcher.service.ts` — **Context (quan trọng nhất khi giải thích)**

Nếu được hỏi về testing: mở thêm:
- `apps/api/src/module/notification/channels/email/noop-email.provider.ts`
- `apps/api/src/module/notification/channels/push/stub-push.provider.ts`

---

## Tóm tắt từng file quan trọng

### `channel.interface.ts`
- Định nghĩa `INotificationChannel` với method duy nhất: `deliver(notification, context): Promise<DeliveryResult>`
- Đây là **Strategy interface** — contract chung cho mọi kênh
- `DeliveryResult` có `success: boolean` và `errorCode?: string` (7 mã lỗi cụ thể)
- Lý do dùng `errorCode` thay vì throw: để kênh thất bại không làm dừng các kênh còn lại

### `email.channel.service.ts`
- `implements INotificationChannel`
- Inject `EmailTemplateService` (render HTML/text) và `IEmailProvider` (gửi thật)
- Nếu không có `context.email` → trả về `{ success: false, errorCode: 'NO_RECIPIENT_EMAIL' }`
- Nếu gửi lỗi → trả về `{ success: false, errorCode: 'SMTP_SEND_ERROR' }`
- **Bản thân nó cũng dùng nested Strategy** qua `IEmailProvider`

### `push.channel.service.ts`
- `implements INotificationChannel`
- Lấy device token từ `notification_preferences`
- Inject `IFCMProvider` — Firebase thật hoặc stub khi test
- Không có token → `'NO_ACTIVE_TOKENS'`
- FCM lỗi → `'FCM_SEND_ERROR'`

### `in-app.channel.service.ts`
- `implements INotificationChannel`
- Emit qua WebSocket Gateway đến đúng socket của user
- WebSocket throw → `'WS_EMIT_ERROR'`

### `channel-dispatcher.service.ts` (Context)
- Nhận `INotificationChannel[]` qua DI — **NestJS inject cả 3 channel vào đây**
- Gọi `deliver()` cho từng channel
- Ghi kết quả vào `notification_delivery_logs`
- Cập nhật trạng thái notification
- **Không có một dòng `if channel === 'email'` nào** → đây là bằng chứng đây là Strategy Pattern thật sự

---

## Tại sao đây là Strategy Pattern, không phải if-else?

Giải thích rõ khi bị hỏi:

- `ChannelDispatcherService` **không biết** kênh nào đang được gọi — nó chỉ gọi `channel.deliver()`
- Thứ tự thêm kênh mới: viết class mới → đăng ký module → xong. Không sửa `ChannelDispatcherService`
- Nếu là `if/else`, mỗi lần thêm kênh phải vào sửa `ChannelDispatcherService` — vi phạm Open/Closed
- NestJS inject array `INotificationChannel[]` theo token — đây là DI-based Strategy selection

---

## Cơ chế Dependency Injection hoạt động thế nào?

Trong `notification.module.ts`:
- `EmailChannelService`, `PushChannelService`, `InAppChannelService` được đăng ký là provider
- Tất cả đều implement `INotificationChannel`
- `ChannelDispatcherService` được inject một array các channel (thường dùng custom token hoặc `useFactory`)
- Đây là cách NestJS thực hiện Strategy: inject list strategies vào context

Cho email provider:
- `{ provide: EMAIL_PROVIDER, useClass: NodemailerEmailProvider }` trong production
- `{ provide: EMAIL_PROVIDER, useClass: NoopEmailProvider }` trong test/dev environment

---

## Câu hỏi khả năng cao từ giảng viên + trả lời nhanh

**Q: Làm sao hệ thống biết dùng kênh nào?**
> `ChannelDispatcherService` gọi TẤT CẢ các kênh đã được inject. Không "chọn" kênh — gửi đồng thời. Mỗi kênh tự quyết định có gửi được không dựa trên `DeliveryContext` (có email address không? có device token không?)

**Q: Nếu Email server down thì sao?**
> `EmailChannelService.deliver()` catch exception và trả về `{ success: false, errorCode: 'SMTP_SEND_ERROR' }`. `ChannelDispatcherService` ghi log lỗi, nhưng **vẫn tiếp tục** gọi Push và In-App. Người dùng vẫn nhận Push notification.

**Q: Đây có thực sự là Strategy Pattern không, hay chỉ là polymorphism bình thường?**
> Polymorphism là nền tảng, nhưng Strategy Pattern thêm 2 yếu tố: (1) **encapsulation of algorithms** — mỗi kênh gói gọn toàn bộ logic gửi của mình, (2) **runtime interchangeability** — có thể thêm/bỏ kênh mà không sửa context. Đây đúng là Strategy Pattern theo định nghĩa GoF.

**Q: Tại sao dùng `DeliveryResult` thay vì throw exception?**
> Vì nếu throw, một kênh lỗi sẽ làm hỏng toàn bộ dispatch loop. Với `DeliveryResult`, `ChannelDispatcherService` xử lý từng kênh độc lập — đây là **graceful degradation** được thiết kế có chủ đích.

**Q: Provider trong Email là pattern gì?**
> Cũng là Strategy Pattern, nhưng ở tầng thấp hơn — Strategy lồng trong Strategy (nested Strategy). `EmailChannelService` phụ thuộc vào `IEmailProvider` thay vì `NodemailerEmailProvider` trực tiếp. Trong test, inject `NoopEmailProvider` để tránh gửi email thật.

**Q: Nếu muốn thêm kênh SMS, làm gì?**
> 1. Tạo `SmsChannelService implements INotificationChannel`
> 2. Viết method `deliver()` gọi SMS provider (Twilio, VIETTEL, v.v.)
> 3. Đăng ký trong `notification.module.ts`
> 4. Xong — `ChannelDispatcherService` tự động nhận kênh mới qua DI, **không cần sửa một dòng nào**

**Q: `DeliveryContext` có gì?**
> Chứa dữ liệu contextual cần cho channel mà không lưu trong notification row: `email` (string), device tokens, user preferences... Mỗi channel đọc field phù hợp với mình.

---

## Quick talking points khi trình bày

- "Interface `INotificationChannel` là Strategy contract — một method duy nhất `deliver()`"
- "Ba Concrete Strategy: Email, Push, In-App — mỗi cái encapsulate hoàn toàn logic gửi của mình"
- "Context `ChannelDispatcherService` không có một dòng `if/else` nào về loại kênh"
- "Nested Strategy trong Email và Push — tách provider khỏi channel service để test được"
- "Thêm kênh mới = thêm 1 class + đăng ký module. Zero changes to existing code"
- "Failure isolation: một kênh lỗi không ảnh hưởng kênh khác nhờ `DeliveryResult` pattern"

---

## Vị trí code nhanh khi demo

```
apps/api/src/module/notification/
├── channels/
│   ├── channel.interface.ts          ← MỞ ĐẦU TIÊN
│   ├── email/
│   │   ├── email.channel.service.ts  ← Concrete Strategy 1
│   │   ├── email-provider.interface.ts
│   │   ├── nodemailer-email.provider.ts
│   │   └── noop-email.provider.ts    ← Cho câu hỏi về testing
│   ├── push/
│   │   ├── push.channel.service.ts   ← Concrete Strategy 2
│   │   ├── push-provider.interface.ts
│   │   ├── firebase-push.provider.ts
│   │   └── stub-push.provider.ts
│   └── in-app/
│       └── in-app.channel.service.ts ← Concrete Strategy 3
└── services/
    └── channel-dispatcher.service.ts ← Context — MỞ SAU CÙNG để giải thích
```
