# UITFood / SoLi — Hướng Dẫn Kiến Trúc Microservice Cho Dev Mới

> Tài liệu này viết cho một developer **mới gia nhập dự án**, chưa từng làm việc với hệ thống microservice trước đây. Mục tiêu là sau khi đọc xong, bạn hiểu được: hệ thống này gồm những gì, các service nói chuyện với nhau bằng cách nào, "saga pattern" là gì và vì sao checkout lại cần nó, "bounded context" nghĩa là gì trong ngữ cảnh dự án này — và quan trọng nhất, **khi bạn cần sửa code, bạn nên sửa ở đâu và theo quy tắc nào**.
>
> Tài liệu đi sâu vào khái niệm và giải thích "tại sao", còn chi tiết kỹ thuật thuần (danh sách port, danh sách package...) đã có sẵn ở [ARCHITECTURE MICROSERVICE.md](./ARCHITECTURE%20MICROSERVICE.md), [DESIGN_PATTERNS.md](./DESIGN_PATTERNS.md), [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md), [TECHNICAL_SOLUTION.md](./TECHNICAL_SOLUTION.md) — tài liệu này là cầu nối để bạn đọc các file đó dễ hiểu hơn.

---

## 1. Hệ thống này là gì?

UIT Food (tên sản phẩm: **SoLi**) là một nền tảng đặt đồ ăn và giao hàng nhiều vai trò: khách hàng, nhà hàng, shipper, admin nền tảng. Về mặt sản phẩm nó không có gì lạ — giống Baemin, GrabFood thu nhỏ. Cái đáng nói là **cách nó được xây**: hệ thống ban đầu là một **modular monolith** (một ứng dụng NestJS duy nhất, nhưng chia module rõ ràng bên trong), sau đó được **di trú (migrate) sang 9 microservice độc lập**, đứng sau một **edge gateway** duy nhất.

Nếu bạn mới vào dự án, điều đầu tiên cần khắc cốt ghi tâm là:

> **Không có một database chung. Không có service nào gọi thẳng vào database của service khác. Mọi giao tiếp giữa các service đều đi qua mạng (network), không phải qua lời gọi hàm trong cùng một process.**

Nghe có vẻ hiển nhiên, nhưng đây chính là ranh giới (boundary) quyết định toàn bộ cách bạn được phép và không được phép viết code trong dự án này.

### 1.1. Vì sao lại tách thành microservice?

Không phải vì "microservice là xu hướng". Lý do cụ thể:

- **Triển khai độc lập** — sửa xong Payment thì deploy lại Payment, không cần deploy lại cả hệ thống.
- **Cô lập lỗi (fault isolation)** — Promotion hay Reporting sập không kéo sập luồng checkout.
- **Scale riêng từng phần** — Catalog và Ordering là đường nóng (hot path), có thể tăng số instance riêng mà không cần tăng toàn bộ hệ thống.
- **Sở hữu dữ liệu rõ ràng (data ownership)** — mỗi service có database riêng, không ai đọc/ghi bảng của người khác.

Đổi lại, cái giá phải trả là **hệ thống phức tạp hơn về vận hành**: cần một message broker (RabbitMQ), cần 9 database thay vì 1, và các luồng nghiệp vụ xuyên nhiều service (như đặt hàng) không còn transaction database đơn giản nữa — phải dùng **Saga pattern** (xem mục 4).

### 1.2. Vì sao lại di trú dần dần thay vì viết lại từ đầu?

Vì viết lại từ đầu (big-bang rewrite) rất rủi ro — hệ thống cũ dừng nhận tính năng mới trong khi hệ thống mới chưa chạy được. Dự án dùng **Strangler Fig pattern**: từng bounded context một được "bóc" ra khỏi monolith, đứng sau một cờ cấu hình (feature flag) ở gateway, ví dụ `CATALOG_ROUTES_ENABLED`. Khi cờ tắt, gateway proxy request sang monolith cũ như bình thường. Khi cờ bật, gateway gọi sang microservice mới. Vì vậy tại **mọi thời điểm trong quá trình di trú, hệ thống vẫn release được** — không có "ngày dừng toàn hệ thống để chuyển đổi".

---

## 2. Bức tranh tổng thể

```
        Web / Admin / Mobile
                 │
                 ▼
        ┌─────────────────┐
        │  Edge Gateway    │  ← CỬA DUY NHẤT ra thế giới bên ngoài
        │  :8080           │
        └────────┬─────────┘
                  │ TCP RPC (gọi đồng bộ)
   ┌──────────────┼──────────────────────────────────┐
   ▼              ▼              ▼                    ▼
Identity       Catalog        Ordering            Reporting
Media          Promotion      Payment             Review
Notification                                       ...
   │              │              │                    │
   ▼              ▼              ▼                    ▼
identity_db   catalog_db    ordering_db + Redis   reporting_db
                                  │
                                  ▼
                          RabbitMQ (bất đồng bộ)
                     "một sự kiện, nhiều service lắng nghe"
```

Chín service, chia làm hai nhóm theo tài liệu kiến trúc:

| Nhóm | Service | Sở hữu (owns) |
|---|---|---|
| **Core commerce** | Catalog, Ordering, Promotion, Payment | menu/nhà hàng, giỏ hàng/đơn hàng, khuyến mãi, thanh toán |
| **Platform** | Identity, Media, Notification, Review, Reporting | user/session, ảnh, thông báo, đánh giá, báo cáo |

Điểm mấu chốt cần nhớ: **client (web/admin/mobile) không bao giờ gọi thẳng vào một service**. Tất cả đi qua Gateway. Gateway là nơi duy nhất xác thực người dùng (session, JWT), rồi mới forward request xuống service tương ứng bằng TCP RPC nội bộ.

---

## 3. DDD & Bounded Context — vì sao lại chia service theo cách này?

**Bounded Context** (ngữ cảnh giới hạn) là khái niệm cốt lõi của Domain-Driven Design (DDD): mỗi phần của hệ thống có **mô hình dữ liệu và ngôn ngữ riêng (ubiquitous language)**, và một từ giống nhau ở hai context khác nhau **có thể mang nghĩa khác nhau**.

Ví dụ dễ hiểu nhất trong dự án này: từ **"Restaurant"**.

- Trong **Catalog**, "Restaurant" là một thực thể có menu, giờ mở cửa, khu vực giao hàng, trạng thái duyệt (approved/pending).
- Trong **Ordering**, "Restaurant" chỉ là một **bản sao rút gọn** (snapshot) — tên, id, có đang hoạt động không — đủ để tính giá đơn hàng, không hơn.
- Trong **Reporting**, "Restaurant" chỉ còn là một dòng trong bảng thống kê GMV.

Ba service này **không dùng chung một bảng `restaurants`**. Mỗi service tự giữ phiên bản dữ liệu của riêng mình, phù hợp với việc nó cần làm gì. Đây chính là lý do dự án này chia thành 9 service — **mỗi service = một bounded context**, có model, database, và "ngôn ngữ" riêng:

| Bounded Context | Từ vựng đặc trưng (ubiquitous language) |
|---|---|
| Identity | user, session, role, account |
| Catalog | restaurant, menu item, modifier group, delivery zone |
| Ordering | cart, order, line item, lifecycle transition, snapshot |
| Promotion | promotion, coupon, reservation, discount |
| Payment | attempt, IPN, refund, transaction |
| Review | review, rating, eligibility |
| Notification | inbox message, channel, device token |
| Reporting | fact, projection, GMV |

### 3.1. Anti-Corruption Layer (ACL) — "phiên dịch viên" giữa các context

Khi Ordering cần biết thông tin nhà hàng từ Catalog, nó **không** gọi API của Catalog mỗi lần cần. Thay vào đó, Ordering giữ một **bản sao cục bộ (local snapshot)**, được cập nhật mỗi khi Catalog phát ra sự kiện `catalog.restaurant.changed.v1`. Bản sao này nằm trong chính database của Ordering (`ordering_*_snapshots`), và code nằm ở `apps/services/ordering/src/ordering/acl/`.

Lợi ích cụ thể: nếu Catalog service bị sập vào đúng lúc khách hàng bấm "Đặt hàng", **checkout vẫn chạy được** — vì nó tính giá hoàn toàn dựa trên snapshot cục bộ, không cần gọi Catalog trong lúc đó.

> **Quy tắc cho dev mới:** nếu bạn thấy mình đang định `import` trực tiếp code hay gọi thẳng repository của một service khác (ví dụ Ordering import `RestaurantRepository` từ Catalog) — **dừng lại**. Đó là dấu hiệu bạn đang phá vỡ ranh giới bounded context. Cách đúng là: gọi qua TCP RPC (nếu cần trả lời ngay) hoặc lắng nghe event rồi lưu bản snapshot của riêng bạn (nếu chỉ cần đồng bộ dữ liệu).

### 3.2. Bên trong một bounded context — DDD tactical

Không chỉ chia ở tầm vĩ mô, bên trong mỗi service cũng áp dụng các khối xây dựng (building block) của DDD:

| Khái niệm DDD | Ví dụ trong code |
|---|---|
| **Aggregate root** | `Order`, `Cart`, `Promotion`, `Restaurant` — ranh giới nhất quán (consistency boundary); bạn sửa đổi qua aggregate root, không sửa trực tiếp con của nó |
| **Entity** | order item, coupon code, modifier option — có identity nhưng sống bên trong một aggregate |
| **Value Object** | địa chỉ giao hàng, số tiền VND, breakdown giảm giá |
| **Domain Service** | `PromotionPricingEngine` — một class thuần Typescript, **không** phụ thuộc NestJS/DB/I/O, chỉ nhận số liệu giỏ hàng và trả về mức giảm giá |
| **Repository** | `order.repository.ts`, `promotion.repository.ts` — lớp truy cập dữ liệu qua Drizzle |
| **Domain Event** | `order.placed.v1`, `payment.confirmed.v1` — sự thật (fact) mà các context khác có thể phản ứng theo |

Ý nghĩa thực tiễn: logic nghiệp vụ "khó" (tính giá, quy tắc chuyển trạng thái đơn hàng) nằm trong domain service/engine thuần túy, **không** nằm rải rác trong controller. Điều này giúp test dễ — bạn test `PromotionPricingEngine` mà không cần mock database hay network.

---

## 4. Giao tiếp giữa các service

Đây là phần nhiều dev mới hay nhầm lẫn nhất, vì trong monolith bạn quen gọi hàm trực tiếp — trong microservice thì **không còn lời gọi hàm xuyên service nữa, chỉ còn lời gọi qua mạng**. Dự án này chỉ dùng **đúng hai kiểu giao tiếp**, không có kiểu thứ ba:

### 4.1. Đồng bộ — TCP RPC (`@MessagePattern` / `ClientProxy`)

Dùng khi: **người gọi cần câu trả lời ngay lập tức**, và câu trả lời đó ảnh hưởng trực tiếp đến request hiện tại.

Ví dụ: lúc checkout, Ordering cần biết Promotion có áp dụng được mã giảm giá hay không — nó phải biết **ngay bây giờ**, vì số tiền cuối cùng phụ thuộc vào đó.

```ts
// Bên gọi (Ordering) — gửi request qua TCP, chờ kết quả
const result = await firstValueFrom(
  this.promotionClient.send(PROMOTION_RPC_PATTERNS.RESERVE, payload).pipe(timeout(3000))
);

// Bên nhận (Promotion) — expose "hàm" này ra ngoài qua TCP
@MessagePattern(PROMOTION_RPC_PATTERNS.RESERVE)
async reserve(@Payload() dto: ReserveDto) { ... }
```

Đặc điểm quan trọng:
- **Luôn có timeout** — không bao giờ chờ vô thời hạn một service khác.
- **Contract được định nghĩa sẵn và versioned** trong package dùng chung `@uitfood/contracts` (dùng Zod để validate) — nếu bạn đổi shape của payload mà không cập nhật package này, TypeScript sẽ báo lỗi biên dịch ở **mọi** service đang dùng nó. Đây là lưới an toàn lớn nhất của dự án — hãy tận dụng nó, đừng bypass bằng `any`.
- Lỗi từ RPC được map thành một envelope lỗi chuẩn, gateway dịch lại thành HTTP status code phù hợp.

### 4.2. Bất đồng bộ — RabbitMQ Domain Events

Dùng khi: **một sự thật vừa xảy ra, cần thông báo cho các service khác biết, nhưng không ai phải chờ kết quả**.

Ví dụ: "đơn hàng vừa được đặt" (`order.placed.v1`) — Notification cần biết để gửi thông báo, Reporting cần biết để cập nhật thống kê. Ordering **không cần và không nên** chờ hai service đó xử lý xong mới trả response cho khách hàng.

```
Producer (Ordering)                RabbitMQ                  Consumer (Notification, Reporting, ...)
      │                        (topic exchange:                          │
      │   ghi 1 dòng vào       uitfood.domain-events)                    │
      │   outbox_events              │                                   │
      │   (CÙNG transaction           │                                   │
      │   với business write)         │                                   │
      ▼                               │                                   │
  relay quét outbox,            ─────►│──── routing key ──────►  handler nhận event
  publish lên RabbitMQ                │                          ghi vào inbox_events
                                       │                          (dedupe theo consumer+eventId)
                                       │                                   │
                                                                    nếu đã xử lý rồi → bỏ qua
                                                                    nếu chưa → áp dụng thay đổi
```

Hai cơ chế đảm bảo độ tin cậy ở đây, **bắt buộc phải hiểu** trước khi động vào code messaging:

1. **Transactional Outbox** — khi Ordering ghi đơn hàng mới vào bảng `orders`, nó ghi **luôn trong cùng transaction database** một dòng vào bảng `outbox_events`. Vì hai thao tác này cùng một transaction, chúng **không bao giờ lệch nhau** — hoặc cả hai cùng thành công, hoặc cả hai cùng rollback. Một tiến trình nền (relay) sau đó mới quét bảng outbox và publish lên RabbitMQ.
2. **Inbox / Idempotent Consumer** — phía nhận, trước khi áp dụng một event, service ghi `(consumer, eventId)` vào bảng `inbox_events` với ràng buộc unique. Nếu event bị gửi lại (do mạng lag, do RabbitMQ redeliver), lần xử lý thứ hai sẽ bị chặn ở bước ghi inbox — event bị bỏ qua thay vì áp dụng hai lần.

> **Quy tắc cho dev mới:** nếu bạn cần dữ liệu để trả lời request hiện tại → dùng TCP RPC. Nếu bạn chỉ cần báo cho hệ thống biết "việc gì đó vừa xảy ra" mà không quan tâm ai xử lý nó khi nào → phát event. **Đừng bao giờ** dùng RabbitMQ để giả lập một cuộc gọi đồng bộ (publish rồi ngồi chờ response) — đó là dấu hiệu bạn đang chọn sai công cụ.

### 4.3. Bảo mật giữa các service — internal JWT

Một câu hỏi thường gặp: "Nếu client không gọi thẳng service, vậy service có tin request từ Gateway một cách mù quáng không?" — Không. Gateway xác thực session của người dùng (qua Better Auth), sau đó **tự tạo một JWT nội bộ, sống rất ngắn (60 giây)**, gắn `audience` là tên service đích (`aud=catalog`). Service nhận request phải tự verify chữ ký, verify `audience`, và **tự kiểm tra lại role/quyền** — không tin bất kỳ header thô nào gửi tới. Khi một service gọi service khác (ví dụ Ordering gọi Payment), nó dùng một token dạng `service:*` tương tự.

Nói cách khác: **không có khái niệm "tin tưởng nội bộ mặc định"**. Mọi hop giữa các service đều được xác thực lại từ đầu.

---

## 5. Saga Pattern — vì sao checkout lại phức tạp đến vậy?

### 5.1. Vấn đề: transaction không còn "xuyên" được nữa

Trong một monolith, đặt hàng có thể nằm gọn trong **một database transaction**: trừ khuyến mãi, tạo payment attempt, tạo order — hoặc tất cả thành công, hoặc tất cả rollback, đơn giản.

Trong microservice, ba việc đó nằm ở **ba database khác nhau** (Promotion, Payment, Ordering), thuộc ba service khác nhau. **Không có transaction nào có thể "xuyên" qua ba database này cùng lúc.** Đây là vấn đề kinh điển nhất khi chuyển từ monolith sang microservice, và **Saga Pattern** là câu trả lời chuẩn cho nó.

### 5.2. Saga hoạt động thế nào trong dự án này

Ordering đóng vai trò **saga orchestrator** — nó chủ động điều phối từng bước, và **tự chịu trách nhiệm "dọn dẹp" (compensate)** nếu có bước nào thất bại giữa chừng.

```
Bước 1  Ordering nạp giỏ hàng từ Redis, validate với ACL snapshot của Catalog
          (không cần gọi Catalog lúc này — dùng bản sao cục bộ)

Bước 2  Ordering gọi Promotion để "giữ chỗ" (reserve) một mã giảm giá — TCP RPC
          → Nếu Promotion sập hoặc không có gì để giữ: KHÔNG coi là lỗi,
            checkout tiếp tục mà không có giảm giá (non-blocking, có chủ đích)
          → Nếu giữ chỗ thành công: nhận về số tiền giảm giá

Bước 3  (chỉ khi thanh toán VNPay) Ordering gọi Payment để tạo payment attempt — TCP RPC
          → Nếu lỗi: BÙ TRỪ bước 2 — gọi Promotion rollback reservation
            → trả lỗi 503 cho khách, khách có thể thử lại

Bước 4  Ordering commit: BEGIN — insert order(PENDING) + line items +
          1 dòng outbox "order.placed" — COMMIT (một transaction DUY NHẤT,
          chỉ trong database của Ordering)
          → Nếu bước này lỗi: BÙ TRỪ cả bước 2 và 3 —
            đánh dấu payment attempt "failed", rollback reservation

Bước 5  Nếu bước 4 thành công: Ordering xác nhận (confirm) reservation với
          Promotion, trả về order + paymentUrl (nếu có) cho khách hàng
```

**Kết quả thanh toán thật sự** (khách đã trả tiền hay chưa) **không** nằm trong luồng đồng bộ ở trên — nó đến **sau đó, bất đồng bộ**, qua callback IPN từ VNPay: VNPay gọi vào Payment service → Payment verify chữ ký HMAC-SHA512 → Payment phát event `payment.confirmed.v1` hoặc `payment.failed.v1` → Ordering lắng nghe event này và chuyển trạng thái đơn hàng từ `PENDING` sang `PAID` hoặc `CANCELLED`.

### 5.3. Ba điều làm cho saga này "an toàn"

1. **Transactional outbox** — order và event `order.placed` được ghi trong cùng một transaction, nên chúng không bao giờ lệch nhau (không có chuyện order được tạo mà event bị mất, hoặc ngược lại).
2. **Promotion là non-blocking** — một service phụ (Promotion) gặp sự cố **không được phép** làm sập luồng chính (checkout). Đây là một dạng "graceful degradation" nhẹ.
3. **Mọi bước bù trừ (compensation) đều idempotent và fire-and-forget** — gọi rollback hai lần cũng an toàn như gọi một lần; và Ordering không "chờ" compensation chạy xong mới trả lỗi cho client.

### 5.4. So sánh nhanh: Saga khác gì transaction thường?

| | Transaction DB thường | Saga Pattern |
|---|---|---|
| Phạm vi | Trong 1 database | Xuyên nhiều service/database |
| Khi lỗi giữa chừng | Tự động rollback toàn bộ | Phải **tự viết** logic bù trừ (compensation) cho từng bước |
| Tính nhất quán | Nhất quán ngay (strong consistency) | Nhất quán cuối cùng (eventual consistency) — có một khoảng thời gian ngắn dữ liệu chưa đồng bộ hết |
| Ai điều phối | Database engine | Một service đóng vai trò orchestrator (ở đây là Ordering) |

> **Quy tắc cho dev mới:** nếu bạn thêm một bước mới vào luồng checkout mà bước đó có "side effect" (ghi dữ liệu, gọi service khác), bạn **bắt buộc** phải nghĩ luôn: "nếu bước sau nó thất bại, tôi bù trừ bước này như thế nào?" — nếu không trả lời được câu đó, đừng thêm bước đó vào saga mà chưa bàn với team.

---

## 6. Cấu trúc bên trong một service — code ở đâu?

Cả 9 service dùng **chung một khuôn (template)**, học 1 cái là hiểu cả 9:

```
apps/services/<tên-service>/src/
├── main.ts          # khởi động: vừa là TCP microservice, vừa expose HTTP /live /ready
├── config/           # Zod env schema — validate biến môi trường, sai là crash ngay lúc boot
├── auth/              # verify internal JWT do gateway phát hành
├── rpc/                # những gì service này "cho phép người khác gọi" (@MessagePattern)
├── messaging/          # outbox, inbox, kết nối RabbitMQ — publish & subscribe event
├── drizzle/             # database mà CHÍNH service này sở hữu (schema + migration)
└── <domain>/             # phần lõi — logic nghiệp vụ thật sự
    ├── domain/*.schema.ts    # định nghĩa bảng
    ├── services/*.ts          # business logic
    ├── repositories/*.ts       # truy cập dữ liệu qua Drizzle
    └── engine/*.ts              # logic thuần (không phụ thuộc NestJS/DB) — vd tính giá
```

Nguyên tắc đặt tên nhanh:
- `rpc/` = những gì service **cho phép gọi đồng bộ**
- `messaging/consumers/` (nếu có) = những gì service **phản ứng lại bất đồng bộ**
- `<domain>/` = service **thực chất là gì** (bounded context của nó)
- `drizzle/` = service **sở hữu dữ liệu gì**

### 6.1. Bảng tra nhanh "tôi cần sửa gì thì vào đâu"

| Tôi muốn... | Vào đâu |
|---|---|
| Thêm/sửa 1 route public (HTTP) | `apps/gateway/src/<service>/` |
| Thêm 1 khả năng mới mà service khác có thể gọi (RPC) | `apps/services/<svc>/src/rpc/` |
| Sửa logic nghiệp vụ | `apps/services/<svc>/src/<domain>/services/` |
| Thêm/sửa bảng database | `apps/services/<svc>/src/<domain>/domain/*.schema.ts` rồi chạy `pnpm --filter <svc> db:generate` |
| Phát ra 1 event mới | `.../messaging/outbox` (producer) |
| Lắng nghe 1 event có sẵn | `.../messaging/consumers/` (consumer) |
| Đổi hợp đồng (contract) giữa các service | `packages/contracts/src/` — **mọi service dùng chung file này, sửa 1 chỗ, cả hệ thống biết** |

---

## 7. Vài nguyên tắc "bất di bất dịch" khi code trong dự án này

Đây là những điều nếu vi phạm, review sẽ (và nên) bị từ chối:

1. **Không share database, không JOIN xuyên service.** Cần dữ liệu của service khác → gọi RPC (cần ngay) hoặc giữ snapshot qua event (không cần ngay).
2. **Không import thẳng code nội bộ của service khác.** Giao tiếp chỉ qua RPC pattern hoặc event đã định nghĩa trong `@uitfood/contracts`.
3. **Mọi lời gọi RPC đều phải có timeout.** Không bao giờ để một service treo vô thời hạn chờ service khác.
4. **Mọi event đều phải idempotent ở phía consumer** (dùng inbox) — vì message có thể bị gửi lại.
5. **Đổi contract (RPC pattern / event payload) thì sửa ở `packages/contracts`**, không tự ý đổi type cục bộ trong 1 service — sẽ làm hai bên lệch nhau mà không ai biết cho tới khi chạy production.
6. **Business logic quan trọng viết dưới dạng domain service/engine thuần**, không nhét vào controller hay RPC handler — để còn test được mà không cần mock cả hệ thống.
7. **Thêm bước mới vào 1 saga (như checkout) → phải có compensation.** Không có ngoại lệ.

---

## 8. Chạy hệ thống ở máy local

```bash
# lần đầu / khi đổi dependency
docker compose -f docker-compose.dev.yml up -d --build

# các lần sau — chạy riêng từng phần khi đang code
pnpm --filter gateway dev
pnpm --filter identity dev      # ... hoặc bất kỳ service nào bạn đang sửa
pnpm --filter web dev
```

`docker-compose.dev.yml` dựng toàn bộ hạ tầng cần thiết trong 1 lệnh: Postgres (9 database + 9 role, mỗi service một cái), Redis ×2, RabbitMQ, và toàn bộ 9 service + gateway + web + admin. Mỗi service **tự chạy migration cho database của chính nó** lúc khởi động — không có bước `db:push` chung cho cả hệ thống. Web chạy ở `:5173`, Admin ở `:5174`, Gateway ở `:8080`, RabbitMQ management UI ở `:15672`.

> Lần build đầu tiên khá lâu (3–5 phút) vì phải cài dependency dùng chung và chạy migration cho cả 9 service — đừng hoảng nếu nó im lặng vài phút.

---

## 9. Tóm tắt cho người vội

- **9 service, mỗi service = 1 bounded context**, có database riêng, không share, không JOIN xuyên service.
- **2 kiểu giao tiếp duy nhất**: TCP RPC (đồng bộ, cần trả lời ngay) và RabbitMQ event (bất đồng bộ, chỉ báo tin).
- **Outbox/Inbox** là cơ chế đảm bảo event không bị mất và không bị xử lý trùng.
- **Saga Pattern** (cụ thể ở luồng checkout) thay thế cho database transaction xuyên service — mỗi bước có thể có một bước "bù trừ" (compensation) nếu bước sau thất bại.
- **ACL snapshot** giúp một service không phụ thuộc trực tiếp vào service khác lúc runtime — nó giữ bản sao dữ liệu cục bộ, đồng bộ qua event.
- **Gateway là cửa duy nhất**, tự phát JWT nội bộ ngắn hạn cho mỗi hop — không service nào tin request một cách mù quáng.
- Cả 9 service dùng chung 1 khuôn thư mục — học cấu trúc 1 service là đọc hiểu được cả 9.

Đọc thêm khi cần chi tiết sâu hơn: [ARCHITECTURE MICROSERVICE.md](./ARCHITECTURE%20MICROSERVICE.md) (sơ đồ và luồng chi tiết), [DESIGN_PATTERNS.md](./DESIGN_PATTERNS.md) (bản đồ pattern → code), [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) (cây thư mục đầy đủ), [TECHNICAL_SOLUTION.md](./TECHNICAL_SOLUTION.md) (vì sao chọn từng công nghệ).
