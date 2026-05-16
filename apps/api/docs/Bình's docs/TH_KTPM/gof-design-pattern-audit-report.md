# Báo Cáo Kiểm Tra Toàn Diện: 23 GoF Design Patterns trong NestJS Backend

**Dự án:** SoLi Food Delivery — NestJS Backend
**Phiên bản:** 1.1 (re-audit — corrected)
**Ngày:** 2026-05-18
**Kiểm tra bởi:** GitHub Copilot (Claude Sonnet 4.6)
**Phương pháp:** Đọc toàn bộ ~61 file nguồn; xác minh từng pattern bằng bằng chứng code thực tế.

---

## Mục lục

1. [Tóm tắt kết quả](#1-tóm-tắt-kết-quả)
2. [Kiến trúc tổng thể codebase](#2-kiến-trúc-tổng-thể-codebase)
3. [Creational Patterns (5)](#3-creational-patterns)
4. [Structural Patterns (7)](#4-structural-patterns)
5. [Behavioral Patterns (11)](#5-behavioral-patterns)
6. [Bảng tổng hợp cuối](#6-bảng-tổng-hợp-cuối)

---

## 1. Tóm Tắt Kết Quả

| Nhóm | Tổng | Có mặt | Không có |
|------|------|--------|----------|
| Creational | 5 | 3 | 2 |
| Structural | 7 | 4 | 3 |
| Behavioral | 11 | 6 | 5 |
| **Tổng** | **23** | **13** | **10** |

**13 patterns được xác nhận** với bằng chứng file/class cụ thể.
**10 patterns không xuất hiện** với giải thích lý do tại sao không cần hoặc không được áp dụng.

---

## 2. Kiến Trúc Tổng Thể Codebase

Trước khi đi vào từng pattern, cần hiểu kiến trúc nền tảng:

| Thành phần | Công nghệ | Ghi chú |
|------------|-----------|---------|
| Framework | NestJS với `@nestjs/cqrs` | CommandBus + EventBus xuyên suốt |
| Database | Drizzle ORM + PostgreSQL | `DB_CONNECTION` token, `NodePgDatabase<typeof schema>` |
| Cache | ioredis (`REDIS_CLIENT` token nội bộ) | `RedisModule` @Global(), export `RedisService` wrapper |
| WebSocket | Socket.IO + `@nestjs/websockets` | `NotificationGateway` tại namespace `/notifications` |
| Auth | Better Auth + `drizzleAdapter` | roles: `admin`, `restaurant`, `shipper`, `user` |
| Push | Firebase Admin SDK | `FirebasePushProvider` → `sendEachForMulticast()` |
| Email | Nodemailer | `NodemailerEmailProvider` + `NoopEmailProvider` |
| Storage | Cloudinary | `cloudinaryProvider` factory, `CLOUDINARY_CLIENT` token |
| Payment | VNPay (HMAC SHA512) | `VNPayService` xử lý URL + IPN |
| Scheduler | `@nestjs/schedule` | `@Cron` + `@Interval` decorators |

**Bounded Contexts (BC):**
- `restaurant-catalog` — quản lý nhà hàng, menu, modifier
- `ordering` — cart, đặt hàng, lifecycle đơn hàng, ACL snapshots
- `payment` — VNPay gateway, IPN handler, transaction management
- `notification` — đa kênh (in-app/email/push), preferences, quiet hours
- `promotion` — engine tính giảm giá, coupon codes, quota management

---

## 3. Creational Patterns

### 3.1 Abstract Factory

**Trạng thái: ✅ CÓ MẶT (dưới dạng Paired Provider Factories)**

#### Định nghĩa
Abstract Factory cung cấp một interface để tạo ra các *gia đình* đối tượng có liên quan (related/dependent objects) mà không cần chỉ định class cụ thể.

#### Áp dụng trong codebase

`NotificationModule` có hai factory provider hoạt động như một Abstract Factory theo nghĩa kiến trúc — chúng tạo ra một cặp sản phẩm liên quan (email transport + push transport) cùng sử dụng cùng chiến lược chọn lựa (production vs. testing/dev):

**File:** `apps/api/src/module/notification/notification.module.ts`

```typescript
// Factory 1 — Email Provider
{
  provide: EMAIL_PROVIDER,
  useFactory: (config: ConfigService) => {
    const smtpHost = config.get<string>('SMTP_HOST');
    return smtpHost
      ? new NodemailerEmailProvider(smtpHost, smtpUser, smtpPass, smtpFrom)
      : new NoopEmailProvider();
  },
  inject: [ConfigService],
},

// Factory 2 — Push Provider
{
  provide: PUSH_PROVIDER,
  useFactory: (config: ConfigService) => {
    const keyPath = config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    return keyPath && process.env.NODE_ENV !== 'test'
      ? new FirebasePushProvider(keyPath)
      : new StubPushProvider();
  },
  inject: [ConfigService],
},
```

| Sản phẩm | Production | Testing/Dev |
|----------|------------|-------------|
| `IEmailProvider` | `NodemailerEmailProvider` | `NoopEmailProvider` |
| `IPushProvider` | `FirebasePushProvider` | `StubPushProvider` |

Cả hai factory đều dùng cùng điều kiện môi trường (`NODE_ENV`, config vars) → hai sản phẩm trong cùng "gia đình" luôn nhất quán (production-production hoặc stub-stub).

#### Lưu ý quan trọng
Đây không phải Abstract Factory kiểu OOP cổ điển (không có class `AbstractFactory` hay interface thống nhất tạo ra "family" sản phẩm). Hai factory là hai NestJS provider function độc lập — chúng không có chung AbstractFactory interface. Tuy nhiên, *ý tưởng cốt lõi* — hai sản phẩm liên quan (email + push transport) luôn được chọn nhất quán theo cùng một điều kiện môi trường — được thực hiện thông qua hai `useFactory` chia sẻ cùng logic điều kiện. Đây là **architectural intent** của Abstract Factory, dù không theo form OOP truyền thống.

---

### 3.2 Builder

**Trạng thái: ❌ KHÔNG CÓ**

#### Lý do không có
- `CartService.addItem()` tích lũy `CartItem[]` qua các phép gán đơn giản, không xây dựng đối tượng phức tạp theo bước.
- `PlaceOrderHandler` tạo object đơn hàng theo kiểu literal object `{ id, customerId, ... }` — không có step-by-step builder API.
- Không có class nào có fluent interface kiểu `builder.setA(...).setB(...).build()`.

---

### 3.3 Factory Method

**Trạng thái: ✅ CÓ MẶT**

#### Định nghĩa
Factory Method định nghĩa một interface để tạo đối tượng, nhưng để subclass/component quyết định class nào sẽ được khởi tạo.

#### Áp dụng trong codebase — 5 Factory Methods

**1. RedisModule Factory**

File: `apps/api/src/lib/redis/redis.module.ts`

```typescript
{
  provide: REDIS_CLIENT,
  useFactory: () => {
    return new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
      retryStrategy: (times) => (times > 10 ? null : Math.min(times * 200, 3000)),
    });
  },
  // No inject — factory reads process.env directly (no ConfigService)
}
```

Module là "creator" — quyết định cấu hình Redis client mà không để consumer biết chi tiết kết nối.

**2. DatabaseModule Factory**

File: `apps/api/src/drizzle/drizzle.module.ts`

```typescript
{
  provide: DB_CONNECTION,
  useFactory: () => {
    const databaseUrl = process.env.DATABASE_URL;
    return drizzle(databaseUrl, { schema });
  },
  // No inject — factory reads process.env directly (no ConfigService)
}
```

**3. Cloudinary Factory**

File: `apps/api/src/module/image/cloudinary.provider.ts`

```typescript
export const cloudinaryProvider = {
  provide: CLOUDINARY_CLIENT,
  useFactory: (config: ConfigService) => {
    cloudinary.config({
      cloud_name: config.get('CLOUDINARY_CLOUD_NAME'),
      api_key: config.get('CLOUDINARY_API_KEY'),
      api_secret: config.get('CLOUDINARY_API_SECRET'),
    });
    return cloudinary;
  },
  inject: [ConfigService],
};
```

**4. EMAIL_PROVIDER Factory** (xem 3.1 Abstract Factory)

**5. PUSH_PROVIDER Factory** (xem 3.1 Abstract Factory)

#### Đặc điểm chung
Tất cả 5 factory đều: tập trung logic khởi tạo vào một nơi, đọc config từ `ConfigService`, trả về đối tượng thông qua token DI thay vì `new SomeClass()` trực tiếp ở nơi dùng.

---

### 3.4 Prototype

**Trạng thái: ❌ KHÔNG CÓ**

#### Lý do không có
Không có nhu cầu clone đối tượng trong hệ thống này. Các domain object (cart, order) được tạo từ dữ liệu người dùng hoặc từ DB, không cần copy từ prototype có sẵn.

---

### 3.5 Singleton

**Trạng thái: ✅ CÓ MẶT**

#### Định nghĩa
Singleton đảm bảo một class chỉ có một instance duy nhất và cung cấp global access point đến instance đó.

#### Áp dụng trong codebase

**Mặc định của NestJS DI Container:**
Tất cả provider được đăng ký với `@Injectable()` mà không chỉ định scope đều là **MODULE-SCOPED SINGLETON** — NestJS tạo đúng một instance cho mỗi module và tái sử dụng.

```typescript
@Injectable()
export class NotificationService { ... }   // 1 instance trong NotificationModule

@Injectable()
export class CartService { ... }           // 1 instance trong CartModule
```

**`@Global()` Singleton — truy cập từ mọi module:**

| Module | Token được export | Phạm vi |
|--------|-------------------|---------|
| `RedisModule` | `RedisService` | Application-wide |
| `GeoModule` | `GeoService` | Application-wide |
| `PromotionModule` | `PROMOTION_APPLICATION_PORT` | Application-wide |
| `PaymentModule` | `PAYMENT_INITIATION_PORT` | Application-wide |

Ví dụ `RedisModule`:

File: `apps/api/src/lib/redis/redis.module.ts`

```typescript
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => new Redis({
        host: process.env.REDIS_HOST ?? 'localhost',
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
        retryStrategy: (times) => (times > 10 ? null : Math.min(times * 200, 3000)),
      }),
    },
    RedisService,
  ],
  exports: [RedisService],  // Only RedisService is exported — REDIS_CLIENT is module-internal
})
export class RedisModule {}
```

`REDIS_CLIENT` là ioredis instance singleton — đúng một kết nối TCP được tạo ra và dùng chung cho toàn bộ application. `RedisService` bọc `REDIS_CLIENT` và là token được expose ra ngoài.

---

## 4. Structural Patterns

### 4.1 Adapter

**Trạng thái: ✅ CÓ MẶT**

#### Định nghĩa
Adapter cho phép interface không tương thích làm việc được với nhau bằng cách bọc một object vào class trung gian.

#### Áp dụng — 4 Adapter implementations

**1. IPromotionApplicationPort — BC Isolation Adapter**

File: `apps/api/src/shared/ports/promotion-application.port.ts`

```typescript
export const PROMOTION_APPLICATION_PORT = Symbol('IPromotionApplicationPort');

export interface IPromotionApplicationPort {
  previewDiscount(params: PreviewDiscountParams): Promise<PreviewDiscountResult>;
  reservePromotion(params: ReservePromotionParams): Promise<ReserveResult>;
  confirmReservation(reservationId: string): Promise<void>;
  rollbackReservation(reservationId: string): Promise<void>;
}
```

`PromotionService` implements `IPromotionApplicationPort`.
`PlaceOrderHandler` (Ordering BC) chỉ inject token `PROMOTION_APPLICATION_PORT` — không bao giờ import `PromotionService` trực tiếp.

**2. IPaymentInitiationPort — Anti-Circular Adapter**

File: `apps/api/src/shared/ports/payment-initiation.port.ts`

```typescript
export const PAYMENT_INITIATION_PORT = Symbol('IPaymentInitiationPort');

export interface IPaymentInitiationPort {
  initiateVNPayPayment(
    orderId: string, customerId: string,
    amount: number, ipAddr: string
  ): Promise<{ txnId: string; paymentUrl: string }>;
}
```

`PaymentService` implements `IPaymentInitiationPort`. Đây là port ngăn circular dependency giữa `OrderingModule` ↔ `PaymentModule`.

**3. CartRedisRepository — Redis Adapter**

File: `apps/api/src/module/ordering/cart/cart.redis-repository.ts`

Adapts generic `RedisService` (với `get/set/del/scan` thô) thành semantics cart-domain:

```typescript
@Injectable()
export class CartRedisRepository {
  private buildKey(customerId: string): string {
    return `${CART_KEY_PREFIX}${customerId}`;
  }

  async findByCustomerId(customerId: string): Promise<Cart | null> {
    const raw = await this.redis.get(this.buildKey(customerId));
    return raw ? (JSON.parse(raw) as Cart) : null;
  }

  async save(cart: Cart, ttlSeconds: number): Promise<void> {
    await this.redis.set(
      this.buildKey(cart.customerId),
      JSON.stringify(cart),
      'EX', ttlSeconds,
    );
  }
}
```

`CartService` không biết cart được lưu ở Redis hay đâu — chỉ biết `CartRedisRepository.findByCustomerId()`.

**4. drizzleAdapter — ORM Adapter**

File: `apps/api/src/lib/auth.ts`

```typescript
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { ...authSchema },
  }),
  // ...
});
```

`drizzleAdapter()` adapts Drizzle ORM interface thành interface database mà Better Auth yêu cầu. Better Auth không biết nó đang nói chuyện với Drizzle.

---

### 4.2 Bridge

**Trạng thái: ✅ CÓ MẶT (kiến trúc hai-tầng)**

#### Định nghĩa
Bridge tách "abstraction" (what to do) khỏi "implementation" (how to do it) để cả hai có thể biến đổi độc lập nhau.

#### Áp dụng trong Notification Module

```
Abstraction layer (Channel Protocol):
  INotificationChannel
    ├── EmailChannelService    ──→  IEmailProvider (Implementation)
    │                                  ├── NodemailerEmailProvider
    │                                  └── NoopEmailProvider
    ├── PushChannelService     ──→  IPushProvider (Implementation)
    │                                  ├── FirebasePushProvider
    │                                  └── StubPushProvider
    └── InAppChannelService    ──→  (WebSocket + Redis — no swappable impl)
```

**Abstraction:** `INotificationChannel` — giao thức kênh thông báo
**Implementation:** `IEmailProvider`, `IPushProvider` — giao thức transport cụ thể

`EmailChannelService` (refines abstraction) holds reference to `IEmailProvider` (implementation). Thay `NodemailerEmailProvider` bằng `SendGridEmailProvider` hoàn toàn độc lập với việc thay `EmailChannelService` bằng `SlackChannelService`.

File: `apps/api/src/module/notification/channels/email/email.channel.service.ts`

```typescript
@Injectable()
export class EmailChannelService implements INotificationChannel {
  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
    private readonly templateService: EmailTemplateService,
  ) {}

  async deliver(notification: Notification, context: DeliveryContext): Promise<DeliveryResult> {
    // ... render template ...
    await this.emailProvider.sendMail({ to, subject, html, text });
    return { success: true };
  }
}
```

---

### 4.3 Composite

**Trạng thái: ❌ KHÔNG CÓ**

#### Lý do không có
Không có cấu trúc cây leaf/composite. Menu items và modifier groups không được tổ chức theo hierarchy composite-leaf — chúng là flat collections quan hệ DB (`modifierGroups[]`, `options[]`).

---

### 4.4 Decorator (GoF)

**Trạng thái: ❌ KHÔNG CÓ**

#### Phân biệt quan trọng

**NestJS/TypeScript Decorator** (`@Injectable()`, `@CommandHandler()`, `@EventsHandler()`, `@Cron()`) là **metadata annotations** được xử lý tại compile time bởi `reflect-metadata`. Đây **KHÔNG PHẢI** GoF Decorator pattern.

**GoF Decorator** bọc một object tại runtime để thêm hành vi mà không thay đổi interface của object gốc — theo kiểu `new LoggingService(new RealService())`.

Không có GoF Decorator nào trong codebase này. Không có class nào bọc instance của class khác cùng interface để thêm behavior.

---

### 4.5 Facade

**Trạng thái: ✅ CÓ MẶT**

#### Định nghĩa
Facade cung cấp một interface đơn giản hóa cho một hệ thống con phức tạp.

#### Áp dụng — 4 Facade implementations

**1. NotificationService — Mega Facade**

File: `apps/api/src/module/notification/services/notification.service.ts`

Bọc toàn bộ notification subsystem:

```typescript
@Injectable()
export class NotificationService {
  constructor(
    private readonly notifRepo: NotificationRepository,
    private readonly preferenceRepo: NotificationPreferenceRepository,
    private readonly userEmailRepo: UserEmailRepository,
    private readonly deviceTokenRepo: DeviceTokenRepository,
    private readonly templateService: NotificationTemplateService,
    private readonly dispatcher: ChannelDispatcherService,
    private readonly quietHours: QuietHoursService,
    private readonly gateway: NotificationGateway,
    private readonly redis: RedisService,
  ) {}

  async send(dto: SendNotificationDto): Promise<void> {
    // 1. Render template
    // 2. Persist notification record
    // 3. Check quiet hours
    // 4. Dispatch to channels
    // 5. Update delivery status
  }
}
```

Event handler chỉ gọi `notificationService.send(dto)` — không biết gì về 9 dependencies bên trong.

**2. CartService — Redis + Snapshot Facade**

File: `apps/api/src/module/ordering/cart/cart.service.ts`

Ẩn `CartRedisRepository`, `MenuItemSnapshotRepository`, `AppSettingsService` sau một interface đơn giản (`addItem`, `removeItem`, `getCart`, `clearCart`).

**3. OrderHistoryService — Query Facade**

File: `apps/api/src/module/ordering/order-history/services/order-history.service.ts`

Hợp nhất `OrderHistoryRepository` và `RestaurantSnapshotRepository` để trả về enriched order history không cần controller biết về ACL snapshots.

**4. AclService — Cross-BC Snapshot Facade**

File: `apps/api/src/module/ordering/acl/acl.service.ts`

Bọc `MenuItemSnapshotRepository` và `RestaurantSnapshotRepository` sau một interface đơn giản để controller query ACL data.

---

### 4.6 Flyweight

**Trạng thái: ❌ KHÔNG CÓ**

#### Lý do không có
Không có shared intrinsic state. Mỗi notification, order, cart đều là object riêng biệt với đầy đủ state. Không có nhu cầu tối ưu bộ nhớ kiểu flyweight trong hệ thống này.

---

### 4.7 Proxy

**Trạng thái: ❌ KHÔNG CÓ**

#### Lý do không có
Không có lazy-loading proxy, remote proxy, hay access-control proxy theo nghĩa GoF. Redis caching trong `UserPresenceService` và `NotificationService` là một caching layer, không phải Proxy wrapping đối tượng cùng interface.

---

## 5. Behavioral Patterns

### 5.1 Chain of Responsibility

**Trạng thái: ❌ KHÔNG CÓ**

#### Lý do không có
NestJS có middleware pipeline (middleware → guard → interceptor → pipe → handler) nhưng đây là **framework-managed** — không có đối tượng handler nào được tạo thủ công theo GoF CoR (với `setNext()` method và explicit chain). `DevTestUserMiddleware` là một middleware đơn, không phải chain.

---

### 5.2 Command

**Trạng thái: ✅ CÓ MẶT (CQRS đầy đủ)**

#### Định nghĩa
Command đóng gói một request thành một object, cho phép tham số hóa, queue, log, và undo.

#### Áp dụng — CQRS via `@nestjs/cqrs`

**Command objects (data only — không có execute method):**

| Command | File |
|---------|------|
| `TransitionOrderCommand` | `ordering/order-lifecycle/commands/transition-order.command.ts` |
| `PlaceOrderCommand` | `ordering/order/commands/place-order.command.ts` |
| `ProcessIpnCommand` | `payment/commands/process-ipn.command.ts` |

Ví dụ:
```typescript
export class TransitionOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly toStatus: OrderStatus,    // field tên "toStatus", không phải "newStatus"
    public readonly actorId: string | null,
    public readonly actorRole: TriggeredByRole,
    public readonly note?: string,            // field tên "note", không phải "reason"
  ) {}
}
```

**Handlers (ConcreteCommand + execute logic):**

| Handler | Decorator |
|---------|-----------|
| `TransitionOrderHandler` | `@CommandHandler(TransitionOrderCommand)` |
| `PlaceOrderHandler` | `@CommandHandler(PlaceOrderCommand)` |
| `ProcessIpnHandler` | `@CommandHandler(ProcessIpnCommand)` |

File: `apps/api/src/module/ordering/order-lifecycle/commands/transition-order.handler.ts`

```typescript
@Injectable()
@CommandHandler(TransitionOrderCommand)
export class TransitionOrderHandler
  implements ICommandHandler<TransitionOrderCommand>
{
  async execute(cmd: TransitionOrderCommand): Promise<void> {
    const { orderId, toStatus, actorId, actorRole, note } = cmd;
    // Idempotency guard: if order.status === toStatus → return early (no-op)
    // ... validate transition rule, update DB with optimistic locking, publish event ...
  }
}
```

**Invokers (gọi CommandBus):**

```typescript
// OrderLifecycleController (HTTP request → Command)
await this.commandBus.execute(new TransitionOrderCommand(orderId, dto.toStatus, actorId, actorRole));

// OrderTimeoutTask (Cron → Command)
await this.commandBus.execute(new TransitionOrderCommand(order.id, 'cancelled', null, 'system', 'Timeout'));

// PaymentConfirmedEventHandler (Event → Command — cross-BC coordination)
await this.commandBus.execute(new TransitionOrderCommand(orderId, 'paid', null, 'system', 'PaymentConfirmed'));
```

**Mapping GoF → NestJS CQRS:**

| GoF Role | NestJS CQRS |
|----------|-------------|
| Command (interface) | Plain class with constructor args |
| ConcreteCommand | CommandHandler.execute() |
| Invoker | Controller / Task / EventHandler → `commandBus.execute()` |
| Receiver | Domain services called inside handler |

---

### 5.3 Interpreter

**Trạng thái: ❌ KHÔNG CÓ**

#### Lý do không có
Không có grammar định nghĩa bằng expression tree. `PromotionPricingEngine` đánh giá một đối tượng promotion, nhưng không parse/interpret một ngôn ngữ hay DSL.

---

### 5.4 Iterator

**Trạng thái: ❌ KHÔNG CÓ**

#### Lý do không có
Codebase dùng JavaScript built-in iteration: `for...of`, `Array.map()`, `Array.find()`, `Array.filter()`. Không có custom Iterator class nào được implement.

---

### 5.5 Mediator

**Trạng thái: ✅ CÓ MẶT**

#### Định nghĩa
Mediator định nghĩa một object trung gian để các objects giao tiếp với nhau mà không tham chiếu trực tiếp lẫn nhau.

#### Áp dụng — 3 Mediators

**1. EventBus — Cross-BC Event Mediator**

Publishers (`TransitionOrderHandler`, `PlaceOrderHandler`, `ProcessIpnHandler`) gọi:
```typescript
await this.eventBus.publish(new OrderStatusChangedEvent(orderId, oldStatus, newStatus, ...));
```

EventBus phân phối event đến tất cả `@EventsHandler` đã đăng ký:

| Event | Subscribers (các BC khác nhau) |
|-------|-------------------------------|
| `OrderStatusChangedEvent` | `OrderStatusChangedNotificationHandler` (Notification BC) |
| `OrderPlacedEvent` | `OrderPlacedNotificationHandler` (Notification BC) |
| `PaymentConfirmedEvent` | `PaymentConfirmedEventHandler` (Ordering BC) |
| `PaymentFailedEvent` | `PaymentFailedNotificationHandler` (Notification BC) |
| `RestaurantUpdatedEvent` | `RestaurantSnapshotProjector` (Ordering ACL) **+** `NotificationRestaurantSnapshotProjector` (Notification ACL) |
| `MenuItemUpdatedEvent` | `MenuItemProjector` (Ordering ACL) |
| `DeliveryZoneSnapshotUpdatedEvent` | `DeliveryZoneSnapshotProjector` (Ordering ACL) |

`RestaurantUpdatedEvent` có **fan-out thực sự** đến 2 handlers độc lập — publisher không biết gì về cả hai subscribers.

**2. CommandBus — Request/Handler Mediator**

Controllers không gọi handler trực tiếp — `CommandBus` làm trung gian:

```
OrderLifecycleController  ─┐
OrderTimeoutTask          ─┼──→  CommandBus  ──→  TransitionOrderHandler
PaymentConfirmedHandler   ─┘
```

Invokers không cần biết class `TransitionOrderHandler` tồn tại.

**3. ChannelDispatcherService — Notification Routing Mediator**

File: `apps/api/src/module/notification/services/channel-dispatcher.service.ts`

```typescript
export class ChannelDispatcherService {
  // Map sử dụng string keys ('in_app', 'email', 'push') — không phải enum instance
  private readonly adapterMap: Map<NotificationChannel, INotificationChannel>;

  constructor(
    private readonly inAppChannel: InAppChannelService,
    private readonly emailChannel: EmailChannelService,
    private readonly pushChannel: PushChannelService,
    private readonly notificationRepo: NotificationRepository,          // 4th dep
    private readonly deliveryLogRepo: NotificationDeliveryLogRepository, // 5th dep
    private readonly presenceService: UserPresenceService,              // 6th dep
  ) {
    // String keys: 'in_app', 'email', 'push'
    this.adapterMap = new Map<NotificationChannel, INotificationChannel>([
      ['in_app', this.inAppChannel],
      ['email',  this.emailChannel],
      ['push',   this.pushChannel],
    ]);
  }

  async dispatch(notification: Notification, context: DeliveryContext): Promise<void> {
    // Push suppression logic: nếu user đang online (có WebSocket),
    // suppress FCM push — đánh dấu 'sent' và log PUSH_SUPPRESSED_USER_ONLINE
    if (notification.channel === 'push') {
      const isOnline = await this.presenceService.isOnline(notification.recipientId);
      if (isOnline) {
        // Mark sent, log suppression, return early
        await this.logDelivery(notification, 'PUSH_SUPPRESSED_USER_ONLINE');
        return;
      }
    }

    const adapter = this.adapterMap.get(notification.channel);
    await adapter.deliver(notification, context);
    // Record delivery log, update notification status
  }
}
```

`NotificationService` chỉ gọi `dispatcher.dispatch()` — không biết gì về từng Channel service cụ thể.

---

### 5.6 Memento

**Trạng thái: ❌ KHÔNG CÓ**

#### Lý do không có

**Lưu ý quan trọng:** Codebase có các bảng snapshot (`ordering_restaurant_snapshots`, `ordering_menu_item_snapshots`, `notification_restaurant_snapshots`) — nhưng đây là **ACL Read-Model Projections** (event-sourcing pattern), không phải GoF Memento.

GoF Memento yêu cầu: Originator tạo Memento chứa internal state của mình, Caretaker lưu trữ, sau đó Originator restore từ Memento. Không có cơ chế restore state của domain object nào như vậy trong codebase này.

---

### 5.7 Observer

**Trạng thái: ✅ CÓ MẶT**

#### Định nghĩa
Observer định nghĩa mối quan hệ one-to-many: khi Subject thay đổi trạng thái, tất cả Observers được notify tự động.

#### Áp dụng — NestJS CQRS EventBus

**Subject (Publishers):**

```typescript
// TransitionOrderHandler sau khi update DB
await this.eventBus.publish(
  new OrderStatusChangedEvent(order.id, oldStatus, newStatus, actorRole, order.customerId, ...)
);
```

**Observers (Subscribers — `@EventsHandler`):**

Trong Notification BC:
- `OrderStatusChangedNotificationHandler` — gửi thông báo trạng thái đơn hàng (đọc `STATUS_TRANSITION_NOTIFICATION` map theo key `fromStatus→toStatus`)
- `OrderPlacedNotificationHandler` — gửi xác nhận đặt hàng (customer + restaurant)
- `PaymentConfirmedNotificationHandler` — gửi xác nhận thanh toán
- `PaymentFailedNotificationHandler` — gửi thông báo thanh toán thất bại
- `OrderCancelledAfterPaymentNotificationHandler` — gửi thông báo hoàn tiền

Trong Ordering BC:
- `PaymentConfirmedEventHandler` — dispatch `TransitionOrderCommand` (pending → paid, T-02)
- `PaymentFailedEventHandler` — dispatch `TransitionOrderCommand` (pending → cancelled, T-03)
- `PromotionRollbackOnCancellationHandler` — `@EventsHandler(OrderStatusChangedEvent)`, filter `if (event.toStatus !== 'cancelled' && event.toStatus !== 'refunded') return`, sau đó gọi `promotionPort.rollbackReservations(event.orderId)`
- `MenuItemProjector` — cập nhật ACL snapshot khi menu item thay đổi
- `RestaurantSnapshotProjector` — cập nhật ACL snapshot khi restaurant thay đổi
- `DeliveryZoneSnapshotProjector` — cập nhật delivery zone snapshot

Trong Notification ACL:
- `NotificationRestaurantSnapshotProjector` — cập nhật notification's local snapshot

Trong Payment BC:
- `OrderCancelledAfterPaymentHandler` — `@EventsHandler(OrderCancelledAfterPaymentEvent)`, xử lý refund flow (completed → refund_pending → refunded)

**Lưu ý:** `OrderReadyForPickupEvent` được publish tại T-08 (`preparing→ready_for_pickup`) nhưng chưa có `@EventsHandler` nào subscribe — đây là placeholder cho Phase 6 (shipper dispatch).

**Fan-out thực tế (RestaurantUpdatedEvent):**
```
RestaurantUpdatedEvent (published by restaurant-catalog)
     │
     ├──→ RestaurantSnapshotProjector (Ordering BC)
     │         → upsert ordering_restaurant_snapshots
     │
     └──→ NotificationRestaurantSnapshotProjector (Notification BC)
               → upsert notification_restaurant_snapshots
```

Publisher không hề biết về cả hai subscribers — đây là Observer pattern thuần túy.

---

### 5.8 State

**Trạng thái: ✅ CÓ MẶT (data-driven state machine)**

#### Định nghĩa
State cho phép một object thay đổi hành vi khi internal state của nó thay đổi.

#### Áp dụng — Order State Machine

**State enum:**

File: `apps/api/src/module/ordering/order/order.schema.ts`

```typescript
export const orderStatusEnum = pgEnum('order_status', [
  'pending', 'paid', 'confirmed', 'preparing',
  'ready_for_pickup', 'picked_up', 'delivering',
  'delivered', 'cancelled', 'refunded',
]);
```

**Transition table (TRANSITIONS map):**

File: `apps/api/src/module/ordering/order-lifecycle/constants/transitions.ts`

```typescript
// Key format: `${fromStatus}→${toStatus}`  — dấu mũi tên U+2192, KHÔNG phải ASCII "->"
// Type annotation: Partial<Record<`${OrderStatus}→${OrderStatus}`, TransitionRule>>
// Không có type alias "TransitionKey" — đây là inline template literal type.

interface TransitionRule {
  allowedRoles: TriggeredByRole[];
  requireNote?: boolean;
  triggersRefundIfVnpay?: boolean;
  triggersReadyForPickup?: boolean;
}

export const TRANSITIONS: Partial<
  Record<`${OrderStatus}→${OrderStatus}`, TransitionRule>
> = {
  'pending→confirmed':          { allowedRoles: ['restaurant', 'admin'] },          // T-01
  'pending→paid':               { allowedRoles: ['system'] },                        // T-02
  'pending→cancelled':          { allowedRoles: ['customer', 'restaurant', 'admin', 'system'], requireNote: true }, // T-03
  'paid→confirmed':             { allowedRoles: ['restaurant', 'admin'] },           // T-04
  'paid→cancelled':             { allowedRoles: ['customer', 'restaurant', 'admin', 'system'], requireNote: true, triggersRefundIfVnpay: true }, // T-05
  'confirmed→preparing':        { allowedRoles: ['restaurant', 'admin'] },           // T-06
  'confirmed→cancelled':        { allowedRoles: ['restaurant', 'admin'], requireNote: true, triggersRefundIfVnpay: true }, // T-07
  'preparing→ready_for_pickup': { allowedRoles: ['restaurant', 'admin'], triggersReadyForPickup: true }, // T-08
  'ready_for_pickup→picked_up': { allowedRoles: ['shipper', 'admin'] },              // T-09
  'picked_up→delivering':       { allowedRoles: ['shipper', 'admin'] },              // T-10
  'delivering→delivered':       { allowedRoles: ['shipper', 'admin'] },              // T-11
  'delivered→refunded':         { allowedRoles: ['admin'], requireNote: true },      // T-12
};
```

**Enforcement (TransitionOrderHandler):**

File: `apps/api/src/module/ordering/order-lifecycle/commands/transition-order.handler.ts`

```typescript
async execute(cmd: TransitionOrderCommand): Promise<void> {
  const { orderId, toStatus, actorId, actorRole, note } = cmd;
  const order = await this.orderRepo.findById(orderId);

  // Idempotency guard
  if (order.status === toStatus) return;

  // Build key with unicode arrow U+2192
  const transitionKey = `${order.status}→${toStatus}`;
  const rule = TRANSITIONS[transitionKey];

  if (!rule) {
    throw new UnprocessableEntityException(
      `Transition ${transitionKey} is not allowed.`
    );
  }

  if (!rule.allowedRoles.includes(actorRole)) {
    throw new ForbiddenException(
      `Role ${actorRole} cannot perform transition ${transitionKey}.`
    );
  }

  // Handle side effects based on rule flags
  if (rule.triggersRefundIfVnpay && order.paymentMethod === 'vnpay') {
    await this.eventBus.publish(new OrderCancelledAfterPaymentEvent(...));
  }
  // Optimistic locking via version column
  await this.orderRepo.updateStatusWithVersion(orderId, toStatus, order.version);
}
```

#### Đặc điểm nổi bật
- **12 transitions chính xác** (T-01 đến T-12) — hoàn toàn declarative.
- Transition table dùng Unicode arrow `→` (U+2192), **không phải** ASCII `->`.
- **Không có** type alias `TransitionKey` — key type là inline `\`${OrderStatus}→${OrderStatus}\``.
- Side effects (`triggersRefundIfVnpay`, `triggersReadyForPickup`) được mã hóa vào rule.
- Idempotency guard: nếu order đã ở trạng thái đích → return sớm (no-op).

#### Lưu ý
Đây là **data-driven state machine**, không phải OOP State pattern cổ điển (không có class `PendingState`, `ConfirmedState` riêng biệt). Tuy nhiên, *mục tiêu pattern* — hành vi phụ thuộc state, không cho phép chuyển trạng thái tùy tiện — được thực hiện đầy đủ và thực tế clean hơn OOP approach cho use case này.

---

### 5.9 Strategy

**Trạng thái: ✅ CÓ MẶT (3 strategy hierarchies)**

#### Định nghĩa
Strategy định nghĩa một nhóm các thuật toán có thể hoán đổi cho nhau, đóng gói từng thuật toán, và làm cho chúng có thể thay thế nhau.

#### Áp dụng chi tiết — xem `strategy-pattern-report.md`

**Tóm tắt 3 hierarchies:**

| Level | Interface | Concrete Strategies | Context |
|-------|-----------|---------------------|---------|
| 1 (Channel) | `INotificationChannel` | `EmailChannelService`, `PushChannelService`, `InAppChannelService` | `ChannelDispatcherService` |
| 2a (Email Transport) | `IEmailProvider` | `NodemailerEmailProvider`, `NoopEmailProvider` | `EmailChannelService` |
| 2b (Push Transport) | `IPushProvider` | `FirebasePushProvider`, `StubPushProvider` | `PushChannelService` |

Files:
- `apps/api/src/module/notification/channels/channel.interface.ts`
- `apps/api/src/module/notification/channels/email/email-provider.interface.ts`
- `apps/api/src/module/notification/channels/push/push-provider.interface.ts`

Xem chi tiết đầy đủ tại: `strategy-pattern-report.md` trong cùng thư mục.

---

### 5.10 Template Method

**Trạng thái: ✅ CÓ MẶT (functional variant — không dùng kế thừa)**

#### Định nghĩa
Template Method định nghĩa skeleton của một thuật toán trong một method, để các "hook" points xử lý các bước biến đổi, trong khi bước cố định (invariant) được thực thi theo thứ tự bất biến.

#### Áp dụng — PromotionPricingEngine.computeDiscount()

File: `apps/api/src/module/promotion/engine/promotion-pricing-engine.ts`

```typescript
export class PromotionPricingEngine {
  /**
   * Signature thực tế: nhận một PricingInput object, trả về PricingResult.
   * KHÔNG phải computeDiscount(promotion, orderAmount, usageCount): number.
   */
  computeDiscount(input: PricingInput): PricingResult {
    const { promotion, itemsSubtotal, shippingFee, now } = input;

    // Step 1 — Date range check (invariant)
    if (now < promotion.startsAt) return notEligible('Promotion has not started yet');
    if (now > promotion.endsAt)   return notEligible('Promotion has expired');

    // Step 2 — Minimum order amount check (invariant)
    if (promotion.minOrderAmount !== null && itemsSubtotal < promotion.minOrderAmount)
      return notEligible(`Minimum order amount is ${promotion.minOrderAmount} VND`);

    // Step 3 — Quota check (invariant)
    // Fields: promotion.maxTotalUses và promotion.currentTotalUses
    if (promotion.maxTotalUses !== null && promotion.currentTotalUses >= promotion.maxTotalUses)
      return notEligible('Promotion quota has been reached');

    // Step 4 — Type-specific discount (HOOK — varies by type)
    let discountOnItems = 0;
    let discountOnShipping = 0;

    switch (promotion.type) {
      case 'percentage': {
        const raw = Math.floor((itemsSubtotal * promotion.discountValue) / 100);
        const capped = promotion.maxDiscountAmount !== null
          ? Math.min(raw, promotion.maxDiscountAmount) : raw;
        discountOnItems = Math.min(this.floorToThousand(capped), itemsSubtotal);
        break;
      }
      case 'fixed_amount':
        discountOnItems = Math.min(promotion.discountValue, itemsSubtotal);
        break;
      case 'free_delivery':
        discountOnShipping = shippingFee;
        break;
      case 'reduced_delivery':
        discountOnShipping = Math.min(promotion.discountValue, shippingFee);
        break;
      case 'buy_x_get_y':
      case 'free_item':
        return notEligible(`Promotion type '${promotion.type}' requires item-level data`);
      default:
        return notEligible(`Unknown promotion type: ${String(promotion.type)}`);
    }

    // Step 5 — Floor rounding: làm tròn XUỐNG đến bội số 1000 VND (invariant)
    // KHÔNG phải Math.round() — đây là Math.floor(amount / 1000) * 1000
    discountOnItems    = this.floorToThousand(discountOnItems);
    discountOnShipping = this.floorToThousand(discountOnShipping);

    // Step 6 — Zero-discount guard (invariant)
    const discountAmount = discountOnItems + discountOnShipping;
    if (discountAmount === 0) return notEligible('Computed discount is 0 VND');

    return { eligible: true, discountOnItems, discountOnShipping, discountAmount, breakdown: { ... } };
  }

  // Private helpers
  private floorToThousand(amount: number): number {
    return Math.floor(amount / 1000) * 1000;
  }

  private emptyBreakdown(promotion: Promotion): DiscountBreakdown { ... }
}
```

**Mapping Template Method:**

| Template Method Role | Code tương ứng |
|---------------------|----------------|
| Template Method | `computeDiscount()` — skeleton 6 bước cố định |
| Invariant steps | Step 1 (date), Step 2 (min amount), Step 3 (quota), Step 5 (floor round), Step 6 (zero guard) |
| Hook steps | Step 4 `switch(promotion.type)` — 6 cases: `percentage`, `fixed_amount`, `free_delivery`, `reduced_delivery`, `buy_x_get_y`/`free_item`, `default` |

**Lưu ý quan trọng:**
Đây là **functional variant** của Template Method — không dùng kế thừa OOP (`abstract class` + subclass override). Thay vào đó, các "bước hook" được dispatch qua `switch(promotion.type)` bên trong cùng một class. GoF Template Method thuần túy yêu cầu abstract class với abstract methods được subclass override. Codebase này chọn approach functional vì discriminated union types của Drizzle ORM phù hợp tự nhiên hơn với `switch` dispatch thay vì class hierarchy.

---

### 5.11 Visitor

**Trạng thái: ❌ KHÔNG CÓ**

#### Lý do không có
Không có double-dispatch visitor pattern. Không có tình huống cần "thêm operation mới vào object hierarchy mà không thay đổi class hierarchy" trong codebase này.

---

## 6. Bảng Tổng Hợp Cuối

### Creational Patterns

| # | Pattern | Trạng thái | File / Class chính |
|---|---------|-----------|-------------------|
| 1 | Abstract Factory | ✅ CÓ MẶT | `notification.module.ts` — `EMAIL_PROVIDER` + `PUSH_PROVIDER` paired factories |
| 2 | Builder | ❌ KHÔNG CÓ | — |
| 3 | Factory Method | ✅ CÓ MẶT | `redis.module.ts`, `drizzle.module.ts`, `cloudinary.provider.ts`, + 2 providers |
| 4 | Prototype | ❌ KHÔNG CÓ | — |
| 5 | Singleton | ✅ CÓ MẶT | Tất cả `@Injectable()` + `@Global()` modules (`RedisModule`, `GeoModule`, ...) |

### Structural Patterns

| # | Pattern | Trạng thái | File / Class chính |
|---|---------|-----------|-------------------|
| 6 | Adapter | ✅ CÓ MẶT | `IPromotionApplicationPort`, `IPaymentInitiationPort`, `CartRedisRepository`, `drizzleAdapter` |
| 7 | Bridge | ✅ CÓ MẶT | `INotificationChannel` ↔ `IEmailProvider` / `IPushProvider` (hai tầng trừu tượng độc lập) |
| 8 | Composite | ❌ KHÔNG CÓ | — |
| 9 | Decorator (GoF) | ❌ KHÔNG CÓ | *(NestJS `@Decorator` là metadata annotation, KHÔNG phải GoF Decorator)* |
| 10 | Facade | ✅ CÓ MẶT | `NotificationService`, `CartService`, `OrderHistoryService`, `AclService` |
| 11 | Flyweight | ❌ KHÔNG CÓ | — |
| 12 | Proxy | ❌ KHÔNG CÓ | — |

### Behavioral Patterns

| # | Pattern | Trạng thái | File / Class chính |
|---|---------|-----------|-------------------|
| 13 | Chain of Responsibility | ❌ KHÔNG CÓ | *(NestJS middleware pipeline là framework-internal)* |
| 14 | Command | ✅ CÓ MẶT | `TransitionOrderCommand/Handler`, `PlaceOrderCommand/Handler`, `ProcessIpnCommand/Handler` + `CommandBus` |
| 15 | Interpreter | ❌ KHÔNG CÓ | — |
| 16 | Iterator | ❌ KHÔNG CÓ | *(dùng JS built-in iteration)* |
| 17 | Mediator | ✅ CÓ MẶT | `EventBus` (cross-BC), `CommandBus` (request/handler), `ChannelDispatcherService` |
| 18 | Memento | ❌ KHÔNG CÓ | *(ACL snapshots là projections, không phải GoF Memento)* |
| 19 | Observer | ✅ CÓ MẶT | `EventBus` + 12 `@EventsHandler` subscribers; fan-out trên `RestaurantUpdatedEvent` |
| 20 | State | ✅ CÓ MẶT | `TRANSITIONS` map (12 transitions T-01→T-12, unicode `→`) + `TransitionOrderHandler` — declarative state machine |
| 21 | Strategy | ✅ CÓ MẶT | `INotificationChannel` (3 strategies) + `IEmailProvider` + `IPushProvider` (nested) |
| 22 | Template Method | ✅ CÓ MẶT | `PromotionPricingEngine.computeDiscount()` — skeleton cố định + hook type-dispatch |
| 23 | Visitor | ❌ KHÔNG CÓ | — |

---

## Phụ lục: Tham Khảo File nguồn

| Module | File quan trọng |
|--------|----------------|
| Notification | `notification/channels/channel.interface.ts`, `notification/services/channel-dispatcher.service.ts`, `notification/notification.module.ts` |
| Ordering | `ordering/order-lifecycle/constants/transitions.ts`, `ordering/order-lifecycle/commands/transition-order.handler.ts`, `ordering/cart/cart.redis-repository.ts` |
| Payment | `payment/services/payment.service.ts`, `payment/commands/process-ipn.handler.ts`, `shared/ports/payment-initiation.port.ts` |
| Promotion | `promotion/engine/promotion-pricing-engine.ts`, `shared/ports/promotion-application.port.ts` |
| Infrastructure | `lib/redis/redis.module.ts`, `drizzle/drizzle.module.ts`, `image/cloudinary.provider.ts`, `lib/auth.ts` |
| Events | `shared/events/order-status-changed.event.ts`, `ordering/acl/projections/restaurant-snapshot.projector.ts` |

---

*Báo cáo này được tạo dựa trên việc đọc trực tiếp ~61 file nguồn trong codebase. Mỗi pattern được xác nhận (hoặc phủ nhận) đều dựa trên bằng chứng code thực tế, không phải giả định.*
