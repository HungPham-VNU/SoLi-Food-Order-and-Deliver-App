# SRS Business Rule Recovery Audit — Phase 4

**Scope**: `apps/api/docs/Final_Documents/SRS_FoodDelivery.md`
**Goal**: Restore the BR description cells that were emptied by Phase 3's over-aggressive implementation-alignment pass, without deleting, blanking, downgrading, or keeping title-only any row.

---

## 1. Final Audit Confirmation

Pre-recovery scan (`Get-Content … | Where-Object { $_ -match '^\|\s*_\(\d+\)_\s*\|\s*_BR-\d+\.\d+_\s*\|\s*\*\*[^*|]+:\*\*\s*\|\s*$' }`):

- **Empty BR rows found**: **75**

Post-recovery scan with the same regex:

- **Empty BR rows remaining**: **0**

> **STOP CONDITION SATISFIED** — zero empty BR rows remain in `SRS_FoodDelivery.md`.

---

## 2. Empty Rule Audit (Pre-Recovery Inventory)

The 75 BR rows whose description cells were empty (`**Title:** |` with nothing after the colon):

| # | BR Code | UC Context | # | BR Code | UC Context |
|---|--------|-----------|---|--------|-----------|
| 1 | BR-1.2 | UC-1 Authentication | 39 | BR-29.3 | UC-29 Validation |
| 2 | BR-1.7 | UC-1 Sign-Up | 40 | BR-29.5 | UC-29 Persistence |
| 3 | BR-6.1 | UC-6 Address structure | 41 | BR-29.6 | UC-29 Session termination |
| 4 | BR-6.2 | UC-6 Coordinates | 42 | BR-29.9 | UC-29 Reactivation eligibility |
| 5 | BR-6.8 | UC-6 Immutability | 43 | BR-29.14 | UC-29 Audit log |
| 6 | BR-6.9 | UC-6 Address book lifecycle | 44 | BR-29.15 | UC-29 Auto-expiry |
| 7 | BR-8.1 | UC-8 Checkout validation | 45 | BR-30.1 | UC-30 Authorization |
| 8 | BR-8.3 | UC-8 Idempotency | 46 | BR-31.1 | UC-31 Authorization |
| 9 | BR-8.5 | UC-8 Concurrency lock | 47 | BR-31.3 | UC-31 Search filter |
| 10 | BR-8.14 | UC-8 Server-authoritative pricing | 48 | BR-31.4 | UC-31 Filter validation |
| 11 | BR-16.1 | UC-16 Shipper input validation | 49 | BR-31.7 | UC-31 Detail precondition |
| 12 | BR-16.2 | UC-16 Image references | 50 | BR-31.11 | UC-31 Action routing |
| 13 | BR-16.3 | UC-16 Duplicate prevention | 51 | BR-31.13 | UC-31 Profile validation |
| 14 | BR-16.6 | UC-16 Admin queue access | 52 | BR-31.14 | UC-31 Profile persistence |
| 15 | BR-16.8 | UC-16 Approval gate | 53 | BR-31.17 | UC-31 Delegation boundary |
| 16 | BR-16.9 | UC-16 Role elevation | 54 | BR-31.18 | UC-31 Audit trail |
| 17 | BR-17.2 | UC-17 Approval gate | 55 | BR-32.1 | UC-32 Authorization |
| 18 | BR-17.4 | UC-17 In-flight query | 56 | BR-33.1 | UC-33 Authorization |
| 19 | BR-17.5 | UC-17 Offline transition | 57 | BR-33.2 | UC-33 Parameter validation |
| 20 | BR-18.7 | UC-18 Optimistic lock init | 58 | BR-33.5 | UC-33 Orders report |
| 21 | BR-21.10 | UC-21 Lock contention | 59 | BR-33.6 | UC-33 Financial report |
| 22 | BR-22.1 | UC-22 Review validation | 60 | BR-33.7 | UC-33 Users/Promotions report |
| 23 | BR-22.8 | UC-22 Uniqueness | 61 | BR-33.8 | UC-33 Export contract |
| 24 | BR-22.11 | UC-22 Transactional publication | 62 | BR-33.12 | UC-33 Freshness & caching |
| 25 | BR-22.12 | UC-22 Rating projection | 63 | BR-34.1 | UC-34 Authorization |
| 26 | BR-22.13 | UC-22 Moderation schema | 64 | BR-34.2 | UC-34 KPI catalogue |
| 27 | BR-24.1 | UC-24 Admin role gate | 65 | BR-34.3 | UC-34 Onboarding KPIs |
| 28 | BR-25.11 | UC-25 Optimistic lock | 66 | BR-34.4 | UC-34 Recent activity |
| 29 | BR-27.1 | UC-27 Admin role | 67 | BR-34.5 | UC-34 Snapshot response |
| 30 | BR-27.11 | UC-27 Audit metadata | 68 | BR-34.7 | UC-34 Caching strategy |
| 31 | BR-28.1 | UC-28 Admin role | 69 | BR-35.1 | UC-35 Authorization |
| 32 | BR-28.3 | UC-28 Queue composition | 70 | BR-35.2 | UC-35 Payload validation |
| 33 | BR-28.5 | UC-28 Detail inspection | 71 | BR-35.4 | UC-35 Last-admin safeguard |
| 34 | BR-28.8 | UC-28 Rejection reason | 72 | BR-35.6 | UC-35 User existence |
| 35 | BR-28.11 | UC-28 Atomic role elevation | 73 | BR-35.7 | UC-35 Atomic persistence |
| 36 | BR-28.15 | UC-28 Audit trail | 74 | BR-35.9 | UC-35 Session refresh |
| 37 | BR-29.1 | UC-29 Authorization | 75 | BR-35.10 | UC-35 Audit trail |
| 38 | BR-29.2 | UC-29 Existence | | | |

Each row is now populated with substantive, MSG-coded, code-aligned or design-first bullets — none deleted, none blanked, none title-only, none downgraded.

---

## 3. Recovered Business Rule Report

Recovery sources (per user policy):
- **CASE A** = codebase has implementation backing the rule → BR description is re-aligned to method/handler signatures, redis keys, DB columns, event names, etc. observed in `apps/api/src/**`.
- **CASE B** = no implementation exists or rule is design-only → BR description is restored from design intent in `apps/api/docs/Final_Documents/Business_Rules.md`, `USE_CASE_SPECIFICATION.md`, and `BRD.md`.

| BR | Recovered From | Case | Reason |
|----|----------------|------|--------|
| BR-1.2 Authenticate Rules | `apps/api/src/lib/auth.ts` (Better Auth `signInEmail` API), `Business_Rules.md` §Auth | **CASE A** | Better Auth owns email lookup, password hash compare, session token issuance; HTTP 401 + `MSG-AUTH-01` documented in messages appendix. |
| BR-1.7 Duplicate Email Rules | `apps/api/src/lib/auth.ts` (`signUpEmail`), DB `users.email UNIQUE` constraint, `Business_Rules.md` §Auth | **CASE A** | Better Auth + DB unique constraint enforce email uniqueness; HTTP 409 + `MSG-AUTH-02`. |
| BR-6.1 Validate Address Structure | `apps/api/src/module/ordering/**/dto/*.ts` (`DeliveryAddressDto`), class-validator | **CASE A** | DTO field constraints + `MSG-ADDR-01`. |
| BR-6.2 Validate Coordinate Pairing | DTO validation + design intent (Vietnam scope from `BRD.md`) | **CASE A** | lat/lon range + Vietnam bounding box; `MSG-ADDR-02`. |
| BR-6.8 Address Immutability Rules | `apps/api/src/module/ordering/order-lifecycle/**` (order snapshot columns), `Business_Rules.md` §Address | **CASE B** | Snapshot semantics documented in design; `MSG-ADDR-04`. |
| BR-6.9 Address Book Lifecycle Rules | `Business_Rules.md` §Address book, `USE_CASE_SPECIFICATION.md` UC-6 | **CASE B** | Address book CRUD design rules. |
| BR-8.1 Checkout Validation | `apps/api/src/module/ordering/**/checkout.dto.ts`, class-validator | **CASE A** | `paymentMethod` enum, `idempotencyKey` UUID v4, coupon/notes; `MSG-ORD-01`/`MSG-ORD-02`. |
| BR-8.3 Idempotency Rules | `PlaceOrderHandler` (Redis SET NX), `apps/api/src/module/ordering/common/ordering.constants.ts` (`IDEMPOTENCY_KEY_PREFIX`, `IDEMPOTENCY_TTL_FALLBACK_SECONDS`) | **CASE A** | Inline Redis SET NX semantics. |
| BR-8.5 Concurrency Lock Rules | `PlaceOrderHandler` (`RedisService.setnx`), `ordering.constants.ts` (`CART_KEY_PREFIX`, `CART_LOCK_SUFFIX`, `CART_LOCK_TTL_SECONDS`) | **CASE A** | Inline SET NX EX cart lock; `MSG-ORD-03`. |
| BR-8.14 Server-Authoritative Pricing | `apps/api/src/module/ordering/common/app-settings.service.ts`, ACL snapshot in `PlaceOrderHandler` | **CASE A** | Server recomputes totals from ACL; `MSG-ORD-12`. |
| BR-16.1 Shipper Input Validation | `USE_CASE_SPECIFICATION.md` UC-16, `Business_Rules.md` §Shipper | **CASE B** | UC-16 endpoint not yet built; design-first content. |
| BR-16.2 Image Reference Validation | UC-16 design + `ImageService` (`apps/api/src/module/image/**`) | **CASE B** | UC-16 not yet built; references existing `ImageService`. |
| BR-16.3 Duplicate Application Prevention | UC-16 design | **CASE B** | Design-first content. |
| BR-16.6 Admin Queue Access | UC-16 design | **CASE B** | Pre-implementation design rules. |
| BR-16.8 Approval Decision Gate | UC-16 design | **CASE B** | Pre-implementation. |
| BR-16.9 Role Elevation | UC-16 design + `users.soliRoles` schema | **CASE B** | Pre-implementation, but DB column exists. |
| BR-17.2 Shipper Account Approval Gate | UC-17 design | **CASE B** | Pre-implementation; references UC-16 dependency. |
| BR-17.4 In-Flight Delivery Query | UC-17 design + planned `(shipperId, status)` index | **CASE B** | Pre-implementation. |
| BR-17.5 Offline Transition Execution | UC-17 design | **CASE B** | Pre-implementation. |
| BR-18.7 Optimistic Lock Init | `apps/api/src/module/ordering/order-lifecycle/commands/transition-order.handler.ts` (`version` column on `orders`) | **CASE A** | Version-guarded UPDATE pattern verified in handler. |
| BR-21.10 Optimistic Lock Contention | `transition-order.handler.ts` + `T-CANCEL` transition | **CASE A** | Same handler family; `MSG-CANC-04`. |
| BR-22.1 Review Request Validation | `Business_Rules.md` §Rating, UC-22 design | **CASE B** | UC-22 review submission not yet implemented. |
| BR-22.8 Uniqueness Constraint | UC-22 design (`reviews(orderId) UNIQUE`) | **CASE B** | Pre-implementation. |
| BR-22.11 Transactional Publication | UC-22 design + NestJS `EventBus` pattern | **CASE B** | Pre-implementation, but pattern is platform-standard. |
| BR-22.12 Restaurant Rating Projection | UC-22 + UC-2 design | **CASE B** | Pre-implementation; describes read-model. |
| BR-22.13 Moderation-Ready Schema | UC-22 design | **CASE B** | Pre-implementation. |
| BR-24.1 Admin Role Gate | `apps/api/src/module/restaurant-catalog/**` admin controllers, `hasRole` utility | **CASE A** | Admin guard pattern; `MSG-AUTH-08`. |
| BR-25.11 Optimistic Lock Acquisition | `apps/api/src/module/payment/**/payment-transaction.repository.ts` (`updateStatus`/`create`) | **CASE A** | Version + status guarded UPDATE for refund flow. |
| BR-27.1 Admin Role Authorization | UC-27 admin controller (restaurant approval), `auth.api.getSession`, `hasRole` | **CASE A** | Pattern reused across admin BCs. |
| BR-27.11 Audit Trail Metadata | UC-27 + `Business_Rules.md` §Audit | **CASE B** | Audit table design. |
| BR-28.1 Admin Role Enforcement | UC-28 design (shipper approval) + admin auth pattern | **CASE B** | Pre-implementation; reuses admin guard pattern. |
| BR-28.3 Approval Queue Composition | UC-28 design | **CASE B** | Pre-implementation. |
| BR-28.5 Detailed Application Inspection | UC-28 + `ImageService` signed URL pattern | **CASE B** | Pre-implementation. |
| BR-28.8 Rejection Reason Validation | UC-28 design | **CASE B** | Pre-implementation; `MSG-SHIP-01`. |
| BR-28.11 Atomic Role Elevation | UC-28 design + `users.soliRoles` | **CASE B** | Pre-implementation; matches BR-16.9. |
| BR-28.15 Audit Trail Recording | UC-28 design | **CASE B** | Pre-implementation. |
| BR-29.1 Authorization Rules | UC-29 design (partner suspension) | **CASE B** | Pre-implementation. |
| BR-29.2 Existence Rules | UC-29 design + `users` table | **CASE B** | Pre-implementation. |
| BR-29.3 Validate Rules | UC-29 design + Better Auth `banned`/`banReason`/`banExpires` columns | **CASE B** | Pre-implementation; Better Auth schema already supports ban fields. |
| BR-29.5 Persistence Rules | UC-29 design + Better Auth ban columns | **CASE B** | Pre-implementation. |
| BR-29.6 Session Termination Rules | UC-29 + Better Auth session store | **CASE B** | Pre-implementation, leverages existing Better Auth API. |
| BR-29.9 Reactivation Eligibility | UC-29 design | **CASE B** | Pre-implementation. |
| BR-29.14 Audit Log Rules | UC-29 design | **CASE B** | Pre-implementation. |
| BR-29.15 Automatic Expiry | UC-29 design (scheduled task) | **CASE B** | Pre-implementation; described as `PartnerSuspensionTask`. |
| BR-30.1 Authorization Rules | `apps/api/src/module/ordering/**` admin order history controller | **CASE A** | Admin guard reused; `auth.api.getSession`, `hasRole`. |
| BR-31.1 Authorization Rules | UC-31 design (admin user management) | **CASE B** | Pre-implementation. |
| BR-31.3 Search Filter Contract | UC-31 design | **CASE B** | Pre-implementation. |
| BR-31.4 Filter Validation | UC-31 design | **CASE B** | Pre-implementation; `MSG-ADM-18`. |
| BR-31.7 Detail Load Precondition | UC-31 design | **CASE B** | Pre-implementation. |
| BR-31.11 Action Routing | UC-31 design + UC-29/UC-30/UC-32/UC-35 boundaries | **CASE B** | Pre-implementation; documents delegation. |
| BR-31.13 Profile Edit Validation | UC-31 design | **CASE B** | Pre-implementation; `MSG-ADM-18`/`MSG-ADM-30`. |
| BR-31.14 Profile Persistence | UC-31 design | **CASE B** | Pre-implementation. |
| BR-31.17 Delegation Boundary | UC-31 design | **CASE B** | Pre-implementation; `MSG-ADM-29`. |
| BR-31.18 Audit Trail | UC-31 design | **CASE B** | Pre-implementation. |
| BR-32.1 Authorization Rules | `apps/api/src/module/ordering/order-lifecycle/**` admin transitions | **CASE A** | Admin guard reused for admin-cancel/refund. |
| BR-33.1 Authorization Rules | UC-33 design (admin reports) | **CASE B** | Pre-implementation. |
| BR-33.2 Parameter Validation | UC-33 design | **CASE B** | Pre-implementation; `MSG-ADM-22`/`MSG-ADM-24`. |
| BR-33.5 Orders Report | UC-33 + `orders`/`order_status_logs` schema | **CASE B** | Pre-implementation; metrics defined from existing tables. |
| BR-33.6 Financial Report | UC-33 + `payment_transactions` schema, BR-5 commission | **CASE B** | Pre-implementation. |
| BR-33.7 Users & Promotions Report | UC-33 + UC-27/UC-28/promotions schema | **CASE B** | Pre-implementation. |
| BR-33.8 Export Contract | UC-33 design | **CASE B** | Pre-implementation. |
| BR-33.12 Freshness & Caching | UC-33 design | **CASE B** | Pre-implementation. |
| BR-34.1 Authorization Rules | UC-34 design (admin dashboard) | **CASE B** | Pre-implementation. |
| BR-34.2 KPI Catalogue | UC-34 design | **CASE B** | Pre-implementation. |
| BR-34.3 Onboarding KPIs | UC-34 + UC-27/UC-28 | **CASE B** | Pre-implementation. |
| BR-34.4 Recent Activity Stream | UC-34 design | **CASE B** | Pre-implementation. |
| BR-34.5 Snapshot Response | UC-34 design | **CASE B** | Pre-implementation; `MSG-ADM-25`. |
| BR-34.7 Caching Strategy | UC-34 design | **CASE B** | Pre-implementation. |
| BR-35.1 Authorization Rules | UC-35 design (role assignment) | **CASE B** | Pre-implementation. |
| BR-35.2 Payload Validation | UC-35 design + canonical role set | **CASE B** | Pre-implementation; `MSG-ADM-28`. |
| BR-35.4 Last-Administrator Safeguard | UC-35 design | **CASE B** | Pre-implementation; `MSG-ADM-27`. |
| BR-35.6 User Existence Check | UC-35 design | **CASE B** | Pre-implementation. |
| BR-35.7 Atomic Role Persistence | UC-35 design + `users.role`/`soliRoles` | **CASE B** | Pre-implementation. |
| BR-35.9 Session Refresh | UC-35 design + Better Auth session cache | **CASE B** | Pre-implementation; non-invalidating refresh. |
| BR-35.10 Audit Trail | UC-35 design | **CASE B** | Pre-implementation. |

---

## 4. Implementation Alignment Report (CASE A Rules)

For every CASE A rule, the SRS bullet now references the actual code surface backing the rule.

| BR | Code Surface | File / Symbol |
|----|--------------|----------------|
| BR-1.2 | Better Auth `signInEmail` API | [apps/api/src/lib/auth.ts](apps/api/src/lib/auth.ts) |
| BR-1.7 | Better Auth `signUpEmail` + DB `users.email UNIQUE` | [apps/api/src/lib/auth.ts](apps/api/src/lib/auth.ts) |
| BR-6.1 | `DeliveryAddressDto` (class-validator) | `apps/api/src/module/ordering/**/dto/*.ts` |
| BR-6.2 | DTO validators + Vietnam bbox constants | `apps/api/src/module/ordering/**/dto/*.ts` |
| BR-8.1 | `CheckoutDto` (class-validator) | `apps/api/src/module/ordering/**/dto/checkout.dto.ts` |
| BR-8.3 | `PlaceOrderHandler` Redis SET NX | `apps/api/src/module/ordering/checkout/commands/place-order.handler.ts` |
| BR-8.5 | `PlaceOrderHandler` cart lock Redis SET NX EX | `apps/api/src/module/ordering/checkout/commands/place-order.handler.ts` |
| BR-8.14 | ACL snapshot pricing + `AppSettingsService` | `apps/api/src/module/ordering/common/app-settings.service.ts` |
| BR-18.7 | `TransitionOrderHandler` version-guarded UPDATE | `apps/api/src/module/ordering/order-lifecycle/commands/transition-order.handler.ts` |
| BR-21.10 | `TransitionOrderHandler` `T-CANCEL` path | `apps/api/src/module/ordering/order-lifecycle/commands/transition-order.handler.ts` |
| BR-24.1 | Restaurant admin controllers + `hasRole('admin')` | `apps/api/src/module/restaurant-catalog/**/admin*.controller.ts` |
| BR-25.11 | `PaymentTransactionRepository.updateStatus` | `apps/api/src/module/payment/**/payment-transaction.repository.ts` |
| BR-27.1 | Restaurant approval admin controller + `auth.api.getSession` + `hasRole` | `apps/api/src/module/restaurant-catalog/**/admin*.controller.ts` |
| BR-30.1 | Order history admin controller + `auth.api.getSession` + `hasRole` | `apps/api/src/module/ordering/**/admin*.controller.ts` |
| BR-32.1 | Admin order transitions reuse `TransitionOrderHandler` + admin guard | `apps/api/src/module/ordering/order-lifecycle/**` |

---

## 5. Methodology Notes

- **Replacement was non-destructive**: a regex captured the `**Title:** |` cell boundary and appended `<br>❖ bullet …` content between the title's closing colon and the row's closing `|`. No other column or row was mutated.
- **Bullet glyph**: U+2756 (❖) — identical to bullets used elsewhere in the SRS.
- **Encoding**: SRS read and written as UTF-8 without BOM (matches existing file encoding).
- **Driver scripts**:
  - Data: [tools/br-recovery.json](tools/br-recovery.json)
  - Patcher: [tools/recover-empty-br-v2.ps1](tools/recover-empty-br-v2.ps1)
- **MSG codes** referenced in new bullets reuse codes already present in the SRS Message Appendix (no new MSG codes were minted).

---

## 6. Closure

All 75 previously-empty Business Rule rows in `SRS_FoodDelivery.md` are restored with substantive content. Per the recovery policy, none were deleted, blanked, kept title-only, or downgraded. The SRS is once again internally consistent for downstream consumers (developers, reviewers, QA, compliance).
