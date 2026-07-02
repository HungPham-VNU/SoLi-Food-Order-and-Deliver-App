# UITFood / SoLi — Câu Hỏi Bảo Vệ & Đáp Án Ăn Điểm

> Tài liệu tổng hợp các câu hỏi **có khả năng cao** giảng viên sẽ hỏi khi bảo vệ đồ án SE361, kèm đáp án ngắn gọn nhưng đủ sâu để "ăn điểm" — nghĩa là không chỉ trả lời đúng, mà còn **thể hiện bạn hiểu đánh đổi (trade-off)**, chứ không phải học thuộc lòng khái niệm.
>
> Đi cùng [`HUONG_DAN_KIEN_TRUC_MICROSERVICE.md`](./HUONG_DAN_KIEN_TRUC_MICROSERVICE.md) — nếu câu trả lời ở đây chưa đủ, tài liệu đó giải thích sâu hơn.

## Mẹo trả lời chung (đọc trước khi vào phòng bảo vệ)

1. **Luôn trả lời theo cấu trúc: Vấn đề → Giải pháp → Đánh đổi.** Giảng viên không chỉ muốn nghe "chúng em dùng Saga Pattern", mà muốn nghe "vì sao không dùng 2PC, và cái giá phải trả khi chọn Saga là gì".
2. **Luôn có ví dụ cụ thể từ chính hệ thống**, không nói chung chung. Ví dụ: đừng nói "chúng em dùng event", hãy nói "khi Ordering commit đơn hàng, nó ghi kèm event `order.placed.v1` vào bảng `outbox_events` trong cùng transaction".
3. **Không giấu hạn chế.** Nếu bị hỏi về phần chưa hoàn thiện (rate limiting, alerting, test client-side...), thừa nhận thẳng và nói nó nằm trong roadmap — giảng viên đánh giá cao sự trung thực hơn là che giấu rồi bị lộ khi hỏi sâu.
4. **Nếu không chắc câu trả lời**, đừng bịa — nói "phần này chúng em chưa triển khai, hướng đi dự kiến là..." vẫn ăn điểm hơn trả lời sai.

---

## A. Tổng quan & Động lực kiến trúc

### A1. Vì sao chọn microservice thay vì tiếp tục dùng monolith?

Không phải vì xu hướng, mà vì bốn lý do cụ thể đã bắt đầu gây khó chịu ở monolith: (1) **triển khai độc lập** — sửa Payment không cần deploy lại cả hệ thống; (2) **cô lập lỗi** — Promotion hay Reporting sập không kéo sập checkout; (3) **scale riêng phần** — Catalog/Ordering là đường nóng, có thể tăng instance riêng; (4) **ranh giới dữ liệu rõ ràng** — mỗi context sở hữu database của mình, tránh coupling ngầm qua bảng dùng chung.

Đổi lại, cái giá là hệ thống phức tạp hơn: cần message broker, cần quản lý 9 database thay vì 1, và mất đi transaction đơn giản xuyên module — phải thay bằng Saga. **Chúng em không tách microservice để "cho oai"** — bằng chứng là chúng em bắt đầu từ modular monolith trước, chỉ tách khi ranh giới bounded context đã ổn định.

### A2. Vì sao không viết lại từ đầu (rewrite) mà lại di trú dần?

Vì rewrite toàn bộ là rủi ro cao nhất trong kỹ thuật phần mềm — hệ thống cũ phải đóng băng tính năng trong khi hệ thống mới chưa chạy được, và thường mất nhiều thời gian hơn dự kiến rất nhiều lần. Chúng em dùng **Strangler Fig pattern**: bóc từng bounded context ra khỏi monolith, đứng sau cờ cấu hình `*_ROUTES_ENABLED` ở gateway. Cờ tắt → gateway proxy sang monolith cũ; cờ bật → gateway gọi sang microservice mới. Nhờ vậy **tại mọi thời điểm hệ thống vẫn release được**, không có "ngày dừng hệ thống để chuyển đổi", và nếu service mới có bug nghiêm trọng, tắt cờ là quay lại monolith ngay lập tức — một cơ chế rollback gần như miễn phí.

### A3. Vì sao bắt đầu từ modular monolith thay vì thiết kế microservice ngay từ đầu?

Đây thực ra là điểm chúng em tự tin nhất khi bảo vệ: **kỷ luật thiết kế hệ thống phân tán phải có TRƯỚC khi tách process, không phải sau**. Modular monolith buộc chúng em định nghĩa ranh giới bounded context, port/interface, domain event rõ ràng ngay từ đầu — trong khi mọi thứ vẫn chạy trong 1 process nên sai ở đâu sửa ngay được, chi phí thử-sai thấp. Khi ranh giới đã đúng, việc tách ra microservice chỉ là **thay một lời gọi hàm trong process bằng một lời gọi TCP** — logic domain không đổi. Nếu thiết kế microservice ngay từ đầu mà chưa hiểu rõ domain, rủi ro chia sai ranh giới (quá vụn hoặc quá gộp) là rất cao và tốn kém để sửa sau này.

### A4. Hệ thống có bao nhiêu service, chia theo tiêu chí gì?

9 service, chia theo **bounded context** (không phải theo tầng kỹ thuật, không phải "mỗi bảng 1 service"): Identity, Media, Notification, Catalog, Promotion, Payment, Review, Ordering, Reporting — cộng với Edge Gateway là cửa ngõ duy nhất. Tiêu chí chia là **sự cố kết nghiệp vụ (business cohesion)** theo DDD — ví dụ cart, order, lifecycle, order-history, ACL snapshot đều nằm trong Ordering vì chúng cùng một câu chuyện nghiệp vụ, dù về mặt bảng dữ liệu có thể tách nhỏ hơn nữa.

---

## B. DDD & Bounded Context

### B1. Bounded Context là gì, và làm sao xác định ranh giới đúng?

Bounded Context là một vùng trong hệ thống có **mô hình dữ liệu và ngôn ngữ riêng (ubiquitous language)** — cùng một từ ở hai context có thể mang nghĩa khác nhau. Ví dụ kinh điển trong hệ thống: từ "Restaurant" — ở Catalog nó là entity đầy đủ (menu, giờ mở cửa, trạng thái duyệt); ở Ordering nó chỉ là snapshot rút gọn (tên, id, đang hoạt động hay không) đủ để tính giá; ở Reporting nó chỉ còn là 1 dòng trong bảng GMV.

Cách xác định ranh giới: chúng em dựa vào **ai là người thay đổi dữ liệu này, và vì lý do gì** — nếu Catalog team đổi schema restaurant vì lý do vận hành nhà hàng, mà Ordering không cần biết chi tiết đó, thì đó là dấu hiệu ranh giới đúng. Ranh giới sai thường lộ ra qua triệu chứng: 2 service liên tục phải đổi cùng lúc mỗi khi có 1 thay đổi nghiệp vụ.

### B2. Anti-Corruption Layer (ACL) dùng để làm gì, tại sao không gọi thẳng service khác mỗi khi cần dữ liệu?

Nếu Ordering gọi thẳng Catalog mỗi lần cần dữ liệu nhà hàng, thì (1) checkout phụ thuộc runtime vào Catalog — Catalog sập là checkout sập theo; (2) mô hình dữ liệu của Ordering bị "nhiễm" bởi mô hình của Catalog. Giải pháp: Ordering giữ **snapshot cục bộ**, đồng bộ qua event `catalog.restaurant.changed.v1`, lưu trong chính database của nó (`ordering_*_snapshots`). Checkout tính giá **hoàn toàn từ snapshot cục bộ** — nên nếu Catalog sập đúng lúc khách bấm đặt hàng, checkout vẫn chạy bình thường. Đánh đổi: dữ liệu có độ trễ đồng bộ (eventual consistency) — nếu chủ nhà hàng vừa đổi giá 1 giây trước, đơn hàng có thể dùng giá cũ trong khoảnh khắc rất ngắn đó. Đây là đánh đổi có chủ đích, chấp nhận được vì độ trễ nhỏ hơn nhiều so với rủi ro checkout phụ thuộc runtime vào service khác.

### B3. Có Event Sourcing trong hệ thống không?

**Không, và đây là lựa chọn có chủ đích.** Mỗi service lưu **trạng thái hiện tại** (current state) trong bảng Drizzle, và **phát ra** event khi trạng thái thay đổi — chứ không tái tạo trạng thái bằng cách replay toàn bộ lịch sử event. ACL snapshot và Reporting fact table là **projection**, không phải event store. Lý do: Event Sourcing thêm độ phức tạp đáng kể (snapshot, versioning, replay) mà domain của một hệ thống đặt đồ ăn không thực sự cần — chúng em không cần "xem lại trạng thái hệ thống tại bất kỳ thời điểm nào trong quá khứ" như domain tài chính/ngân hàng. Áp dụng Event Sourcing ở đây sẽ là **over-engineering**.

---

## C. Giao tiếp giữa các service

### C1. Hệ thống có mấy kiểu giao tiếp giữa các service, khi nào dùng kiểu nào?

Đúng hai kiểu, có chủ đích không lai tạp: **TCP RPC đồng bộ** (`@MessagePattern`/`ClientProxy` của NestJS) khi người gọi cần câu trả lời ngay và nó ảnh hưởng đến request hiện tại — ví dụ Ordering hỏi Promotion "mã này giảm bao nhiêu tiền" lúc checkout. **RabbitMQ event bất đồng bộ** khi chỉ cần loan báo một sự thật đã xảy ra mà không ai phải chờ — ví dụ "đơn hàng vừa được đặt" để Notification và Reporting phản ứng độc lập. Quy tắc quyết định: nếu kết quả cuộc gọi làm thay đổi response hiện tại → RPC; nếu chỉ là "báo tin rồi ai xử lý lúc nào cũng được" → event.

### C2. Vì sao dùng TCP RPC của NestJS thay vì REST hoặc gRPC giữa các service?

TCP transport là tính năng có sẵn của `@nestjs/microservices`, tích hợp liền mạch với hệ sinh thái NestJS đang dùng (decorator, DI, pipe validate) mà không cần thêm toolchain riêng (như Protobuf cho gRPC). Kết hợp với package `@uitfood/contracts` dùng Zod để định nghĩa và validate request/response, chúng em có được **an toàn kiểu tại compile-time** giữa các service mà không cần một schema registry riêng biệt. So với REST nội bộ, TCP tránh được overhead của HTTP (header, JSON serialize/deserialize qua text) cho giao tiếp nội bộ tần suất cao. Đánh đổi: TCP RPC của Nest kém "chuẩn hóa liên ngôn ngữ" hơn gRPC — nếu sau này có service viết bằng ngôn ngữ khác Node.js, sẽ cần đánh giá lại lựa chọn này.

### C3. Contract giữa các service được quản lý ra sao để tránh "vỡ hợp đồng" (breaking change)?

Toàn bộ RPC pattern, request/response schema, và event payload được định nghĩa **một lần duy nhất** trong package dùng chung `packages/contracts` (`@uitfood/contracts`), dùng Zod để vừa validate runtime vừa suy ra type TypeScript. Vì mọi service import cùng 1 package này, một thay đổi phá vỡ hợp đồng (breaking change) sẽ gây **lỗi biên dịch (compile-time error)** ở tất cả các service bị ảnh hưởng — phát hiện ngay lúc code, không phải lúc chạy production. Event còn được version hóa rõ ràng trong tên (`order.placed.v1`) để có thể phát hành `v2` song song mà không phá consumer cũ.

### C4. Bảo mật giữa các service như thế nào? Service có tin request từ Gateway không?

**Không tin mù quáng.** Gateway xác thực session người dùng qua Better Auth, sau đó **tự phát hành một JWT nội bộ sống rất ngắn (60 giây)**, gắn `audience` là service đích (`aud=catalog`). Mỗi service khi nhận request phải tự verify chữ ký, verify audience/issuer, và **tự kiểm tra lại quyền/role** — không tin bất kỳ header thô nào. Khi service gọi service khác (Ordering → Payment), dùng token dạng `service:*`. Đây là mô hình **zero-trust nội bộ**: TTL ngắn giới hạn thiệt hại nếu token bị rò rỉ, và việc mỗi service tự re-check quyền tránh việc một service bị compromise có thể giả mạo quyền hạn cao hơn.

---

## D. Saga Pattern & Distributed Transaction

### D1. Vì sao không dùng transaction database bình thường cho việc đặt hàng?

Vì đặt hàng chạm vào **ba database khác nhau** thuộc ba service khác nhau — Ordering, Promotion, Payment — và không có cơ chế transaction nào của PostgreSQL có thể "xuyên" qua ba database độc lập, thuộc ba service độc lập, cùng lúc. Đây là hệ quả trực tiếp của việc chọn database-per-service. Câu trả lời chuẩn cho vấn đề này trong kiến trúc phân tán là **Saga Pattern**.

### D2. Dự án dùng Saga kiểu Orchestration hay Choreography? Vì sao?

**Orchestration** — Ordering đóng vai trò nhạc trưởng (orchestrator), chủ động gọi tuần tự Promotion rồi Payment rồi tự commit, và tự quyết định khi nào cần bù trừ (compensate). Chúng em chọn Orchestration thay vì Choreography (các service tự phản ứng dây chuyền qua event, không ai điều phối) vì: (1) luồng checkout có **thứ tự bắt buộc rõ ràng** (phải giữ khuyến mãi trước khi tạo payment, phải có payment trước khi commit nếu là VNPay) — Orchestration thể hiện thứ tự này tường minh trong một file; (2) dễ audit và debug hơn — toàn bộ logic điều phối nằm ở một chỗ (`place-order.handler.ts`) thay vì rải rác qua nhiều event handler ở nhiều service, dễ mất dấu "ai gây ra lỗi" khi luồng dài. Đánh đổi: Ordering trở thành điểm phụ thuộc trung tâm của luồng checkout — nếu Ordering có bug điều phối, ảnh hưởng lớn hơn.

### D3. Nếu một bước trong saga thất bại giữa chừng thì hệ thống xử lý ra sao? Cho ví dụ cụ thể.

Mỗi bước có side-effect đều có một bước bù trừ tương ứng:
- Nếu **Promotion sập hoặc không giữ được chỗ**: không coi là lỗi — checkout tiếp tục **không có giảm giá** (non-blocking có chủ đích, một dạng graceful degradation nhẹ).
- Nếu **tạo payment attempt thất bại** (chỉ áp dụng khi chọn VNPay): bù trừ bằng cách gọi Promotion **rollback reservation**, trả lỗi 503 cho khách để họ thử lại.
- Nếu **bước commit đơn hàng vào database thất bại**: bù trừ cả hai bước trước — đánh dấu payment attempt là `failed`, và rollback reservation ở Promotion.

Tất cả các bước bù trừ đều **fire-and-forget và idempotent** — gọi rollback hai lần cũng an toàn như một lần, và Ordering không chờ compensation chạy xong mới trả lỗi cho client, tránh làm chậm phản hồi.

### D4. Saga đảm bảo tính nhất quán như thế nào nếu không có ACID xuyên service?

Saga chấp nhận **eventual consistency** thay vì strong consistency: tại một thời điểm rất ngắn giữa các bước, hệ thống có thể ở trạng thái trung gian (ví dụ đã giữ khuyến mãi nhưng chưa tạo order) — nhưng **không bao giờ ở trạng thái sai vĩnh viễn**, vì luôn có đường bù trừ dẫn về trạng thái nhất quán. Điểm mấu chốt giữ cho việc này an toàn: bước commit cuối cùng (tạo order) và việc phát sự kiện `order.placed` được ghi trong **một transaction PostgreSQL duy nhất** ở phía Ordering (transactional outbox) — nên riêng bước đó vẫn có ACID cục bộ, chỉ có phần "nhất quán giữa các service" là eventual.

### D5. Kết quả thanh toán thật sự (khách đã trả tiền chưa) được xử lý ở đâu trong saga?

Đây là điểm hay bị hỏi xoáy: **saga đồng bộ ở trên KHÔNG bao gồm việc thanh toán thật sự thành công hay không** — nó chỉ tạo ra một "payment attempt" và trả về URL thanh toán. Việc khách có trả tiền hay không đến **sau đó, hoàn toàn bất đồng bộ**, qua callback IPN của VNPay: VNPay gọi vào Payment → Payment verify chữ ký HMAC-SHA512 và số tiền → Payment phát event `payment.confirmed.v1` hoặc `payment.failed.v1` → Ordering lắng nghe và chuyển trạng thái đơn từ `PENDING` sang `PAID`/`CANCELLED`. Tách rời hai giai đoạn này là bắt buộc về mặt kỹ thuật, vì bản chất thanh toán online luôn là bất đồng bộ — hệ thống không thể "chờ" khách hàng nhập thẻ trên trang VNPay trong cùng 1 request HTTP.

---

## E. Data Ownership, Outbox/Inbox & Idempotency

### E1. Vì sao mỗi service có database riêng thay vì dùng chung 1 database với schema riêng?

Dùng chung 1 database instance nhưng schema riêng vẫn tạo ra **coupling ngầm nguy hiểm**: rất dễ có người "tiện tay" JOIN xuyên schema, hoặc một migration ảnh hưởng đến toàn bộ instance khiến mọi service cùng downtime. Database-per-service (ở đây là database riêng biệt **và login role riêng biệt** cho từng service) buộc ranh giới phải tường minh ở tầng hạ tầng, không chỉ ở quy ước code — service vật lý **không có quyền** kết nối vào database của service khác, nên không có cách nào lỡ tay phá vỡ ranh giới.

### E2. Outbox/Inbox pattern giải quyết vấn đề gì? Nếu không có nó thì sao?

Vấn đề gọi là **dual-write problem**: nếu Ordering ghi order vào database rồi mới publish event lên RabbitMQ bằng hai thao tác tách rời, sẽ có trường hợp ghi database thành công nhưng publish event thất bại (crash giữa hai bước, mất mạng...) — dẫn đến order tồn tại nhưng Notification/Reporting không bao giờ biết. **Transactional Outbox** giải quyết bằng cách ghi business data và event **trong cùng một transaction database** — hoặc cả hai cùng thành công, hoặc cả hai cùng rollback, không bao giờ lệch nhau. Một relay nền quét bảng outbox rồi mới publish thật sự lên RabbitMQ.

Ở chiều nhận, **Inbox pattern** giải quyết vấn đề message có thể bị gửi lại (RabbitMQ redeliver khi consumer chưa kịp ack, network retry...): consumer ghi `(consumer, eventId)` vào bảng inbox với ràng buộc unique trước khi áp dụng thay đổi — event trùng bị chặn ngay ở bước ghi, không áp dụng hai lần.

### E3. Idempotency được đảm bảo cụ thể ở đâu trong hệ thống, cho ví dụ?

Hai ví dụ cụ thể:
- **Đặt hàng (checkout)**: dùng idempotency key lưu ở Redis — nếu client retry cùng một request checkout (do timeout mạng, do double-click), server trả về **cùng một order đã tạo trước đó** thay vì tạo order mới; ngoài ra còn có ràng buộc unique ở tầng database (`orders.cart_id`) làm lớp phòng thủ cuối cùng nếu Redis vì lý do gì đó không chặn được.
- **IPN callback của VNPay**: trước khi áp dụng thay đổi trạng thái, Payment kiểm tra transaction đã ở trạng thái cuối (terminal state) chưa — nếu VNPay gọi lại IPN nhiều lần cho cùng một giao dịch, lần xử lý đầu tiên thắng, các lần sau bị bỏ qua an toàn.

---

## F. Độ tin cậy & Khả năng chịu lỗi

### F1. Nếu RabbitMQ sập thì hệ thống có sập theo không?

**Không, và đây là điểm thiết kế có chủ đích.** Luồng checkout đồng bộ (RPC) hoàn toàn không phụ thuộc vào RabbitMQ — khách hàng vẫn đặt được hàng bình thường. Cái bị ảnh hưởng là các tác vụ bất đồng bộ: notification chưa gửi được, snapshot ACL và fact table Reporting chưa cập nhật. Vì dùng **transactional outbox**, các event vẫn nằm an toàn trong bảng `outbox_events` của từng service — khi RabbitMQ hoạt động lại, relay tiếp tục publish, hệ thống tự "bắt kịp" (catch up) mà không mất dữ liệu.

### F2. Nếu Catalog service sập thì checkout có sập theo không?

Không — nhờ ACL snapshot (xem mục B2). Checkout đọc từ snapshot cục bộ trong database của Ordering, không gọi Catalog runtime. Đây là minh chứng cụ thể cho lợi ích "cô lập lỗi" (fault isolation) mà microservice hứa hẹn — chứ không chỉ là lý thuyết suông.

### F3. Hệ thống có circuit breaker không?

Chưa có circuit breaker theo đúng nghĩa (kiểu thư viện như Opossum hay resilience4j), nhưng có hai cơ chế đóng vai trò tương tự ở quy mô nhỏ: **timeout bắt buộc trên mọi RPC call** (không bao giờ chờ vô hạn), và **graceful degradation có chủ đích** ở Promotion (không giữ được khuyến mãi thì bỏ qua thay vì fail cả checkout). Đây là hạn chế thành thật: circuit breaker đầy đủ (theo dõi tỷ lệ lỗi, tự động "mở mạch" khi 1 service liên tục lỗi) chưa được triển khai và nằm trong hướng phát triển tiếp theo.

---

## G. Kiểm thử & CI/CD

### G1. Vì sao test theo "risk-driven" thay vì cố gắng phủ 100% coverage?

Vì phủ toàn bộ với ROI thấp — có những đoạn code (ví dụ CRUD đơn giản, một số controller) rủi ro thấp và được exercise qua E2E rồi. Chúng em ưu tiên viết test kỹ nhất cho những luồng **hỏng thì thiệt hại lớn nhất**: checkout, thanh toán VNPay (IPN, chữ ký, idempotency), vòng đời đơn hàng, khuyến mãi, notification. Kết quả cụ thể: 504 unit test qua 33 suite, cộng bộ E2E test cho các luồng nghiệp vụ chính. Đây là lựa chọn có ý thức về đánh đổi thời gian/lợi ích, không phải vì lười.

### G2. CI/CD hoạt động ra sao, có gì đảm bảo không deploy code lỗi lên production?

Mỗi service có pipeline GitHub Actions riêng: lint → typecheck → audit → unit test → migrate (chạy thử migration với Postgres thật trong CI) → build. **Chỉ khi tất cả các bước trên pass**, image Docker mới được publish lên GHCR. Một deploy hook sau đó mới promote image đã được validate vào Render production. Vì mỗi service có pipeline riêng, một service lỗi không chặn việc deploy các service khác — đây cũng là lợi ích cụ thể của kiến trúc độc lập triển khai.

### G3. Nếu deploy lỗi lên production thì rollback như thế nào?

Re-promote lại image tag đã biết là tốt (known-good) trên GHCR — vì mỗi lần build đều gắn tag cố định, rollback chỉ là trỏ Render về tag cũ, không cần build lại. Về database, migration được kiểm soát và review kỹ, tránh migration phá hủy (destructive) mà không có backup. Điểm thành thật cần nói: **chưa có rollback drill thực tế đã diễn tập** (formal rollback rehearsal) — đây nằm trong phần cần hoàn thiện thêm.

---

## H. Câu hỏi phản biện / "bẫy" thường gặp

### H1. "Với quy mô đồ án sinh viên, 9 service có phải là over-engineering không?"

Đây là câu hỏi công bằng, và câu trả lời tốt nhất là thừa nhận đánh đổi thẳng thắn: đúng là với lưu lượng thực tế của một đồ án học phần, 1 service hay 3 service vẫn đủ chạy được. Nhưng mục tiêu môn học SE361 là **thực hành kiến trúc microservice thật sự** — nếu gộp quá nhiều context vào 1 service, sẽ không có gì để trình bày về giao tiếp liên service, saga, hay database-per-service. 9 service được chọn theo **ranh giới bounded context tự nhiên** đã tồn tại sẵn trong modular monolith, không phải chia cho đủ số lượng — đây là bằng chứng nó không tùy tiện.

### H2. "Tại sao Ordering biết cả cart, order, lifecycle, ACL — có phải Ordering đang làm quá nhiều việc không, vi phạm Single Responsibility?"

Ordering "làm nhiều việc" ở mức bảng dữ liệu, nhưng **chỉ một trách nhiệm** ở mức nghiệp vụ: quản lý toàn bộ vòng đời một đơn hàng, từ giỏ hàng đến giao xong. Cart, order, lifecycle, history đều là các khía cạnh khác nhau của **cùng một câu chuyện nghiệp vụ** — tách chúng ra thành các service riêng sẽ tạo ra giao tiếp liên service dày đặc cho những thứ vốn dĩ luôn thay đổi cùng nhau, vi phạm nguyên tắc "high cohesion" còn nặng hơn. Đây là chọn lựa DDD: nhóm theo sự cố kết nghiệp vụ, không nhóm theo bảng dữ liệu.

### H3. "Nếu 2 client cùng lúc gửi request đặt hàng với cùng idempotency key nhưng nội dung giỏ hàng khác nhau thì sao?"

Idempotency key được sinh ra gắn với một phiên checkout cụ thể (không phải do client tự chọn tùy ý), nên về bản chất tình huống này không xảy ra trong luồng bình thường. Nếu là câu hỏi giả định về race condition ở tầng thấp hơn: Redis dùng `SET NX` để giữ khóa checkout — request thứ hai đến trong lúc request đầu đang xử lý sẽ bị từ chối/xếp hàng chờ, không xử lý song song hai request cùng giỏ hàng.

### H4. "Khi nào thì các bạn KHÔNG dùng microservice? Có tự tin nói microservice luôn tốt hơn monolith không?"

Câu trả lời ăn điểm nhất ở đây là phản biện lại chính câu hỏi: **microservice không phải lúc nào cũng tốt hơn**. Với đội nhỏ, domain chưa ổn định, hoặc sản phẩm giai đoạn early-stage cần thay đổi nhanh, modular monolith gần như luôn là lựa chọn tốt hơn — chi phí vận hành phân tán (network, eventual consistency, nhiều database) chỉ đáng trả khi đã có nhu cầu thật về scale độc lập hoặc đội ngũ đủ lớn để mỗi team sở hữu 1-2 service. Bằng chứng chúng em hiểu điều này: chính dự án bắt đầu từ monolith, không nhảy thẳng vào microservice.

### H5. "Distributed tracing / làm sao debug một request đi qua nhiều service?"

Có `x-request-id` được gateway sinh ra và **truyền xuyên suốt** qua mọi RPC call và event, cộng với structured logging (JSON log) ở từng service — nên có thể lọc log theo `request-id` để lần theo dấu vết 1 request đi qua bao nhiêu service. Có tích hợp OpenTelemetry để export trace lên Grafana Cloud. Điểm thành thật: mức độ trưởng thành của observability (alerting tự động, dashboard tổng hợp theo từng loại lỗi) chưa hoàn thiện — hiện tại vẫn cần tra log thủ công theo request-id là chính.

---

## I. Hạn chế & Định hướng tương lai

### I1. Hệ thống còn thiếu gì so với một hệ thống production thật sự?

Trả lời thẳng thắn theo đúng những gì đã ghi nhận: (1) test tự động phía client (web/admin/mobile) còn mỏng so với backend; (2) chưa có rate limiting đầy đủ ở tầng gateway/edge cho các endpoint public; (3) SLO và alerting tự động chưa được định nghĩa và diễn tập; (4) chưa có backup/restore drill thực tế; (5) luồng shipper (giao hàng) mới ở mức tối thiểu, chưa có tối ưu điều phối tự động. Tất cả đều được ghi rõ trong roadmap, không phải phát hiện bất ngờ lúc bị hỏi.

### I2. Nếu có thêm thời gian, sẽ ưu tiên cải thiện gì trước?

Theo đúng thứ tự rủi ro: (1) test tự động cho client — vì đây là nơi lỗi regression dễ lọt qua nhất mà không ai biết; (2) rate limiting — vì thiếu nó là rủi ro bảo mật/vận hành thực sự ở production; (3) tổng quát hóa cổng thanh toán (payment port hiện đang gắn khá chặt với VNPay) để dễ thêm MoMo/ZaloPay sau này mà không sửa Ordering; (4) alerting/SLO để phát hiện sự cố chủ động thay vì bị động qua báo cáo người dùng.

### I3. Có kế hoạch mở rộng thêm service mới không, ví dụ Shipper service riêng?

Có — hiện luồng shipper mới dừng ở các trạng thái vòng đời cơ bản (pickup/deliver) nằm trong Ordering, chưa tách thành bounded context riêng vì độ phức tạp nghiệp vụ (điều phối, tối ưu tuyến đường, onboarding shipper) chưa đủ lớn để chứng minh chi phí tách service. Đây đúng là nguyên tắc chúng em theo suốt dự án: **chỉ tách service khi ranh giới nghiệp vụ đã đủ rõ và đủ nặng để trả giá cho việc tách**, không tách trước khi cần.

---

*File này nên đọc cùng với kịch bản thuyết trình ([`presentations/uitfood-presentation-script.md`](../../../presentations/uitfood-presentation-script.md)) — phần "Anticipated Questions" ở đó là bản tiếng Anh rút gọn của một số câu hỏi tương tự.*
