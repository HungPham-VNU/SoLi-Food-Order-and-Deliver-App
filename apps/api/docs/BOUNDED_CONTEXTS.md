# API Bounded Contexts

The API is deployed as one NestJS process, but business capabilities own their
models and persistence. A context may expose behavior only through a contract in
`src/shared/ports`, a shared event, or an explicitly imported public module.

## Ownership

| Context            | Owns                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Identity           | Better Auth users, sessions, accounts, verification, role changes                           |
| Restaurant Catalog | Restaurants, menus, modifiers, delivery zones, nutrition, dietary tags, and search metadata |
| Ordering           | Carts, orders, lifecycle, history, analytics, and catalog snapshots                         |
| Promotions         | Promotions, coupons, and usage reservations                                                 |
| Payments           | Payment transactions and VNPay integration                                                  |
| Review             | Reviews and review submission rules                                                         |
| Notifications      | Notification inbox, preferences, device tokens, and delivery logs                           |
| Image              | Image metadata and Cloudinary integration                                                   |
| Admin Analytics    | Read-only reporting composition across context-owned tables                                 |

Generic AI, Redis, geo, database, configuration, and observability code lives
under infrastructure (`src/lib`, `src/drizzle`, and `src/observability`) rather
than pretending to be a business context.

## Dependency rules

1. Only the owning context writes its tables.
2. Runtime context code must not import `src/drizzle/schema.ts`; that barrel is
   reserved for Drizzle configuration, migrations, seeds, and test setup.
3. Cross-context behavior uses a token/interface in `src/shared/ports`.
4. State-change fan-out uses contracts in `src/shared/events`.
5. Context modules are imported explicitly; application modules are not global.
6. Shared contracts never import business-context implementations.
7. Admin Analytics is the sole read-only table-composition exception. It may
   import Ordering and Catalog schemas, but it must never mutate them.

`src/architecture/module-boundaries.spec.ts` enforces these rules in the normal
unit-test suite. Update its explicit allowlist only when an architectural
relationship is intentional and documented here.

## Current integration flow

- Ordering calls Payments and Promotions through their public ports.
- Review calls Ordering for eligibility/review marking and Catalog for rating
  projection updates through public ports.
- Catalog calls Identity for role promotion and Image for image persistence
  through public ports.
- Notifications calls Identity for contact lookup and consumes shared events.
- Catalog events update Ordering and Notification snapshots.

The HTTP route for cancelling a pending VNPay payment remains
`PATCH /payments/vnpay/orders/:orderId/cancel`, but the workflow is owned by
Ordering: it invokes the Payment port and then performs the order transition.
