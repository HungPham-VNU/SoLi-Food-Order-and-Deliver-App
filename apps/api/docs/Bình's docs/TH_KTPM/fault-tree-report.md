# Báo Cáo Phân Tích Cây Lỗi (FTA) — Xử lý IPN VNPay

**Dự án:** SoLi Food Delivery — NestJS Backend
**Tính năng phân tích:** Xử lý IPN (Instant Payment Notification) từ VNPay
**Thuộc tính chất lượng:** Integrity (Tính toàn vẹn dữ liệu thanh toán)

---

## 1. Lựa chọn tính năng và thuộc tính chất lượng

### 1.1 Tính năng: Xử lý IPN VNPay

Khi khách hàng thanh toán qua VNPay, VNPay sẽ gọi về IPN endpoint của hệ thống để thông báo kết quả thanh toán. Handler xử lý yêu cầu này là `ProcessIpnHandler` trong file `apps/api/src/module/payment/commands/process-ipn.handler.ts`.

Đây là **con đường duy nhất** có thể thay đổi trạng thái `PaymentTransaction` sang `completed` hoặc `failed`, và kích hoạt các sự kiện ảnh hưởng trực tiếp đến đơn hàng. Nói cách khác, mọi lỗi ở đây đều là lỗi tài chính.

### 1.2 Thuộc tính chất lượng: Integrity (Tính toàn vẹn)

Integrity trong ngữ cảnh này có nghĩa là:

- **Không ghi nhận thanh toán giả:** Đơn hàng không được chuyển sang trạng thái `paid` nếu tiền thực sự chưa vào.
- **Không bỏ sót thanh toán thật:** Khách đã trả tiền nhưng đơn hàng vẫn bị hủy là sự cố nghiêm trọng.
- **Không ghi nhận hai lần:** Cùng một giao dịch không được xử lý hai lần do retry.

---

## 2. Sự kiện thất bại đỉnh (Top Failure Event)

> **TFE: Giao dịch thanh toán bị đưa vào trạng thái cuối không chính xác**

Tức là một trong các trường hợp sau xảy ra:
- Đơn hàng được đánh dấu `paid` mặc dù tiền chưa thực sự được nhận.
- Khách đã trả tiền nhưng đơn hàng vẫn bị hủy hoặc ở trạng thái `pending`.
- Cùng một IPN được xử lý hai lần, tạo ra sự kiện xác nhận thanh toán trùng lặp.

---

## 3. Các nhóm lỗi chính

*(Sơ đồ cây được vẽ riêng trong file ảnh đính kèm)*

### Nhóm E1 — False-credit (Ghi nhận thanh toán sai)

Hệ thống chấp nhận một IPN không hợp lệ và đánh dấu đơn hàng là đã thanh toán.

**Các nguyên nhân gốc rễ:**
- **E1.1 — Chấp nhận IPN giả mạo chữ ký:** Kẻ tấn công gửi IPN với chữ ký sai hoặc sử dụng timing oracle để đoán secret.
- **E1.2 — Không phát hiện số tiền bị thay đổi:** `vnp_Amount` trong IPN khác với số tiền đã lưu trong hệ thống.
- **E1.3 — Chấp nhận IPN với mã giao dịch không tồn tại:** `vnp_TxnRef` không khớp với bất kỳ `PaymentTransaction` nào trong DB.

### Nhóm E2 — Lost-credit (Bỏ mất thanh toán thật)

Khách đã trả tiền thật nhưng đơn hàng không được cập nhật đúng.

**Các nguyên nhân gốc rễ:**
- **E2.1 — IPN không đến được hệ thống:** Lỗi mạng VNPay-to-server, hoặc endpoint trả về 5xx khiến VNPay ngừng retry.
- **E2.2 — IPN đến nhưng bị từ chối do lỗi kỹ thuật:** Sai lệch encoding trong `buildHashData` so với chuẩn PHP của VNPay dẫn đến chữ ký không khớp.
- **E2.3 — Sự kiện `PaymentConfirmedEvent` được publish nhưng transition thất bại:** Handler phía Ordering BC ném exception, DB không khả dụng, hoặc đơn hàng đã bị auto-cancel bởi `OrderTimeoutTask` trước khi IPN đến.

### Nhóm E3 — Double-credit (Xử lý hai lần)

Cùng một IPN được xử lý thành công hai lần.

**Các nguyên nhân gốc rễ:**
- **E3.1 — Retry storm vượt qua idempotency check:** VNPay retry liên tục; hai request đến cùng lúc trước khi trạng thái kịp cập nhật.
- **E3.2 — Race condition trên nhiều pod:** Nhiều instance NestJS đang chạy song song, cả hai đọc `txn.version = N` và cùng thử UPDATE.

### Nhóm E4 — Compensation failure (Hoàn trả thất bại)

Sau khi đơn hàng bị hủy hoặc hoàn tiền, phần bù trừ khuyến mãi không được thực hiện.

**Các nguyên nhân gốc rễ:**
- `PromotionRollbackOnCancellationHandler` ném exception.
- Sự kiện hoàn tiền (`OrderCancelledAfterPaymentEvent`) bị mất trước khi handler xử lý.

---

## 4. Các biện pháp phòng vệ đã được triển khai

### 4.1 Xác thực chữ ký HMAC

File: `apps/api/src/module/payment/services/vnpay.service.ts`

- Chữ ký HMAC-SHA512 được kiểm tra **đầu tiên**, trước mọi thao tác DB.
- Sử dụng `crypto.timingSafeEqual` (Node.js built-in) thay vì so sánh string thông thường — ngăn timing oracle attack.
- Thêm kiểm tra độ dài trước `timingSafeEqual` để tránh crash khi buffer có kích thước khác nhau.
- Nếu chữ ký sai: trả về `RspCode: '97'` → VNPay tiếp tục retry.

### 4.2 Kiểm tra số tiền

File: `apps/api/src/module/payment/commands/process-ipn.handler.ts`

- So sánh `vnp_Amount / 100` với `txn.amount` đã lưu trong DB.
- Nếu không khớp: trả về `RspCode: '04'`.
- Ngăn trường hợp VNPay gửi sai số tiền hoặc số tiền bị thay đổi sau khi tạo giao dịch.

### 4.3 Idempotency cho trạng thái cuối

File: `apps/api/src/module/payment/commands/process-ipn.handler.ts`

- Nếu `PaymentTransaction` đã ở trạng thái cuối (`completed`, `failed`, `refund_pending`, `refunded`): trả về `RspCode: '00'` ngay lập tức mà không làm gì thêm.
- VNPay nhận `'00'` và dừng retry — đây là cơ chế idempotency chủ đích.
- Backstop ở tầng DB: column `provider_txn_id` có ràng buộc `UNIQUE` — ngay cả khi application-level check bị race, DB sẽ từ chối INSERT trùng.

### 4.4 Optimistic Locking

File: `apps/api/src/module/payment/repositories/payment-transaction.repository.ts`

- Column `version` (integer) trên bảng `payment_transactions`.
- Method `updateStatus(id, newStatus, version)` thực hiện `UPDATE ... WHERE id = ? AND version = ?`.
- Nếu không có row nào được cập nhật (pod khác đã cập nhật trước), method trả về `false`.
- Pod thua cuộc trả về `RspCode: '00'` (idempotent ack) mà không publish event.
- Đây là cơ chế chính ngăn double-credit trong môi trường multi-pod.

### 4.5 Reconciliation bằng Cron Task

File: `apps/api/src/module/payment/tasks/payment-timeout.task.ts`

- `@Cron(CronExpression.EVERY_MINUTE)` — chạy mỗi phút.
- Tìm các `PaymentTransaction` ở trạng thái `awaiting_ipn` đã quá hạn.
- Tự động chuyển sang `failed` và publish `PaymentFailedEvent`.
- Đây là lớp phòng vệ cuối cùng: dù IPN không bao giờ đến, hệ thống vẫn tự giải quyết.
- Sử dụng optimistic locking trong từng vòng lặp để safe trong multi-pod.

---

## 5. Tại sao FTA này mạnh cho bài thuyết trình?

### 5.1 Tính thực tế của bài toán

Thanh toán là phần nhạy cảm nhất trong hệ thống food delivery. Một lỗi duy nhất có thể dẫn đến:
- Khách hàng trả tiền nhưng không nhận được đơn hàng.
- Nhà hàng chuẩn bị món nhưng không nhận được tiền.
- Hệ thống xử lý hai lần làm mất cân bằng tài khoản.

Đây là những rủi ro có giá trị kinh tế thực sự — không phải lỗi kỹ thuật trừu tượng.

### 5.2 Tại sao cần nhiều lớp bảo vệ?

Một cơ chế duy nhất không đủ vì:
- HMAC ngăn giả mạo, nhưng không ngăn được lỗi mạng hoặc race condition.
- Idempotency check ngăn double-credit đơn giản, nhưng race condition cần optimistic locking.
- Optimistic locking giải quyết race condition, nhưng không phục hồi khi IPN không đến.
- Cron task phục hồi khi IPN không đến, nhưng cần optimistic locking để safe trên nhiều pod.

**Mỗi lớp bảo vệ giải quyết một lớp lỗi khác nhau** — không có sự dư thừa, không có khoảng trống không được che phủ (trong phạm vi Phase 1).

### 5.3 Điểm yếu còn tồn tại (được nhận biết)

- Sự kiện `PaymentConfirmedEvent` và `PaymentFailedEvent` được publish in-process — nếu NestJS crash sau khi DB commit nhưng trước khi publish, sự kiện bị mất. Phase 2 sẽ cần Transactional Outbox Pattern để giải quyết.
- `PromotionRollbackOnCancellationHandler` hiện tại chỉ swallow exception — nếu rollback thất bại, cần manual reconciliation.

---

## 6. Kết luận

Tính năng xử lý IPN VNPay là lựa chọn phù hợp nhất để phân tích FTA trong hệ thống SoLi Food Delivery, vì:

1. **Convergence of failure types** — một tính năng nhỏ nhưng hội tụ đủ các loại lỗi: bảo mật, concurrency, integration, compensation.
2. **Codebase đã implement mitigation thực tế** cho mọi leaf event trong cây lỗi — không phải phân tích lý thuyết.
3. **Integrity là thuộc tính chất lượng không thể thỏa hiệp** trong hệ thống thương mại điện tử — dễ giải thích tầm quan trọng với người nghe không chuyên kỹ thuật.
4. **Defence-in-depth** được thể hiện rõ ràng: HMAC → idempotency → amount check → optimistic lock → DB constraint → cron reconciler — sáu lớp bảo vệ độc lập, mỗi lớp giải quyết một vector tấn công hoặc failure mode riêng biệt.
