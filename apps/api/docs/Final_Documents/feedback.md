# DA1_report.md - Review Summary & Required Changes

## Tổng quan

Sau khi review phiên bản hiện tại của `DA1_report.md`, thống nhất rằng báo cáo hướng tới quy mô khoảng **100–120 trang** và là tài liệu chính để giảng viên đọc (không giả định giảng viên đã đọc BRD, SRS, ASR, ADD, ADR hay SAD).

Do đó báo cáo cần:

- Giữ tính nhất quán với toàn bộ tài liệu nguồn.
- Không copy-paste nguyên văn SRS/SAD.
- Không lược bỏ quá nhiều chi tiết kỹ thuật quan trọng.
- Tự đứng độc lập như một báo cáo hoàn chỉnh.

---

# 1. Chương 1 - Điều chỉnh mức độ chi tiết

## Hiện trạng

Một số phần đang viết quá giống SRS hoặc Technical Specification.

Ví dụ:

- payment states
- awaiting_ipn
- refund_pending
- idempotency key
- notification internal states

## Điều chỉnh

Không xóa các nội dung kỹ thuật.

Thay vào đó:

- Mô tả ở mức nghiệp vụ trước.
- Sau đó mới giới thiệu các khái niệm kỹ thuật liên quan.

Ví dụ:

### Không nên

```text
Payment gồm các trạng thái:
pending
awaiting_ipn
completed
refund_pending
```

### Nên

```text
Payment chịu trách nhiệm quản lý vòng đời giao dịch thanh toán của khách hàng.

Để đảm bảo tính toàn vẹn giao dịch, hệ thống quản lý nhiều trạng thái thanh toán khác nhau như pending, awaiting_ipn, completed và refund.
```

---

# 2. Chương 2 - AI Section

## Hiện trạng

Đang có cảm giác:

```text
Proposal_Multimodel.md
↓
copy
↓
report
```

## Điều chỉnh

Bổ sung phần dẫn nhập trước khi trình bày các mô hình.

Thêm mục:

### 2.2 Giới thiệu bài toán AI trong hệ thống

Nội dung:

- Pain Point hiện tại.
- Vì sao đánh giá chất lượng món ăn là bài toán khó.
- Vì sao chỉ dùng text là chưa đủ.
- Vì sao chỉ dùng ảnh là chưa đủ.
- Vì sao cần Multimodal AI.

Flow:

```text
Business Problem
↓
AI Problem
↓
Multimodal Solution
↓
ConvNeXt
↓
XLM-RoBERTa
↓
Fusion Layer
↓
XAI
↓
AI Agent
```

Mục tiêu:

Để người đọc hiểu:

```text
Tại sao cần AI
```

trước khi hiểu:

```text
AI dùng công nghệ gì
```

---

# 3. Chương 3.1 - Kiến trúc hệ thống

## Hiện trạng

Mô tả khá đầy đủ.

Tuy nhiên thiếu yếu tố quan trọng nhất:

```text
HÌNH KIẾN TRÚC
```

## Điều chỉnh

Phải chèn nguyên các hình từ:

```text
ADD_FoodDelivery.md
SAD_FoodDelivery.md
```

Không tự vẽ lại.

---

### 3.1.1 Logical View

Chèn:

- Hình Logical View

Sau đó giải thích:

- Bounded Contexts
- Quan hệ giữa các BC

---

### 3.1.2 Runtime View

Chèn:

- Hình Runtime View

Sau đó giải thích:

- Event Flow
- EventBus
- Runtime Interaction

---

### 3.1.3 Implementation View

Chèn:

- Hình Implementation View

Sau đó giải thích:

- Mapping giữa kiến trúc và source code

---

### 3.1.4 Data View

Chèn:

- Hình Data View

Sau đó giải thích:

- PostgreSQL
- Redis
- Cloudinary

---

### 3.1.5 Deployment View

Chèn:

- Hình Deployment View

Sau đó giải thích:

- React
- NestJS
- PostgreSQL
- Redis
- Render
- GHCR

---

# 4. Chương 3.3 - Thiết kế CSDL

## Hiện trạng

Đang thiên về trình bày một số bảng tiêu biểu.

## Điều chỉnh

Chuyển sang mô hình trình bày theo Bounded Context.

Lý do:

- Nhất quán với Modular Monolith.
- Nhất quán với ADD.
- Nhất quán với SAD.
- Thể hiện tư duy Domain-Driven Design.

---

## Cấu trúc mới

### 3.3.1 ERD tổng thể

- Chèn ERD tổng thể.
- Mô tả các nhóm thực thể chính.

---

### 3.3.2 Auth BC Data Model

Trình bày toàn bộ bảng thuộc Auth BC.

Ví dụ:

- users
- sessions
- accounts
- verifications
- ...

Mỗi bảng gồm:

- Mục đích
- Các thuộc tính chính
- Quan hệ

---

### 3.3.3 Restaurant Catalog BC Data Model

Toàn bộ bảng liên quan:

- restaurants
- cuisines
- menu_categories
- menu_items
- modifier_groups
- modifier_options
- delivery_zones
- ...

---

### 3.3.4 Ordering BC Data Model

Toàn bộ bảng liên quan:

- carts
- cart_items
- orders
- order_items
- order_status_history
- ...

---

### 3.3.5 Payment BC Data Model

Toàn bộ bảng liên quan:

- payment_transactions
- refunds
- ...

---

### 3.3.6 Promotion BC Data Model

Toàn bộ bảng liên quan:

- promotions
- coupons
- coupon_redemptions
- ...

---

### 3.3.7 Notification BC Data Model

Toàn bộ bảng liên quan:

- notifications
- notification_preferences
- device_tokens
- ...

---

### 3.3.8 Review BC Data Model

Toàn bộ bảng liên quan:

- reviews
- review_images
- ...

---

## Cách trình bày mỗi BC

### Mô tả BC

Giải thích trách nhiệm nghiệp vụ.

### Danh sách bảng

Liệt kê toàn bộ bảng.

### Data Dictionary

Trình bày các cột quan trọng.

### Quan hệ

Mô tả relationship.

### Ý nghĩa nghiệp vụ

Giải thích vai trò của từng bảng trong hệ thống.

---

# 5. Những phần giữ nguyên

Các nội dung sau được đánh giá ổn và không cần thay đổi lớn:

## Chương 1

- Structure hiện tại.
- Mapping tài liệu nguồn.

## Chương 2.1

- TypeScript
- NestJS
- React
- React Native
- PostgreSQL
- Redis
- Drizzle ORM
- Better Auth
- Cloudinary
- FCM
- VNPay

Format:

```text
Giới thiệu

Ưu điểm

Nhược điểm

Lý do lựa chọn
```

giữ nguyên.

---

## Chương 3.2

Tiếp tục sử dụng:

```text
USE_CASE_SPECIFICATION.md
```

làm nguồn duy nhất.

Giữ nguyên cấu trúc:

```text
UC-DOM-01
...
UC-DOM-12
```

Không chuyển thành 35 Use Cases nhỏ.

---

## Chương 4

Giữ nguyên cấu trúc hiện tại.

Chỉ cần bổ sung nếu review phát hiện thiếu nội dung hoặc thiếu hình ảnh minh họa.

---

# Kết quả mong muốn sau khi chỉnh sửa

Phiên bản mới của `DA1_report.md` cần đạt:

- 100–120 trang.
- Có đầy đủ hình kiến trúc.
- Có ERD tổng thể.
- Có Database Design theo từng Bounded Context.
- Có phần dẫn nhập AI rõ ràng.
- Giữ nhất quán tuyệt đối với:
  - Vision
  - BRD
  - Business Rules
  - SRS
  - Utility Tree
  - ASR
  - ADD
  - ADR
  - SAD
  - Proposal_Multimodel

- Không trở thành bản copy của SRS/SAD.
- Có thể được đọc độc lập mà không cần mở các tài liệu khác.
