# ROLE

Bạn là một Principal Software Architect, Principal Software Engineer, Principal Business Analyst và Technical Reviewer.

Bạn có kinh nghiệm xây dựng:

- Enterprise Software Architecture
- BRD
- SRS
- ASR
- ADD
- ADR
- SAD
- Graduation Thesis Report
- Capstone Project Report

Ngoài vai trò viết báo cáo, bạn còn chịu trách nhiệm review chất lượng tài liệu ở góc độ kiến trúc phần mềm và báo cáo học thuật.

---

# GOAL

Đọc lại toàn bộ codebase, toàn bộ tài liệu dự án và file báo cáo hiện tại để hiểu đầy đủ context hệ thống.

Sau đó cập nhật trực tiếp:

```text
@DA1_report.md
```

theo đúng các feedback mới nhất.

KHÔNG tạo file mới.

KHÔNG viết tài liệu bổ sung.

CHỈ chỉnh sửa trực tiếp:

```text
@DA1_report.md
```

---

# MANDATORY READING PHASE

Trước khi chỉnh sửa báo cáo phải đọc lại toàn bộ các nguồn sau.

## 1. Báo cáo hiện tại

```text
@DA1_report.md
```

Mục tiêu:

- Hiểu cấu trúc hiện tại.
- Xác định những phần đã tốt.
- Xác định những phần cần chỉnh sửa.

---

## 2. Template báo cáo

```text
@NoiDung Bao Cao Đồ án 1,2.md
```

Mục tiêu:

- Đảm bảo báo cáo không lệch yêu cầu môn học.

---

## 3. Tài liệu nghiệp vụ

```text
@Food_Delivery_Vision_and_Scope.md

@BRD.md

@Business_Rules.md
```

---

## 4. Tài liệu yêu cầu

```text
@SRS_FoodDelivery.md

@USE_CASE_SPECIFICATION.md

@User_Stories_and_Acceptance_Criteria.md
```

---

## 5. Tài liệu mô hình hóa

```text
@SRS_SequenceDiagrams.md
```

---

## 6. Tài liệu chất lượng

```text
@Utility_Tree.md

@14 Quality Attribute.md

```

---

## 7. Tài liệu kiến trúc

```text
@ASR_FoodDelivery.md

@ADD_FoodDelivery.md

@ADR_FoodDelivery.md

@SAD_FoodDelivery.md

@CD_GUIDE.md
```

---

## 8. Tài liệu AI

```text
@Proposal_Multimodel.md
```

---

## 9. Source Code Analysis (BẮT BUỘC)

Không được bỏ qua.

Phải duyệt toàn bộ repository.

Phân tích:

### Architecture

- Modules
- Bounded Contexts
- Layers
- Dependencies

### Database

- Schema
- Entities
- Migrations
- Relationships

### API

- Controllers
- Services
- Endpoints

### Runtime Components

- EventBus
- Redis
- ACL
- Payment
- Notification

### Testing

- Unit Tests
- Integration Tests
- E2E Tests

### Observability

- OpenTelemetry
- Logging
- Metrics
- Monitoring

### DevOps

- Docker
- GitHub Actions
- GHCR
- Terraform

### Folder Structure

### UI hiện có

---

# TASK 1 — EXPAND ARCHITECTURAL DECISIONS

Mở rộng:

```text
3.1.6 Architectural Decisions
```

Hiện tại phần này còn quá ngắn.

---

Bao gồm:

```text
ADR-001 — Adopt Modular Monolith Architecture

ADR-002 — Use Database per BC Ownership

ADR-003 — Use In-process EventBus Communication

ADR-004 — Adopt ACL Snapshot Pattern

ADR-005 — Use Redis Runtime Layer

ADR-006 — Use Ports and Adapters Integration Pattern

ADR-007 — Adopt Drizzle Type-safe Persistence Layer
```

---

Giữ nguyên tinh thần của:

```text
@ADR_FoodDelivery.md
```

---

KHÔNG được chỉ viết:

```text
Decision

Rationale
```

---

Mỗi ADR phải có:

### Bối cảnh

### Các phương án được xem xét

Ví dụ:

```text
Candidate A

Candidate B

Candidate C
```

---

### So sánh và đánh đổi

Có bảng trade-off.

---

### Quyết định

---

### Lý do lựa chọn

---

### Tác động

---

Viết ngắn gọn hơn ADR gốc.

Mỗi ADR khoảng:

```text
0.5 - 1 trang
```

Mục tiêu:

Người đọc nhìn thấy:

```text
Problem

↓

Alternatives

↓

Trade-offs

↓

Decision

↓

Consequences
```

---

# TASK 2 — TÍCH HỢP AI VÀO KIẾN TRÚC HỆ THỐNG

Hiện tại phần AI đang có cảm giác là một đề tài riêng ghép vào hệ thống.

Cần chỉnh sửa để AI trở thành một phần của kiến trúc SoLi.

---

Bổ sung một subsection mới trong phần AI.

Ví dụ:

```text
2.2.x Tích hợp AI vào hệ thống SoLi
```

---

Phải giải thích rõ:

### AI nằm ở đâu trong hệ thống

### Module nào sử dụng AI

### Dữ liệu nào đi vào AI

### Kết quả AI được sử dụng ở đâu

### Vai trò của Review BC

### Vai trò của Dashboard

---

Bổ sung flow kiến trúc:

```text
Customer Review
↓
Review BC
↓
AI Quality Analysis Pipeline
↓
ConvNeXt
↓
XLM-RoBERTa
↓
Fusion Layer
↓
Explainable AI
↓
AI Agent
↓
Quality Report
↓
Restaurant Dashboard
```

---

Mục tiêu:

Người đọc hiểu rằng:

```text
AI là một phần mở rộng của hệ thống

không phải một đề tài AI tách rời
```

---

# TASK 3 — REFACTOR RUNTIME VIEW

Hiện tại Runtime View đang trình bày theo dạng:

```text
Diagram

Diagram

Diagram

Diagram

↓

Giải thích
```

Cách này giống tài liệu ADD.

Không phù hợp với báo cáo đồ án.

---

Refactor lại theo dạng:

```text
Diagram

↓

Giải thích

↓

Diagram

↓

Giải thích
```

---

Ví dụ:

### 3.1.2.1 Order Placement Runtime

(Hình)

Sau hình phải giải thích ngay:

- Mục tiêu
- Luồng xử lý
- Vai trò EventBus
- Vai trò Redis
- Vai trò Idempotency
- Kết luận

---

### 3.1.2.2 Event & ACL Synchronization Runtime

(Hình)

Sau hình phải giải thích ngay:

- Mục tiêu
- Vai trò ACL Snapshot
- Eventual Consistency
- Kết luận

---

### 3.1.2.3 Payment & Compensation Runtime

(Hình)

Sau hình phải giải thích ngay:

- Payment Success
- Payment Failure
- Compensation Flow
- Kết luận

---

### 3.1.2.4 Delivery & Review Runtime

(Hình)

Sau hình phải giải thích ngay:

- Delivery Lifecycle
- Review Eligibility
- Future AI Integration
- Kết luận

---

Mục tiêu:

Biến Runtime View từ:

```text
Architecture Document
```

thành:

```text
Capstone Report
```

---

# WRITING RULES

Không được viết:

```text
Theo ASR...

Theo ADR...

Theo ADD...

Theo BR-4...

Theo Utility Tree...

Source code xác nhận...
```

---

Không được viết như tài liệu traceability.

---

Phải viết như báo cáo học thuật độc lập.

---

# MANDATORY REVIEW PHASE

Sau khi cập nhật xong:

```text
@DA1_report.md
```

KHÔNG được kết thúc ngay.

Phải review tối thiểu 2 vòng.

---

## Review Pass 1 — ADR Review

Kiểm tra:

- Có đủ 7 ADR không.
- Có đủ Candidate không.
- Có đủ Trade-off không.
- Có đủ Decision không.
- Có đủ Consequences không.

Nếu thiếu:

Sửa ngay.

---

## Review Pass 2 — AI Integration Review

Kiểm tra:

- AI có còn bị tách khỏi hệ thống không.
- Đã mô tả rõ Review BC chưa.
- Đã mô tả rõ Dashboard chưa.
- Đã mô tả rõ AI Pipeline chưa.

Nếu chưa:

Sửa ngay.

---

## Review Pass 3 — Runtime View Review

Kiểm tra:

- Có phải mỗi diagram đều được giải thích ngay bên dưới không.
- Có phải Runtime View được trình bày theo luồng đọc tự nhiên không.
- Có còn tình trạng nhiều diagram liên tiếp rồi mới giải thích không.

Nếu có:

Refactor lại.

---

# OUTPUT

Chỉnh sửa trực tiếp:

```text
@DA1_report.md
```

Không tạo file mới.

Không xuất reasoning.

Không xuất checklist.

Không xuất review notes.

Chỉ giữ lại phiên bản cuối cùng của:

```text
@DA1_report.md
```

sau khi hoàn thành toàn bộ quá trình cập nhật và review.
