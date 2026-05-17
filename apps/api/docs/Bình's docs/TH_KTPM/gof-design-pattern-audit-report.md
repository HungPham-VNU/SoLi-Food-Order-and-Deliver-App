# Báo Cáo Kiểm Tra Toàn Diện: 23 GoF Design Patterns trong NestJS Backend

**Dự án:** SoLi Food Delivery — NestJS Backend
**Phiên bản:** 1.2 (academic rigor re-audit — defensible final version)
**Ngày:** 2026-05-16
**Kiểm tra bởi:** GitHub Copilot (Claude Sonnet 4.6)
**Phương pháp:** Đọc toàn bộ ~61 file nguồn; xác minh từng pattern bằng bằng chứng code thực tế.

---

## Phương Pháp Phân Loại

Mỗi pattern được phân loại theo thang đo sau để đảm bảo tính chính xác học thuật:

| Nhãn | Ý nghĩa |
|------|---------|
| **✅ CANONICAL GoF** | Khớp hoàn toàn với định nghĩa textbook: đúng participants, đúng cơ chế runtime |
| **✅ FRAMEWORK-ASSISTED VARIANT** | Pattern GoF hiện diện nhưng được thực thi qua framework tooling thay vì code thuần |
| **⚠️ ARCHITECTURAL EQUIVALENT** | Đạt được intent của GoF qua cơ chế khác — không phải canonical, nhưng đứng vững |
| **⚠️ PARTIAL RESEMBLANCE** | Có một số đặc điểm GoF nhưng thiếu participants hoặc cơ chế quan trọng |
| **❌ KHÔNG CÓ** | Pattern không hiện diện trong codebase |

> **Lưu ý học thuật:** Báo cáo này phân biệt rõ ràng giữa *canonical GoF* (theo định nghĩa của Gang of Four, 1994) và *architectural equivalent* (đạt ý tưởng pattern qua cách tiếp cận hiện đại/framework). Điều này rất quan trọng để tránh overclain trong bảo vệ học thuật.

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
| Behavioral | 11 | 5 | 6 |
| **Tổng** | **23** | **12** | **11** |

> **So với v1.1:** Template Method bị downgrade ❌ sau re-audit (không có abstract class + subclass override). Tổng còn 12 patterns hiện diện.

**Phân loại chi tiết 12 patterns có mặt:**

| Classification | Patterns | Số lượng |
|----------------|----------|----------|
| ✅ CANONICAL GoF | Facade, Adapter (2 canonical), Strategy | 3 |
| ✅ FRAMEWORK-ASSISTED CANONICAL | Command, Observer, Mediator (EventBus+CommandBus) | 3 |
| ✅ FRAMEWORK-ASSISTED VARIANT | Singleton | 1 |
| ⚠️ ARCHITECTURAL EQUIVALENT | Abstract Factory, State | 2 |
| ⚠️ FRAMEWORK-ASSISTED FUNCTIONAL EQUIVALENT | Factory Method | 1 |
| ⚠️ STRUCTURAL EQUIVALENT | Bridge | 1 |

**12 patterns được xác nhận** với bằng chứng file/class cụ thể.
**11 patterns không xuất hiện** với giải thích lý do.

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

**Trạng thái: ⚠️ ARCHITECTURAL EQUIVALENT (NOT canonical GoF — không có AbstractFactory interface/class)**

#### Định nghĩa GoF
Abstract Factory cung cấp một **interface** duy nhất để tạo ra các *gia đình* đối tượng có liên quan. GoF yêu cầu:
- `AbstractFactory` interface/class với nhiều `createProductA()`, `createProductB()` methods
- `ConcreteFactory1`, `ConcreteFactory2` implement `AbstractFactory`
- Client chỉ làm việc với `AbstractFactory` — không biết concrete factory nào đang dùng

#### Áp dụng trong codebase

`NotificationModule` có hai factory provider tạo ra một cặp sản phẩm liên quan (email transport + push transport) sử dụng cùng điều kiện môi trường:

**File:** `apps/api/src/module/notification/notification.module.ts`

```typescript
// Factory 1 — Email Provider (NestJS useFactory)
{
  provide: EMAIL_PROVIDER,
  useFactory: (configService: ConfigService) => {
    const smtpHost = configService.get<string>('SMTP_HOST');
    if (smtpHost && process.env.NODE_ENV !== 'test') {
      return new NodemailerEmailProvider(configService); // production
    }
    return new NoopEmailProvider(); // test/dev
  },
  inject: [ConfigService],
},

// Factory 2 — Push Provider (NestJS useFactory)
{
  provide: PUSH_PROVIDER,
  useFactory: (configService: ConfigService) => {
    const keyPath = configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    if (keyPath && process.env.NODE_ENV !== 'test') {
      return new FirebasePushProvider(keyPath); // production
    }
    return new StubPushProvider(); // test/dev
  },
  inject: [ConfigService],
},
```

| Sản phẩm | Production | Test/Dev |
|----------|------------|----------|
| `IEmailProvider` | `NodemailerEmailProvider` | `NoopEmailProvider` |
| `IPushProvider` | `FirebasePushProvider` | `StubPushProvider` |

Cả hai factory đều dùng cùng điều kiện: `smtpHost/keyPath !== null AND NODE_ENV !== 'test'` → hai sản phẩm trong cùng "gia đình" luôn nhất quán (production-production hoặc stub-stub).

#### ⚠️ Tại sao KHÔNG PHẢI canonical GoF Abstract Factory

| Tiêu chí GoF | Canonical GoF | Codebase này |
|--------------|---------------|--------------|
| `AbstractFactory` interface/class | Bắt buộc | **KHÔNG TỒN TẠI** |
| `ConcreteFactory1`, `ConcreteFactory2` | Bắt buộc | **KHÔNG TỒN TẠI** |
| Client dùng AbstractFactory interface | Bắt buộc | Client inject trực tiếp 2 token riêng lẻ |
| Unified factory creation point | Bắt buộc | Hai `useFactory` độc lập trong cùng module |

Hai `useFactory` functions KHÔNG share bất kỳ interface nào — đây là hai factory functions riêng lẻ được đặt cạnh nhau trong `providers[]` array, chia sẻ điều kiện môi trường theo convention, không theo cấu trúc GoF.

#### Kết luận
Pattern này đạt được **intent** của Abstract Factory (sản phẩm liên quan nhất quán theo môi trường) nhưng thông qua convention/module co-location thay vì cấu trúc OOP. Đây là **Architectural Equivalent** — defensible ở mức "pattern intent achieved," không ở mức "canonical GoF."

---

### 3.2 Builder

**Trạng thái: ❌ KHÔNG CÓ**

#### Lý do không có
- `CartService.addItem()` tích lũy `CartItem[]` qua các phép gán đơn giản, không xây dựng đối tượng phức tạp theo bước.
- `PlaceOrderHandler` tạo object đơn hàng theo kiểu literal object `{ id, customerId, ... }` — không có step-by-step builder API.
- Không có class nào có fluent interface kiểu `builder.setA(...).setB(...).build()`.

---

### 3.3 Factory Method

**Trạng thái: ⚠️ FRAMEWORK-ASSISTED FUNCTIONAL EQUIVALENT (NOT canonical GoF — không có Creator class hierarchy)**

#### Định nghĩa GoF
Factory Method định nghĩa một abstract method trong `Creator` class để tạo đối tượng, để `ConcreteCreator` subclass override và quyết định class nào được khởi tạo. GoF yêu cầu:
- `Creator` abstract class với `factoryMethod(): Product` (abstract hoặc có default)
- `ConcreteCreator1`, `ConcreteCreator2` override `factoryMethod()`
- `Creator.anOperation()` gọi `this.factoryMethod()` — inheritance-based deferred instantiation

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

#### ⚠️ Tại sao KHÔNG PHẢI canonical GoF Factory Method

| Tiêu chí GoF | Canonical GoF | Codebase này |
|--------------|---------------|--------------|
| `Creator` abstract class | Bắt buộc | **KHÔNG TỒN TẠI** |
| `factoryMethod()` abstract method | Bắt buộc | **KHÔNG TỒN TẠI** |
| `ConcreteCreator` subclass override | Bắt buộc | **KHÔNG TỒN TẠI** |
| Cơ chế | Inheritance-based polymorphism | Function-based factory |

Canonical GoF Factory Method đòi hỏi **kế thừa**: `ConcreteCreator` override `factoryMethod()` của `Creator`. Đây là "hook bằng inheritance." Codebase này dùng NestJS `useFactory` — đây là **factory function** được DI container gọi, không phải inheritance-based Factory Method.

#### Kết luận
Đây là **Functional Equivalent**: module đóng vai "Creator" (tập trung logic khởi tạo), consumer nhận object qua DI token mà không biết cách tạo. Intent đạt được, cơ chế khác GoF. Không có `Creator` class, không có `ConcreteCreator` subclass — đây là Factory Function pattern trong bối cảnh NestJS DI.

---

### 3.4 Prototype

**Trạng thái: ❌ KHÔNG CÓ**

#### Lý do không có
Không có nhu cầu clone đối tượng trong hệ thống này. Các domain object (cart, order) được tạo từ dữ liệu người dùng hoặc từ DB, không cần copy từ prototype có sẵn.

---

### 3.5 Singleton

**Trạng thái: ✅ FRAMEWORK-ASSISTED VARIANT (scope management by DI container)**

#### Định nghĩa GoF
Singleton đảm bảo một class chỉ có một instance duy nhất và cung cấp global access point đến instance đó. GoF implement qua: **private constructor + static `getInstance()` method** — class tự kiểm soát việc khởi tạo.

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

#### ⚠️ Canonical vs Framework-Assisted

| Tiêu chí GoF | Canonical GoF | Codebase này |
|--------------|---------------|--------------|
| Cơ chế kiểm soát | Class tự kiểm soát qua `private constructor + getInstance()` | **NestJS DI container** quản lý scope |
| Kết quả runtime | Một instance duy nhất | Một instance duy nhất |
| Thay thế được không | Không (class enforces) | Có thể override trong tests |

NestJS Singleton là **Framework-Assisted Variant** — kết quả giống GoF Singleton nhưng cơ chế khác. Đây là cách tiếp cận chuẩn trong enterprise DI frameworks (Spring, .NET DI, NestJS) và được chấp nhận rộng rãi trong thực tế.

---

## 4. Structural Patterns

### 4.1 Adapter

**Trạng thái: ✅ CÓ MẶT — 2 Canonical GoF Adapters + 2 Hexagonal Architecture Ports**

#### Định nghĩa GoF
Adapter cho phép interface không tương thích làm việc được với nhau bằng cách bọc một **Adaptee** (interface hiện có, không phù hợp) thành **Target** interface mà Client mong đợi. Yêu cầu: (1) có Adaptee với interface incompatible, (2) có Adapter wrap Adaptee, (3) Client chỉ dùng Target interface.

#### Nhóm 1: ✅ CANONICAL GoF Adapters

**1. CartRedisRepository — Redis Adapter**

File: `apps/api/src/module/ordering/cart/cart.redis-repository.ts`

Bọc `RedisService` (Adaptee — generic `get/set/del/scan` interface) thành cart-domain semantics (Target interface):

```typescript
@Injectable()
export class CartRedisRepository {
  constructor(private readonly redis: RedisService) {}  // wraps incompatible RedisService

  private buildKey(customerId: string): string {
    return `${CART_KEY_PREFIX}${customerId}`;
  }

  async findByCustomerId(customerId: string): Promise<Cart | null> {
    const raw = await this.redis.get(this.buildKey(customerId));  // raw Redis get
    return raw ? (JSON.parse(raw) as Cart) : null;                // adapts to domain type
  }

  async save(cart: Cart, ttlSeconds: number): Promise<void> {
    await this.redis.set(
      this.buildKey(cart.customerId),
      JSON.stringify(cart),           // adapts Cart object to Redis string
      'EX', ttlSeconds,
    );
  }
}
```

`CartService` (Client) không biết cart được lưu ở Redis — chỉ biết `findByCustomerId()`, `save()`.

**2. drizzleAdapter — ORM Adapter**

File: `apps/api/src/lib/auth.ts`

```typescript
export const auth = betterAuth({
  database: drizzleAdapter(db, {   // drizzleAdapter wraps Drizzle (Adaptee)
    provider: 'pg',
    schema,
  }),
});
```

`drizzleAdapter()` bọc Drizzle ORM's query interface (Adaptee) thành Better Auth's expected database interface (Target). Better Auth (Client) không biết nó đang nói chuyện với Drizzle.

**Mapping GoF Adapter:**

| GoF Role | CartRedisRepository | drizzleAdapter |
|----------|---------------------|----------------|
| Target | Cart domain interface | BetterAuth DB interface |
| Adaptee | `RedisService` (generic) | Drizzle ORM API |
| Adapter | `CartRedisRepository` | `drizzleAdapter()` function |
| Client | `CartService` | `betterAuth()` |

---

#### Nhóm 2: ⚠️ Hexagonal Architecture Ports (DIP — KHÔNG PHẢI GoF Adapter)

> **Lưu ý học thuật quan trọng:** `IPromotionApplicationPort` và `IPaymentInitiationPort` thường được mô tả là "Adapter" trong Hexagonal Architecture, nhưng chúng **KHÔNG PHẢI GoF Adapter**. GoF Adapter bọc một Adaptee có interface không tương thích. Ở đây, `PromotionService` và `PaymentService` **implement trực tiếp** interface mà không wrap bất kỳ incompatible interface nào.

**3. IPromotionApplicationPort — DIP Inversion Port**

File: `apps/api/src/shared/ports/promotion-application.port.ts`

```typescript
export const PROMOTION_APPLICATION_PORT = Symbol('PROMOTION_APPLICATION_PORT');

export interface IPromotionApplicationPort {
  previewDiscount(params: DiscountPreviewParams): Promise<DiscountPreviewResult>;
  computeAndReserveDiscount(params: DiscountReservationParams): Promise<DiscountReservationResult>;
  confirmReservations(orderId: string): Promise<void>;
  rollbackReservations(orderId: string): Promise<void>;
}
```

`PromotionService` implements `IPromotionApplicationPort` trực tiếp. `PlaceOrderHandler` inject `PROMOTION_APPLICATION_PORT` — không import `PromotionService`. Đây là **Dependency Inversion Principle** (DIP) / Hexagonal Architecture Port, không phải GoF Adapter vì không có Adaptee incompatible nào bị wrap.

**4. IPaymentInitiationPort — Anti-Circular DIP Port**

File: `apps/api/src/shared/ports/payment-initiation.port.ts`

```typescript
export const PAYMENT_INITIATION_PORT = Symbol('PAYMENT_INITIATION_PORT');

export interface IPaymentInitiationPort {
  initiateVNPayPayment(
    orderId: string, customerId: string,
    amount: number, ipAddr: string
  ): Promise<{ txnId: string; paymentUrl: string }>;
}
```

`PaymentService` implements `IPaymentInitiationPort` trực tiếp. Đây là port ngăn circular dependency giữa `OrderingModule` ↔ `PaymentModule` — pattern DIP, không phải GoF Adapter.

---

### 4.2 Bridge

**Trạng thái: ⚠️ STRUCTURAL EQUIVALENT (NOT canonical GoF — không có abstract Abstraction class với implementor reference)**

#### Định nghĩa GoF
Bridge tách "abstraction" khỏi "implementation" để cả hai có thể biến đổi độc lập. GoF yêu cầu:
- `Abstraction` **abstract class** với `protected Implementor impl;` reference
- `RefinedAbstraction` extends `Abstraction`
- `Implementor` interface
- `ConcreteImplementor` implements `Implementor`
- `Abstraction.operation()` delegates to `this.impl.operationImpl()`

#### Áp dụng trong Notification Module

```
Tầng Abstraction (Channel Protocol):
  INotificationChannel (interface)
    ├── EmailChannelService    ──→  IEmailProvider (Implementor interface)
    │   (RefinedAbstraction)           ├── NodemailerEmailProvider
    │                                  └── NoopEmailProvider
    ├── PushChannelService     ──→  IPushProvider (Implementor interface)
    │   (RefinedAbstraction)           ├── FirebasePushProvider
    │                                  └── StubPushProvider
    └── InAppChannelService    ──→  (WebSocket + Redis — no swappable implementor)
```

`EmailChannelService` (RefinedAbstraction) holds reference to `IEmailProvider` (Implementor) via DI injection. Thay `NodemailerEmailProvider` bằng `SendGridEmailProvider` hoàn toàn độc lập với việc thay `EmailChannelService` bằng `SlackChannelService`.

File: `apps/api/src/module/notification/channels/email/email.channel.service.ts`

```typescript
@Injectable()
export class EmailChannelService implements INotificationChannel {
  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,  // implementor ref via DI
    private readonly templateService: EmailTemplateService,
  ) {}

  async deliver(notification: Notification, context: DeliveryContext): Promise<DeliveryResult> {
    // ... render template ...
    await this.emailProvider.sendMail({ to, subject, html, text }); // delegates to implementor
    return { success: true };
  }
}
```

#### ⚠️ Tại sao KHÔNG PHẢI canonical GoF Bridge

| Tiêu chí GoF | Canonical GoF | Codebase này |
|--------------|---------------|--------------|
| `Abstraction` abstract class | Bắt buộc có `protected impl` field | **Chỉ có interface** `INotificationChannel` |
| Implementor reference | `protected Implementor impl` trong abstract class | **Injected qua DI** vào concrete class |
| RefinedAbstraction extends Abstraction | Inheritance từ abstract class | **Implements interface** (không phải extends abstract) |
| Delegation cơ chế | `this.impl.operationImpl()` trong abstract method | `this.emailProvider.sendMail()` trong concrete class |

Canonical GoF Bridge dùng **abstract class** với **composition** (protected field). Codebase này dùng **interface hierarchy** với **DI injection**. Sự khác biệt: GoF Abstraction là class có code (delegates), codebase này chỉ có interface (no base code).

#### Kết luận
Codebase đạt được **structural intent** của Bridge — hai dimensions biến đổi độc lập (channel protocol ↔ transport implementation) — nhưng thông qua interface hierarchy + DI injection thay vì abstract class composition. Đây là **Structural Equivalent** được chấp nhận trong kiến trúc hiện đại.

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

**Trạng thái: ✅ CANONICAL GoF**

#### Định nghĩa GoF
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

**Trạng thái: ✅ FRAMEWORK-ASSISTED CANONICAL GoF (via `@nestjs/cqrs`)**

#### Định nghĩa GoF
Command đóng gói một request thành một object, cho phép tham số hóa, queue, log, và undo. GoF yêu cầu: Command interface, ConcreteCommand, Invoker, Receiver.

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

**Trạng thái: ✅ FRAMEWORK-ASSISTED CANONICAL GoF — 2 Mediators chính (EventBus + CommandBus)**

#### Định nghĩa GoF
Mediator định nghĩa một object trung gian để các objects giao tiếp với nhau mà không tham chiếu trực tiếp lẫn nhau. GoF yêu cầu: Mediator interface, ConcreteMediator, Colleague classes giao tiếp qua Mediator.

#### Áp dụng — 2 Strong Mediators

**1. EventBus — Cross-BC Event Mediator (✅ Canonical)**

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

**⚠️ ChannelDispatcherService — Notification Channel Router (KHÔNG PHẢI GoF Mediator)**

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

> **Tại sao KHÔNG phải GoF Mediator:** GoF Mediator facilitates *bidirectional communication between colleagues* — colleagues gửi/nhận thông qua Mediator thay vì gọi nhau trực tiếp. `ChannelDispatcherService` là **Router/Registry**: nó route một chiều từ `NotificationService` đến channel adapters, nhưng các channel adapters KHÔNG giao tiếp với nhau qua `ChannelDispatcherService`. Đây là **Strategy Router** — gần với Context class của Strategy pattern hơn là Mediator. Vai trò GoF Mediator thực sự thuộc về **EventBus** và **CommandBus**.

---

### 5.6 Memento

**Trạng thái: ❌ KHÔNG CÓ**

#### Lý do không có

**Lưu ý quan trọng:** Codebase có các bảng snapshot (`ordering_restaurant_snapshots`, `ordering_menu_item_snapshots`, `notification_restaurant_snapshots`) — nhưng đây là **ACL Read-Model Projections** (event-sourcing pattern), không phải GoF Memento.

GoF Memento yêu cầu: Originator tạo Memento chứa internal state của mình, Caretaker lưu trữ, sau đó Originator restore từ Memento. Không có cơ chế restore state của domain object nào như vậy trong codebase này.

---

### 5.7 Observer

**Trạng thái: ✅ FRAMEWORK-ASSISTED CANONICAL GoF (via `@nestjs/cqrs` EventBus)**

#### Định nghĩa GoF
Observer định nghĩa mối quan hệ one-to-many: khi Subject thay đổi trạng thái, tất cả Observers được notify tự động. GoF yêu cầu: Subject (sử dụng attach/detach/notify), Observer interface với update().

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

**Trạng thái: ⚠️ ARCHITECTURAL EQUIVALENT (NOT canonical GoF — không có State objects, không có Context.state)**

#### Định nghĩa GoF
State cho phép một object thay đổi hành vi khi internal state của nó thay đổi. GoF yêu cầu:
- `Context` class giữ reference `State state` — pointer đến State object hiện tại
- `State` abstract class/interface với behavior methods
- `ConcreteState` classes implement behavior cho từng state cụ thể
- State objects có thể tự trigger transition bằng cách thay `context.state`

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

#### ⚠️ Tại sao KHÔNG PHẢI canonical GoF State

| Tiêu chí GoF | Canonical GoF | Codebase này |
|--------------|---------------|--------------|
| Context class giữ `state: State` | Bắt buộc | **Không tồn tại** — `status` là string field |
| `State` abstract/interface class | Bắt buộc | **Không tồn tại** — không có `PendingState`, `ConfirmedState` |
| `ConcreteState` classes | Bắt buộc | **Không tồn tại** |
| State tự trigger transition | Tùy chọn | **Không tồn tại** |
| Behavior delegation | `context.state.handle()` | `TRANSITIONS[key]` lookup table |

Canonical GoF State: `Order` context sẽ có `this.state = new PendingState()`, và `order.confirm()` sẽ delegate xuống `this.state.confirm(order)` — polymorphic behavior qua object.

Codebase: `status` là string `'pending'`, behavior là TRANSITIONS lookup table + `TransitionOrderHandler` logic. Không có State objects, không có polymorphic delegation.

#### Kết luận
Đây là **Data-Driven State Machine** — cơ chế lookup table thay vì object polymorphism. Đạt được *intent* của GoF State (ngăn transition bất hợp lệ, hành vi phụ thuộc state) nhưng qua cơ chế khác hoàn toàn. Approach này thực tế clean hơn OOP State cho domain có nhiều transitions (12 transitions tường minh trong TRANSITIONS map).

#### Đặc điểm nổi bật
- **12 transitions chính xác** (T-01 đến T-12) — hoàn toàn declarative.
- Transition table dùng Unicode arrow `→` (U+2192), **không phải** ASCII `->`.
- **Không có** type alias `TransitionKey` — key type là inline `\`${OrderStatus}→${OrderStatus}\``.
- Side effects (`triggersRefundIfVnpay`, `triggersReadyForPickup`) được mã hóa vào rule.
- Idempotency guard: nếu order đã ở trạng thái đích → return sớm (no-op).

---

### 5.9 Strategy

**Trạng thái: ✅ CANONICAL GoF (3 strategy hierarchies)**

#### Định nghĩa GoF
Strategy định nghĩa một nhóm các thuật toán có thể hoán đổi cho nhau, đóng gói từng thuật toán, và làm cho chúng có thể thay thế nhau. GoF yêu cầu: Strategy interface, ConcreteStrategy implementations, Context giữ reference đến Strategy.

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

**Trạng thái: ❌ KHÔNG CÓ**

#### Định nghĩa GoF
Template Method định nghĩa skeleton của một thuật toán trong một **abstract method** của `Creator` class, để `ConcreteCreator` **subclass** override các "hook" steps — **bắt buộc dùng kế thừa**. GoF yêu cầu:
- Abstract `Creator` class với `templateMethod()` (không phải abstract) gọi các abstract hook methods
- `abstractStep1()`, `abstractStep2()` (abstract) — subclass phải override
- `ConcreteCreator1`, `ConcreteCreator2` extends Creator, override từng hook

#### Tại sao PromotionPricingEngine KHÔNG phải Template Method

File: `apps/api/src/module/promotion/engine/promotion-pricing-engine.ts`

```typescript
// THỰC TẾ: single class, switch dispatch
export class PromotionPricingEngine {
  computeDiscount(input: PricingInput): PricingResult {
    // ...invariant steps (date, minAmount, quota)...

    // Step 4 — "Hook" dispatch qua switch — KHÔNG phải subclass override
    switch (promotion.type) {
      case 'percentage':     { /* logic */ break; }
      case 'fixed_amount':   { /* logic */ break; }
      case 'free_delivery':  { /* logic */ break; }
      // ...
    }
    // ...invariant steps (floor round, zero guard)...
  }
}
```

| Tiêu chí GoF Template Method | Canonical GoF | Codebase này |
|-------------------------------|---------------|--------------|
| Abstract `Creator` class | Bắt buộc | **KHÔNG TỒN TẠI** |
| Abstract hook methods | Bắt buộc | **KHÔNG TỒN TẠI** |
| ConcreteCreator subclasses | Bắt buộc | **KHÔNG TỒN TẠI** |
| Cơ chế variation | Inheritance — subclass override | Switch dispatch trong single class |

`PromotionPricingEngine` là một **single class** với `switch(promotion.type)` conditional dispatch. Đây là **Algorithm with Conditional Dispatch** — một design thực tế đúng đắn cho discriminated union (nhất là với Drizzle ORM), nhưng KHÔNG phải GoF Template Method.

Để codebase này CÓ GoF Template Method, cần có:
```typescript
// Canonical GoF — KHÔNG có trong codebase
abstract class BaseDiscountCalculator {
  computeDiscount(input: PricingInput): PricingResult {
    if (!this.checkDateRange(input)) return notEligible(...);
    if (!this.checkMinAmount(input)) return notEligible(...);
    const discount = this.calculateDiscount(input);  // abstract hook
    return this.buildResult(discount, input);
  }
  protected abstract calculateDiscount(input: PricingInput): number;
}
class PercentageDiscountCalculator extends BaseDiscountCalculator {
  protected calculateDiscount(input: PricingInput): number { /* ... */ }
}
```

**Kết luận:** Pattern này KHÔNG tồn tại trong codebase. Phân loại v1.1 là "functional variant" không đủ nghiêm ngặt theo GoF — một class duy nhất với switch statement KHÔNG đủ điều kiện là Template Method dưới bất kỳ định nghĩa GoF nào.

---

### 5.11 Visitor

**Trạng thái: ❌ KHÔNG CÓ**

#### Lý do không có
Không có double-dispatch visitor pattern. Không có tình huống cần "thêm operation mới vào object hierarchy mà không thay đổi class hierarchy" trong codebase này.

---

## 6. Bảng Tổng Hợp Cuối

> **Kết quả v1.2:** 12 pattern hiện diện (6 Canonical, 4 Framework-Assisted, 2 Architectural Equivalent), 11 KHÔNG CÓ.
> Template Method bị downgrade từ ✅ → ❌ sau re-audit nghiêm ngặt.

### Creational Patterns

| # | Pattern | Trạng thái | Classification | File / Class chính |
|---|---------|-----------|----------------|-------------------|
| 1 | Abstract Factory | ⚠️ CÓ | ARCHITECTURAL EQUIVALENT | `notification.module.ts` — `EMAIL_PROVIDER` + `PUSH_PROVIDER` paired factories |
| 2 | Builder | ❌ KHÔNG CÓ | — | — |
| 3 | Factory Method | ⚠️ CÓ | FRAMEWORK-ASSISTED FUNCTIONAL EQUIVALENT | `redis.module.ts`, `drizzle.module.ts`, `cloudinary.provider.ts`, + 2 providers |
| 4 | Prototype | ❌ KHÔNG CÓ | — | — |
| 5 | Singleton | ✅ CÓ | FRAMEWORK-ASSISTED VARIANT | Tất cả `@Injectable()` + `@Global()` modules (`RedisModule`, `GeoModule`, ...) |

### Structural Patterns

| # | Pattern | Trạng thái | Classification | File / Class chính |
|---|---------|-----------|----------------|-------------------|
| 6 | Adapter | ✅ CÓ | CANONICAL GoF (2) + DIP Ports (2) | `CartRedisRepository`, `drizzleAdapter` (canonical); `IPromotionApplicationPort`, `IPaymentInitiationPort` (DIP) |
| 7 | Bridge | ⚠️ CÓ | STRUCTURAL EQUIVALENT | `INotificationChannel` ↔ `IEmailProvider` / `IPushProvider` (hai tầng trừu tượng độc lập) |
| 8 | Composite | ❌ KHÔNG CÓ | — | — |
| 9 | Decorator (GoF) | ❌ KHÔNG CÓ | — | *(NestJS `@Decorator` là metadata annotation, KHÔNG phải GoF Decorator)* |
| 10 | Facade | ✅ CÓ | CANONICAL GoF | `NotificationService`, `CartService`, `OrderHistoryService`, `AclService` |
| 11 | Flyweight | ❌ KHÔNG CÓ | — | — |
| 12 | Proxy | ❌ KHÔNG CÓ | — | — |

### Behavioral Patterns

| # | Pattern | Trạng thái | Classification | File / Class chính |
|---|---------|-----------|----------------|-------------------|
| 13 | Chain of Responsibility | ❌ KHÔNG CÓ | — | *(NestJS middleware pipeline là framework-internal)* |
| 14 | Command | ✅ CÓ | FRAMEWORK-ASSISTED CANONICAL | `TransitionOrderCommand/Handler`, `PlaceOrderCommand/Handler`, `ProcessIpnCommand/Handler` + `CommandBus` |
| 15 | Interpreter | ❌ KHÔNG CÓ | — | — |
| 16 | Iterator | ❌ KHÔNG CÓ | — | *(dùng JS built-in iteration)* |
| 17 | Mediator | ✅ CÓ | FRAMEWORK-ASSISTED CANONICAL | `EventBus` (cross-BC), `CommandBus` (request/handler) — `ChannelDispatcherService` là Router, KHÔNG phải Mediator |
| 18 | Memento | ❌ KHÔNG CÓ | — | *(ACL snapshots là projections, không phải GoF Memento)* |
| 19 | Observer | ✅ CÓ | FRAMEWORK-ASSISTED CANONICAL | `EventBus` + 12 `@EventsHandler` subscribers; fan-out trên `RestaurantUpdatedEvent` |
| 20 | State | ⚠️ CÓ | ARCHITECTURAL EQUIVALENT | `TRANSITIONS` map (12 transitions T-01→T-12, unicode `→`) + `TransitionOrderHandler` — data-driven state machine |
| 21 | Strategy | ✅ CÓ | CANONICAL GoF | `INotificationChannel` (3 strategies) + `IEmailProvider` + `IPushProvider` (nested) |
| 22 | Template Method | ❌ KHÔNG CÓ | — | `PromotionPricingEngine` dùng switch dispatch trong single class — KHÔNG phải abstract class + subclass override |
| 23 | Visitor | ❌ KHÔNG CÓ | — | — |

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

*Báo cáo v1.2 — academic rigor re-audit. Mỗi pattern được xác nhận (hoặc phủ nhận) dựa trên bằng chứng code thực tế từ ~61 file nguồn. Classification labels phân biệt canonical GoF vs. framework-assisted vs. architectural equivalent — tiêu chuẩn có thể bảo vệ trước hội đồng học thuật.*
