# ROLE

Bạn là một hội đồng review gồm:

- Principal Software Architect
- Principal Software Engineer
- Principal Technical Writer
- Principal Business Analyst
- Software Maintenance Expert
- Capstone Thesis Reviewer

Bạn có kinh nghiệm đánh giá:

- Capstone Project
- Graduation Thesis
- Software Engineering Report
- Architecture Documentation
- Software Maintenance Documentation
- Enterprise Software Design

Bạn đánh giá báo cáo dưới góc nhìn của:

- Giảng viên hướng dẫn
- Hội đồng phản biện
- Software Architect
- Senior Engineer

---

# GOAL

Thực hiện một đợt review toàn diện đối với:

```text
@DA1_report.md
```

và sửa trực tiếp file này cho đến khi đạt chất lượng của một báo cáo đồ án/capstone chuyên nghiệp.

Mục tiêu cuối cùng:

```text
@DA1_report.md
```

phải có chất lượng đủ tốt để:

- Nộp cho giảng viên.
- Dùng làm tài liệu bảo vệ đồ án.
- Được đọc độc lập mà không cần mở các tài liệu khác.
- Thể hiện được chiều sâu nghiệp vụ, kiến trúc, kỹ thuật và bảo trì phần mềm.

---

# CONTEXT

Hệ thống:

```text
SoLi Food Delivery Platform
```

được xây dựng theo:

```text
Modular Monolith Architecture
```

với các bounded context:

- Auth BC
- Restaurant Catalog BC
- Image BC
- Ordering BC
- Payment BC
- Promotion BC
- Notification BC
- Review BC
- Governance/Admin BC

---

Báo cáo hiện tại:

```text
DA1_report.md
```

đã trải qua nhiều vòng chỉnh sửa.

Tuy nhiên cần thực hiện một vòng audit cuối cùng trước khi nộp.

---

# MANDATORY READING PHASE

Trước khi review phải đọc lại toàn bộ:

## Current Report

```text
@DA1_report.md
```

---

## Business Documents

```text
@Food_Delivery_Vision_and_Scope.md

@BRD.md

@Business_Rules.md
```

---

## Requirements Documents

```text
@SRS_FoodDelivery.md

@USE_CASE_SPECIFICATION.md

@User_Stories_and_Acceptance_Criteria.md
```

---

## Architecture Documents

```text
@ASR_FoodDelivery.md

@Utility_Tree.md

@ADD_FoodDelivery.md

@ADR_FoodDelivery.md

@SAD_FoodDelivery.md

@CD_GUIDE.md
```

---

## AI Proposal

```text
@Proposal_Multimodel.md
```

---

## Design Pattern Audit

```text
@gof-design-pattern-audit-report.md
```

---

## Source Code

BẮT BUỘC đọc lại toàn bộ codebase.

Đây là source of truth cao nhất.

Nếu:

```text
@DA1_report.md
```

mâu thuẫn với codebase:

```text
Ưu tiên codebase
```

---

# REQUIREMENTS

## 1. Architecture Consistency Review

Kiểm tra:

### Logical View

- Có đúng với codebase không.
- Có đang copy ADD quá nhiều không.
- Có giải thích ở mức báo cáo hay không.

---

### Runtime View

Kiểm tra:

- Có đang giải thích lại từng mũi tên sequence diagram không.
- Có quá kỹ thuật không.
- Có phù hợp với người đọc báo cáo không.

Mỗi runtime packet nên tập trung vào:

```text
Mục tiêu

Các thành phần tham gia

Ý nghĩa kiến trúc

Giá trị nghiệp vụ
```

Không nên diễn giải từng bước implementation.

---

### Implementation View

Kiểm tra:

- Mapping kiến trúc ↔ source code.
- Có đúng module structure thực tế không.

---

### Data View

Kiểm tra:

- Có phản ánh đúng ownership của từng BC không.
- Có đúng database schema thực tế không.

---

### Deployment View

Kiểm tra:

- Có đúng hạ tầng hiện tại không.
- Có phản ánh Render, GHCR, Docker, PostgreSQL, Redis và Mobile App đúng không.

---

## 2. ADR Review

Kiểm tra các ADR:

```text
ADR-001

ADR-002

ADR-003

ADR-004

ADR-005

ADR-006

ADR-007
```

---

Mỗi ADR phải có:

- Context
- Alternatives
- Trade-offs
- Decision
- Rationale
- Consequences

---

Không được:

```text
Copy nguyên @ADR_FoodDelivery.md
```

---

Không được:

```text
Quá ngắn khiến mất ý nghĩa kiến trúc
```

---

Mục tiêu:

Giảng viên phải nhìn thấy:

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

## 3. Database Design Review

Đây là phần ưu tiên cao.

Kiểm tra:

```text
3.3 Database Design
```

---

Phải bảo đảm:

### 3.3.1 ERD tổng thể

Có đầy đủ.

---

### Auth BC Data Model

### Restaurant Catalog BC Data Model

### Ordering BC Data Model

### Payment BC Data Model

### Promotion BC Data Model

### Notification BC Data Model

### Review BC Data Model

---

Mỗi BC nên có:

```text
Mô tả BC

Danh sách bảng

Quan hệ

Data Dictionary

Ý nghĩa nghiệp vụ
```

---

Không được:

```text
Chỉ liệt kê bảng
```

---

Không được:

```text
Mô tả sơ sài
```

---

## 4. AI Section Review

Kiểm tra:

```text
2.2 AI Models
```

---

AI phải:

```text
Gắn với Review BC
```

---

Không được:

```text
Tách rời khỏi hệ thống
```

---

Kiểm tra:

```text
Business Problem

↓

AI Problem

↓

Multimodal Motivation

↓

ConvNeXt

↓

XLM-R

↓

Fusion

↓

XAI

↓

AI Agent

↓

Restaurant Dashboard
```

---

Đảm bảo:

AI được trình bày như một phần mở rộng của SoLi.

Không phải một đề tài AI độc lập.

---

## 5. Testing Review

Kiểm tra lại codebase.

---

Nếu tồn tại:

- Unit Tests
- Integration Tests
- E2E Tests

thì phải được phản ánh trong:

```text
4.3 Testing
```

---

Kiểm tra:

- Test Strategy
- Test Architecture
- Ví dụ test cases
- Công cụ sử dụng
- Kết quả kiểm thử

---

Không được:

```text
Chỉ mô tả lý thuyết testing
```

---

## 6. Observability Review

Kiểm tra:

```text
3.1.7 Observability & Operational Monitoring
```

---

Xác minh bằng codebase.

---

Kiểm tra:

- OpenTelemetry
- Structured Logging
- Grafana Faro
- PostHog
- Sentry

---

Không chỉ liệt kê công nghệ.

Phải giải thích:

```text
Thu thập gì

Dùng làm gì

Ai sử dụng dữ liệu đó

Mang lại lợi ích gì
```

---

## 7. Design Pattern Review

Đọc:

```text
gof-design-pattern-audit-report.md
```

---

Đối chiếu với source code.

---

Chỉ giữ các pattern:

có bằng chứng trong codebase.

---

Không được:

```text
Tự suy diễn pattern
```

---

Không được:

```text
Gắn pattern chỉ vì tên class giống
```

---

## 8. Technical Stack Review

Rà soát lại codebase.

---

Kiểm tra xem Chương 2 còn thiếu công nghệ nào không.

Ví dụ:

- OpenTelemetry
- Swagger
- Scalar
- PostHog
- Sentry
- Grafana Faro
- Docker
- GitHub Actions
- GHCR
- Terraform
- Jest
- Supertest
- Zod
- class-validator

hoặc các công nghệ khác đang tồn tại trong source code.

---

Nếu còn thiếu:

```text
Bổ sung vào Chương 2
```

---

## 9. Report Quality Review

Kiểm tra toàn bộ:

```text
DA1_report.md
```

---

Phát hiện:

- Nội dung trùng lặp.
- Nội dung quá giống SRS.
- Nội dung quá giống ADD.
- Nội dung quá giống ADR.
- Nội dung quá giống Proposal.

---

Mục tiêu:

```text
Báo cáo phải mang văn phong của một báo cáo đồ án.
```

---

Không phải:

```text
Bản ghép của nhiều tài liệu khác nhau.
```

---

## 10. Presentation & Formatting Review

Review format trình bày.

Kiểm tra:

### Heading hierarchy

Ví dụ:

```text
Chương

1.1

1.1.1

1.1.1.1
```

---

### Caption

Mọi hình phải có:

```text
Hình x.y
```

---

Mọi bảng phải có:

```text
Bảng x.y
```

---

### Consistency

Kiểm tra:

- Font style trong markdown.
- Table style.
- Bullet style.
- Numbering style.
- Caption style.

---

### Academic Writing

Chỉnh sửa các đoạn:

- Quá dài.
- Khó đọc.
- Mang tính kỹ thuật implementation quá mức.
- Thiếu tính học thuật.

---

# OPTIONAL IMPROVEMENT

Nếu phù hợp với codebase và tài liệu:

có thể bổ sung:

```text
3.1.10 Architectural Traceability Matrix
```

Ví dụ:

| Business Problem     | Architectural Solution |
| -------------------- | ---------------------- |
| Duplicate Checkout   | Idempotency Key        |
| Cross-BC Dependency  | ACL Snapshot           |
| Runtime State        | Redis                  |
| Payment Integration  | Ports & Adapters       |
| Provider Replacement | Strategy Pattern       |
| Future Scalability   | BC Separation          |

---

Chỉ bổ sung nếu thực sự nâng cao chất lượng báo cáo.

Không thêm cho đủ số lượng.

---

# CONSTRAINTS

Không tạo file mới.

Không xuất review notes.

Không xuất reasoning.

Không tạo report review riêng.

Không tạo TODO list.

Không tạo CHANGELOG.

---

Chỉ chỉnh sửa trực tiếp:

```text
@DA1_report.md
```

---

# QUALITY GATE

Sau khi hoàn thành phải tự review tối thiểu 5 vòng:

### Pass 1

Kiểm tra tính đúng đắn với source code.

### Pass 2

Kiểm tra tính nhất quán với tài liệu.

### Pass 3

Kiểm tra chất lượng kiến trúc.

### Pass 4

Kiểm tra chất lượng học thuật.

### Pass 5

Kiểm tra format trình bày.

---

Nếu vẫn còn vấn đề:

```text
Tiếp tục sửa trực tiếp DA1_report.md
```

cho đến khi không còn lỗi đáng kể.

---

# OUTPUT

Chỉ cập nhật:

```text
@DA1_report.md
```

Không tạo bất kỳ file nào khác.

Không in ra báo cáo review.

Không in ra danh sách lỗi.

Không giải thích.

Chỉ giữ lại phiên bản cuối cùng đã được review và tối ưu hóa hoàn chỉnh của:

```text
@DA1_report.md
```
