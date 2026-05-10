# Use Case Proposal — SoLi Food Delivery Platform

**Document Type:** Use Case Inventory & Proposal  
**Version:** 1.0  
**Status:** Draft  
**Scope:** Release 1 (MVP) + Release 2 Planned Features  
**Prepared by:** Business Analysis Team  

> **Purpose Statement:** This document is an inventory and proposal foundation — it establishes the complete set of actor–system interactions and their current implementation status. It does **not** contain full Use Case Specifications, narrative flows, or detailed sequence descriptions. Those artefacts are produced in subsequent phases using this document as a traceability anchor.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Scope Alignment](#2-scope-alignment)
3. [Actor Overview](#3-actor-overview)
4. [Use Case Classification Strategy](#4-use-case-classification-strategy)
5. [Proposed Use Cases by Domain](#5-proposed-use-cases-by-domain)
   - 5.1 Authentication & Account Management
   - 5.2 Restaurant Discovery & Search
   - 5.3 Cart & Checkout
   - 5.4 Payment
   - 5.5 Order Tracking & History
   - 5.6 Restaurant Operations
   - 5.7 Delivery Operations
   - 5.8 Notifications
   - 5.9 Reviews & Feedback
   - 5.10 Administration
   - 5.11 Real-time Tracking
   - 5.12 Reporting & Monitoring
6. [Future & Planned Use Cases Summary](#6-future--planned-use-cases-summary)
7. [Diagram Planning Recommendations](#7-diagram-planning-recommendations)
8. [Traceability Preparation](#8-traceability-preparation)

---

## 1. Introduction

The **SoLi Food Delivery Platform** is a multi-sided marketplace connecting customers, restaurant partners, and delivery personnel within a defined geographic service area. The platform encompasses three client surfaces:

- **Mobile application** (`apps/mobile`) — customer-facing ordering experience
- **Web portal** (`apps/web`) — restaurant partner and administrator dashboard
- **Backend API** (`apps/api`) — NestJS service exposing all business logic

This Use Case Proposal defines the functional scope of the system in terms of actor–goal interactions. It is grounded in the implemented codebase (controllers, services, domain schemas) and the approved Business Requirements Document (BRD).

### 1.1 Document Intent

This document serves as:
- A **shared vocabulary** between business stakeholders and development teams
- A **completeness check** against the BRD feature list (FE-1 through FE-12)
- A **status snapshot** distinguishing implemented, partially implemented, and planned capabilities
- A **traceability anchor** for future Use Case Specifications, test scenarios, and user stories

### 1.2 Notation Conventions

| Symbol | Meaning |
|--------|---------|
| `UC-` prefix | Use Case identifier |
| **Implemented** | Feature is fully coded and exercised by a deployed API endpoint |
| **Partial** | Feature exists in codebase but is incomplete, lacks an endpoint, or is not client-accessible |
| **Planned** | Feature is specified in BRD/Vision & Scope but has no codebase implementation |

---

## 2. Scope Alignment

The use cases in this document are bounded by the features defined in the BRD:

| BRD Feature | Title | Release | Coverage in This Document |
|-------------|-------|---------|---------------------------|
| FE-1 | Authentication & Account Management | R1 | §5.1 |
| FE-2 | Restaurant Discovery & Search | R1 | §5.2 |
| FE-3 | Cart & Checkout | R1 | §5.3 |
| FE-4 | Payment Integration | R1 (VNPay), R2 (MoMo) | §5.4 |
| FE-5 | Order Tracking | R1 (status), R2 (live map) | §5.5, §5.11 |
| FE-6 | Restaurant Partner Portal | R1 | §5.6 |
| FE-7 | Shipper Portal | R1 | §5.7 |
| FE-8 | Admin Dashboard | R1 | §5.10 |
| FE-9 | Reviews & Ratings | R2 | §5.9 |
| FE-10 | Promotions & Loyalty | R2+ | §6 |
| FE-11 | Multi-branch Support | R3 | §6 |
| FE-12 | Push Notifications | R1 (partial), R2 (full) | §5.8 |

### Out of Scope

The following are explicitly outside the MVP boundary (BR-9):
- Business-to-business (B2B) or corporate catering accounts
- Subscription meal plans
- Cross-platform marketplace (non-food categories)
- Fraud detection automation beyond payment signature verification

---

## 3. Actor Overview

### 3.1 Primary Actors (Directly interact with the system)

| Actor | System Role | Authentication | Client Surface |
|-------|-------------|----------------|----------------|
| **Guest / Anonymous User** | Unauthenticated browser | None | Mobile, Web |
| **Customer** | Authenticated end-user (`user` role) | Email/password via Better Auth | Mobile |
| **Restaurant Partner** | Restaurant owner/manager (`restaurant` role) | Email/password via Better Auth | Web portal |
| **Delivery Personnel (Shipper)** | Field delivery agent (`shipper` role) | Email/password via Better Auth | Mobile |
| **System Administrator** | Platform operator (`admin` role) | Email/password via Better Auth | Web portal |

### 3.2 Secondary Actors (Interact indirectly or via system events)

| Actor | Role | Interaction Mode |
|-------|------|-----------------|
| **System (Automated)** | Background jobs, timeout processing | Internal cron scheduler (`@Cron`) |
| **VNPay** | External payment gateway | Server-to-server IPN callback (`GET /payments/vnpay/ipn`) |
| **Firebase Cloud Messaging (FCM)** | Push notification delivery | Outbound API call from backend |
| **Email Provider (Nodemailer)** | Transactional email delivery | Outbound SMTP from backend |

### 3.3 Actor Hierarchy

```
Platform Users
├── Anonymous / Guest
│   └── Browse restaurants and menus (read-only)
└── Authenticated Users
    ├── Customer (role: user)
    │   ├── Place and manage orders
    │   └── Receive notifications
    ├── Restaurant Partner (role: restaurant)
    │   ├── Manage menu and availability
    │   └── Manage incoming orders
    ├── Delivery Personnel (role: shipper)
    │   ├── Claim and fulfill deliveries
    │   └── Update delivery status
    └── System Administrator (role: admin)
        ├── Approve/manage partners
        └── Full platform oversight

System Actors
├── Cron Scheduler — order and payment timeout tasks
└── VNPay — IPN payment confirmation callbacks
```

---

## 4. Use Case Classification Strategy

### 4.1 Priority Levels

Use cases are classified using MoSCoW priorities consistent with the BRD and User Stories:

| Priority | Label | Meaning |
|----------|-------|---------|
| P1 | **Must** | Critical for MVP; platform cannot function without it |
| P2 | **Should** | High-value R1 feature; degraded but functional without it |
| P3 | **Could** | R2 enhancement; adds differentiation |
| P4 | **Won't (R1)** | Deferred to R3+ or explicitly out of scope |

### 4.2 Use Case Granularity

Use cases in this inventory are written at **actor-goal level** (Cockburn Level 2 — "User Goal"). Each UC represents a distinct, observable outcome that an actor can achieve through the system.

Sub-functions that are purely technical (e.g., HMAC signature verification, Redis TTL management, ACL snapshot resolution) are **not** modelled as separate use cases — they are implementation mechanisms for higher-level goals.

### 4.3 Domain Groupings

Use cases are grouped into 12 functional domains aligned with the bounded context structure of the API:

1. Authentication & Account Management
2. Restaurant Discovery & Search
3. Cart & Checkout
4. Payment
5. Order Tracking & History
6. Restaurant Operations
7. Delivery Operations
8. Notifications
9. Reviews & Feedback
10. Administration
11. Real-time Tracking
12. Reporting & Monitoring

---

## 5. Proposed Use Cases by Domain

---

### 5.1 Authentication & Account Management

**Bounded Context:** `auth` (Better Auth library + `auth.schema.ts`)  
**BRD Feature:** FE-1

| UC ID | Use Case Name | Primary Actor | Priority | Status |
|-------|---------------|---------------|----------|--------|
| UC-AUTH-01 | Register account with email and password | Guest | P1 | **Implemented** |
| UC-AUTH-02 | Sign in with email and password | Registered User | P1 | **Implemented** |
| UC-AUTH-03 | Sign out / invalidate session | Authenticated User | P1 | **Implemented** |
| UC-AUTH-04 | Refresh authentication session | Authenticated User | P1 | **Implemented** |
| UC-AUTH-05 | View own profile | Authenticated User | P2 | **Implemented** |
| UC-AUTH-06 | Update own profile (name, avatar) | Authenticated User | P2 | **Implemented** |
| UC-AUTH-07 | Request email verification | Customer | P2 | **Implemented** |
| UC-AUTH-08 | Assign role to user account | System Administrator | P1 | **Implemented** |
| UC-AUTH-09 | Ban or suspend a user account | System Administrator | P2 | **Implemented** |
| UC-AUTH-10 | Impersonate a user account (admin debug) | System Administrator | P3 | **Partial** |
| UC-AUTH-11 | Sign in via social identity provider (OAuth) | Guest | P3 | **Planned** |
| UC-AUTH-12 | Reset forgotten password | Registered User | P2 | **Partial** |
  
**Implementation Notes:**
- Authentication is fully delegated to the `better-auth` library with the `emailAndPassword` plugin enabled (`auth.ts`).
- The `admin` plugin is loaded, enabling role management, user banning, and impersonation at the library level.
- The `bearer` plugin enables token-based session auth for API consumers (mobile).
- Social OAuth provider configuration is not present in `auth.ts` — UC-AUTH-11 is Planned.
- User roles: `admin`, `restaurant`, `shipper`, `user` (defined in `APP_ROLES` constant).

---

### 5.2 Restaurant Discovery & Search

**Bounded Context:** `restaurant-catalog` → `search`, `restaurant`  
**BRD Feature:** FE-2

| UC ID | Use Case Name | Primary Actor | Priority | Status |
|-------|---------------|---------------|----------|--------|
| UC-DISC-01 | Browse approved restaurant listings | Guest / Customer | P1 | **Implemented** |
| UC-DISC-02 | View restaurant details (profile, menu, hours) | Guest / Customer | P1 | **Implemented** |
| UC-DISC-03 | Search restaurants and menu items by keyword | Guest / Customer | P1 | **Implemented** |
| UC-DISC-04 | Filter search results by cuisine type | Guest / Customer | P2 | **Implemented** |
| UC-DISC-05 | Filter search results by category or tag | Guest / Customer | P2 | **Implemented** |
| UC-DISC-06 | Filter results by delivery radius (geolocation) | Guest / Customer | P1 | **Implemented** |
| UC-DISC-07 | View delivery fee estimate for a restaurant | Guest / Customer | P1 | **Implemented** |
| UC-DISC-08 | View menu item modifier options | Guest / Customer | P1 | **Implemented** |
| UC-DISC-10 | View restaurant ratings and review summary | Guest / Customer | P3 | **Planned** |

**Implementation Notes:**
- `GET /search` accepts `q`, `category`, `cuisineType`, `tag`, `lat`, `lon`, `radiusKm`, `offset`, `limit` — all annotated `@AllowAnonymous`.
- `GET /restaurants` returns only `isApproved = true` restaurants (enforced in `RestaurantService.findAll`).
- `GET /restaurants/:restaurantId/delivery-zones/delivery-estimate` uses Haversine formula; responds `422` when customer is out of range.
- `GET /menu-items/:menuItemId/modifier-groups` exposes modifier groups with options publicly.
- Search uses accent-insensitive matching; unified restaurant + menu item results with separate totals.

---

### 5.3 Cart & Checkout

**Bounded Context:** `ordering` → `cart`  
**BRD Feature:** FE-3

| UC ID | Use Case Name | Primary Actor | Priority | Status |
|-------|---------------|---------------|----------|--------|
| UC-CART-01 | View current cart contents | Customer | P1 | **Implemented** |
| UC-CART-02 | Add menu item to cart | Customer | P1 | **Implemented** |
| UC-CART-03 | Update item quantity in cart | Customer | P1 | **Implemented** |
| UC-CART-04 | Update modifier selections on a cart item | Customer | P1 | **Implemented** |
| UC-CART-05 | Remove item from cart | Customer | P1 | **Implemented** |
| UC-CART-06 | Clear entire cart | Customer | P1 | **Implemented** |
| UC-CART-07 | Place order (checkout) | Customer | P1 | **Implemented** |
| UC-CART-08 | Validate single-restaurant cart constraint at checkout | System | P1 | **Implemented** |
| UC-CART-09 | Validate delivery radius eligibility at checkout | System | P1 | **Implemented** |
| UC-CART-10 | Apply idempotency key to prevent duplicate orders | System | P1 | **Implemented** |
| UC-CART-11 | Select payment method (COD or VNPay) at checkout | Customer | P1 | **Implemented** |
| UC-CART-12 | Apply promotional discount code at checkout | Customer | P3 | **Planned** |

**Implementation Notes:**
- Cart is Redis-backed (`CartRedisRepository`); cart data keyed by `CART_KEY_PREFIX + userId`.
- `POST /checkout` dispatches `PlaceOrderCommand`; handler validates snapshot data, applies idempotency check via Redis, computes delivery fee via `DeliveryZoneSnapshotRepository` and `GeoService`.
- Single-restaurant constraint (BR-2) enforced inside cart service at `POST /carts/my/items`.
- Modifier pricing is re-resolved from ACL snapshot at checkout time — NOT from cart add-time data (price integrity guarantee).
- Idempotency TTL controlled by `ORDER_IDEMPOTENCY_TTL_SECONDS` from `app_settings` table.

---

### 5.4 Payment

**Bounded Context:** `payment`  
**BRD Feature:** FE-4

| UC ID | Use Case Name | Primary Actor | Priority | Status |
|-------|---------------|---------------|----------|--------|
| UC-PAY-01 | Generate VNPay payment URL at checkout | Customer | P1 | **Implemented** |
| UC-PAY-02 | Process VNPay IPN callback (server-to-server) | VNPay | P1 | **Implemented** |
| UC-PAY-03 | Handle VNPay browser return redirect (UI feedback) | Customer | P1 | **Implemented** |
| UC-PAY-04 | Transition order to `paid` on successful payment | System | P1 | **Implemented** |
| UC-PAY-05 | Auto-cancel unpaid orders after payment timeout | System | P1 | **Implemented** |
| UC-PAY-06 | Initiate refund on post-payment order cancellation | System | P1 | **Implemented** |
| UC-PAY-07 | Initiate admin-requested refund on delivered order | System Administrator | P1 | **Implemented** |
| UC-PAY-08 | Process Cash-on-Delivery order (no payment gateway) | Customer | P1 | **Implemented** |
| UC-PAY-10 | View payment receipt / transaction history | Customer | P2 | **Partial** |

**Implementation Notes:**
- `GET /payments/vnpay/ipn` — public, server-to-server; HMAC SHA512 signature verified in `ProcessIpnHandler` before any state change (security control, OWASP A01).
- `GET /payments/vnpay/return` — public browser redirect; UI display only, no DB mutation.
- `PaymentTimeoutTask` runs `@Cron(EVERY_MINUTE)` — transitions `pending`/`awaiting_ipn` transactions to `failed`, publishes `PaymentFailedEvent`.
- Refund triggering is event-driven: `OrderCancelledAfterPaymentEvent` dispatched when `paid→cancelled` or `confirmed→cancelled` (VNPay orders only); COD orders have no monetary refund.
- Admin dispute refund via `POST /orders/:id/refund` (admin role only) triggers `delivered→refunded` transition.

---

### 5.5 Order Tracking & History

**Bounded Context:** `ordering` → `order-lifecycle`, `order-history`  
**BRD Feature:** FE-5

| UC ID | Use Case Name | Primary Actor | Priority | Status |
|-------|---------------|---------------|----------|--------|
| UC-ORD-01 | View own order history (paginated) | Customer | P1 | **Implemented** |
| UC-ORD-02 | View order detail | Customer | P1 | **Implemented** |
| UC-ORD-03 | Track current order status in real-time | Customer | P1 | **Implemented** |
| UC-ORD-04 | View order status timeline / audit log | Customer | P1 | **Implemented** |
| UC-ORD-05 | Reorder from a previous order | Customer | P2 | **Implemented** |
| UC-ORD-06 | Cancel an order (pre-preparation) | Customer | P1 | **Implemented** |
| UC-ORD-07 | Auto-cancel order on restaurant accept timeout | System | P1 | **Implemented** |

**Implementation Notes:**
- `GET /orders/my` — paginated customer order list.
- `GET /orders/my/:id` — customer order detail.
- `GET /orders/my/:id/reorder` — returns item + modifier IDs for cart pre-fill.
- `GET /orders/:id/timeline` — returns `orderStatusLogs` rows for the order (all actors can view their own orders).
- `PATCH /orders/:id/cancel` — customer-accessible; enforced to `pending` and `paid` states only by transitions map.
- `OrderTimeoutTask` (@Cron EVERY_MINUTE) auto-cancels orders that exceed `RESTAURANT_ACCEPT_TIMEOUT_SECONDS` while in `pending` state.

---

### 5.6 Restaurant Operations

**Bounded Context:** `restaurant-catalog` → `restaurant`, `menu`, `zones`; `ordering` → `order-lifecycle`, `order-history`  
**BRD Feature:** FE-6

| UC ID | Use Case Name | Primary Actor | Priority | Status |
|-------|---------------|---------------|----------|--------|
| UC-REST-01 | Register / onboard new restaurant | Restaurant Partner | P1 | **Implemented** |
| UC-REST-02 | Update restaurant profile (name, address, hours, logo) | Restaurant Partner | P1 | **Implemented** |
| UC-REST-03 | Toggle restaurant open/closed status | Restaurant Partner | P1 | **Implemented** |
| UC-REST-04 | View own order queue (kitchen view — active orders) | Restaurant Partner | P1 | **Implemented** |
| UC-REST-05 | View paginated order history | Restaurant Partner | P1 | **Implemented** |
| UC-REST-06 | Accept (confirm) incoming order | Restaurant Partner | P1 | **Implemented** |
| UC-REST-07 | Start preparing an order | Restaurant Partner | P1 | **Implemented** |
| UC-REST-08 | Mark order as ready for pickup | Restaurant Partner | P1 | **Implemented** |
| UC-REST-09 | Cancel an order (pre-preparation) | Restaurant Partner | P1 | **Implemented** |
| UC-REST-10 | Create menu category | Restaurant Partner | P1 | **Implemented** |
| UC-REST-11 | Update / delete menu category | Restaurant Partner | P1 | **Implemented** |
| UC-REST-12 | Create menu item | Restaurant Partner | P1 | **Implemented** |
| UC-REST-13 | Update menu item (price, description, image) | Restaurant Partner | P1 | **Implemented** |
| UC-REST-14 | Toggle menu item availability (active / sold out) | Restaurant Partner | P1 | **Implemented** |
| UC-REST-15 | Delete menu item | Restaurant Partner | P1 | **Implemented** |
| UC-REST-16 | Create modifier group for menu item | Restaurant Partner | P1 | **Implemented** |
| UC-REST-17 | Add modifier option to modifier group | Restaurant Partner | P1 | **Implemented** |
| UC-REST-18 | Update / delete modifier group or option | Restaurant Partner | P1 | **Implemented** |
| UC-REST-19 | Configure delivery zones (radius, fee, ETA) | Restaurant Partner | P1 | **Implemented** |
| UC-REST-20 | Update or deactivate delivery zone | Restaurant Partner | P1 | **Implemented** |
| UC-REST-21 | View delivery zone list | Guest / Customer | P1 | **Implemented** |
| UC-REST-22 | Manage flash sale / time-limited pricing | Restaurant Partner | P3 | **Planned** |


**Implementation Notes:**
- `POST /restaurants` creates a restaurant in unapproved state (`isApproved = false` default) — requires admin approval before appearing in public listings.
- `PATCH /restaurants/:id` allows both owner and admin to update; `isApproved` field is admin-controlled only (enforced in DTO description; full logic in service layer).
- Kitchen view: `GET /restaurant/orders/active` returns `confirmed`, `preparing`, `ready_for_pickup` states — no pagination — for live operational screen.
- Modifier groups modelled as `menu-items/:menuItemId/modifier-groups`; options as sub-resources.
- Delivery zones: `restaurants/:restaurantId/delivery-zones` with full CRUD; `delivery-estimate` sub-route uses Haversine + zone pricing rules.
- `MenuItemUpdatedEvent` and `RestaurantUpdatedEvent` published on changes — ACL snapshot tables for ordering context kept in sync.

---

### 5.7 Delivery Operations

**Bounded Context:** `ordering` → `order-lifecycle`, `order-history`  
**BRD Feature:** FE-7

| UC ID | Use Case Name | Primary Actor | Priority | Status |
|-------|---------------|---------------|----------|--------|
| UC-SHIP-01 | View pool of orders available for pickup | Delivery Personnel | P1 | **Implemented** |
| UC-SHIP-02 | Claim / self-assign an available order | Delivery Personnel | P1 | **Implemented** |
| UC-SHIP-03 | Confirm order pickup from restaurant | Delivery Personnel | P1 | **Implemented** |
| UC-SHIP-04 | Update status to en-route (delivering) | Delivery Personnel | P1 | **Implemented** |
| UC-SHIP-05 | Confirm delivery completion | Delivery Personnel | P1 | **Implemented** |
| UC-SHIP-06 | View own current active delivery | Delivery Personnel | P1 | **Implemented** |
| UC-SHIP-07 | View own delivery history (paginated) | Delivery Personnel | P1 | **Implemented** |
| UC-SHIP-08 | View optimized route suggestions | Delivery Personnel | P3 | **Planned** |
| UC-SHIP-09 | View own earnings and commission statement | Delivery Personnel | P3 | **Planned** |

**Implementation Notes:**
- `GET /shipper/orders/available` — public pool of `ready_for_pickup` orders; hard-capped at 50 rows.
- `PATCH /orders/:id/pickup` — transitions `ready_for_pickup → picked_up` (shipper or admin).
- `PATCH /orders/:id/en-route` — transitions `picked_up → delivering`.
- `PATCH /orders/:id/deliver` — transitions `delivering → delivered`.
- Self-assignment (UC-SHIP-02) is the act of calling `PATCH /orders/:id/pickup` on an available order — no explicit "claim" endpoint; first shipper to call wins.
- `GET /shipper/orders/active` — returns the shipper's current in-progress delivery (at most one).
- `GET /shipper/orders/history` — paginated list of completed (`delivered`) orders.
- Route optimization and earnings reporting not implemented.

---

### 5.8 Notifications

**Bounded Context:** `notification`  
**BRD Feature:** FE-12

| UC ID | Use Case Name | Primary Actor | Priority | Status |
|-------|---------------|---------------|----------|--------|
| UC-NOTIF-01 | Receive real-time in-app notification on order placed | Customer | P1 | **Implemented** |
| UC-NOTIF-02 | Receive real-time in-app notification on order status change | Customer | P1 | **Implemented** |
| UC-NOTIF-03 | Receive push notification (FCM) on order events | Customer | P1 | **Implemented** |
| UC-NOTIF-04 | Receive email confirmation on order delivered | Customer | P2 | **Implemented** |
| UC-NOTIF-05 | Receive in-app notification for new order placed at restaurant | Restaurant Partner | P1 | **Implemented** |
| UC-NOTIF-06 | Receive push notification for new order at restaurant | Restaurant Partner | P2 | **Implemented** |
| UC-NOTIF-07 | Connect to real-time notification channel (WebSocket) | Authenticated User | P1 | **Implemented** |
| UC-NOTIF-08 | View in-app notification inbox (paginated) | Authenticated User | P1 | **Implemented** |
| UC-NOTIF-09 | View unread notification count | Authenticated User | P1 | **Implemented** |
| UC-NOTIF-10 | Mark notification as read | Authenticated User | P1 | **Implemented** |
| UC-NOTIF-11 | Mark all notifications as read | Authenticated User | P1 | **Implemented** |
| UC-NOTIF-12 | Register device push token | Authenticated User | P1 | **Implemented** |
| UC-NOTIF-13 | Remove / deactivate device push token | Authenticated User | P1 | **Implemented** |
| UC-NOTIF-14 | View registered push tokens | Authenticated User | P2 | **Implemented** |
| UC-NOTIF-15 | Update notification delivery preferences | Authenticated User | P2 | **Implemented** |
| UC-NOTIF-16 | View notification delivery preferences | Authenticated User | P2 | **Implemented** |
| UC-NOTIF-17 | Receive payment failure notification | Customer | P1 | **Implemented** |
| UC-NOTIF-18 | Receive payment confirmation notification | Customer | P1 | **Implemented** |
| UC-NOTIF-19 | Notify restaurant on post-payment order cancellation | Restaurant Partner | P1 | **Implemented** |
| UC-NOTIF-20 | Respect quiet hours for push/email delivery | Authenticated User | P2 | **Implemented** |
| UC-NOTIF-21 | Receive shipper assignment notification | Customer | P3 | **Planned** |

**Implementation Notes:**
- WebSocket gateway on `/notifications` namespace; room strategy `room:user:{userId}` supports multi-device.
- Presence tracked via Redis reference count (`ws:connections:{userId}`, TTL 90s, heartbeat refresh every 25s).
- Notification channels: `in_app`, `push`, `email` (Nodemailer).
- `STATUS_TRANSITION_NOTIFICATION` map in `order-status-changed.handler.ts` defines exactly which transitions trigger notifications to which actor on which channels.
- Delivered order triggers: `in_app + push + email` (only state transition with email).
- `QuietHoursService` suppresses push/email during configured quiet hours; in-app notifications always persisted.
- Device token cleanup task (`device-token-cleanup.task.ts`) runs on a schedule to purge inactive tokens.
- REST endpoints: `GET/PATCH /notifications/my/preferences`, `POST/DELETE/GET /notifications/my/push-tokens`, `GET /notifications/my`, `GET /notifications/my/unread-count`, `PATCH /notifications/my/read-all`, `PATCH /notifications/:id/read`.

---

### 5.9 Reviews & Feedback

**Bounded Context:** Not yet implemented  
**BRD Feature:** FE-9

| UC ID | Use Case Name | Primary Actor | Priority | Status |
|-------|---------------|---------------|----------|--------|
| UC-REV-01 | Submit rating and review for a delivered order | Customer | P3 | **Planned** |
| UC-REV-02 | View reviews for a restaurant | Guest / Customer | P3 | **Planned** |
| UC-REV-03 | Respond to a customer review | Restaurant Partner | P3 | **Planned** |
| UC-REV-04 | Flag / report abusive review | Customer | P3 | **Planned** |
| UC-REV-05 | Moderate and remove reviews | System Administrator | P3 | **Planned** |
| UC-REV-06 | View aggregate rating statistics for a restaurant | Guest / Customer | P3 | **Planned** |

**Implementation Notes:**
- No review or rating module, schema, controller, or service exists in the codebase.
- US-33 in User Stories documents this as a "Could" priority story.
- Review eligibility gate (only customers with `delivered` orders may review) must be enforced at implementation time.
- Planned for Release 2.

---

### 5.10 Administration

**Bounded Context:** `auth` (Better Auth admin plugin), `restaurant-catalog`, `ordering`  
**BRD Feature:** FE-8

| UC ID | Use Case Name | Primary Actor | Priority | Status |
|-------|---------------|---------------|----------|--------|
| UC-ADMIN-01 | Approve restaurant partner registration | System Administrator | P1 | **Implemented** |
| UC-ADMIN-02 | Suspend or deactivate restaurant | System Administrator | P1 | **Implemented** |
| UC-ADMIN-03 | Approve delivery personnel registration | System Administrator | P1 | **Partial** |
| UC-ADMIN-04 | Suspend or deactivate delivery personnel | System Administrator | P1 | **Partial** |
| UC-ADMIN-05 | View full platform order list with filters | System Administrator | P1 | **Implemented** |
| UC-ADMIN-06 | View detail for any order | System Administrator | P1 | **Implemented** |
| UC-ADMIN-07 | Override order status (cancel, confirm) | System Administrator | P1 | **Implemented** |
| UC-ADMIN-08 | Issue refund on disputed delivery | System Administrator | P1 | **Implemented** |
| UC-ADMIN-09 | Manage platform application settings | System Administrator | P2 | **Partial** |
| UC-ADMIN-10 | View and manage all user accounts | System Administrator | P1 | **Implemented** |
| UC-ADMIN-11 | Ban or unban a user account | System Administrator | P1 | **Implemented** |
| UC-ADMIN-12 | Generate platform revenue / commission report | System Administrator | P2 | **Planned** |
| UC-ADMIN-13 | View promotion and discount campaign performance | System Administrator | P3 | **Planned** |
| UC-ADMIN-14 | View audit log of admin actions | System Administrator | P2 | **Planned** |
| UC-ADMIN-15 | Configure commission rates per restaurant | System Administrator | P2 | **Partial** |

**Implementation Notes:**
- Restaurant approval: `PATCH /restaurants/:id` with `isApproved: true` in request body; admin role required to mutate this field (enforced via `UpdateRestaurantDto` and ownership check bypass for admins).
- Admin user management: provided by Better Auth `admin` plugin — ban, role assignment, impersonation.
- `GET /admin/orders` — full platform order list with `AdminOrderFiltersDto` composable filters (admin only via `hasRole` check).
- `GET /admin/orders/:id` — full detail for any order regardless of ownership.
- Admin can perform all order lifecycle transitions (all TRANSITIONS entries allow `admin` role).
- `POST /orders/:id/refund` — admin-only endpoint for `delivered → refunded` transition.
- `AppSettingsService` reads `app_settings` DB table — commission rate, timeout thresholds; no admin REST endpoint for mutation (Partial).
- Shipper approval: role assignment via Better Auth admin plugin; no dedicated approval workflow controller.

---

### 5.11 Real-time Tracking

**Bounded Context:** `notification` (WebSocket gateway)  
**BRD Feature:** FE-5 (R2 component)

| UC ID | Use Case Name | Primary Actor | Priority | Status |
|-------|---------------|---------------|----------|--------|
| UC-TRACK-01 | Receive real-time order status updates via WebSocket | Customer | P1 | **Implemented** |
| UC-TRACK-02 | View live GPS position of delivery personnel on map | Customer | P3 | **Planned** |
| UC-TRACK-03 | Share real-time location during active delivery | Delivery Personnel | P3 | **Planned** |
| UC-TRACK-04 | View estimated arrival time (ETA) updates | Customer | P2 | **Partial** |

**Implementation Notes:**
- UC-TRACK-01 is delivered via the WebSocket notification gateway (`/notifications` namespace) — every order status transition publishes an `order_status_changed` event to the customer's room.
- Static ETA is computed at checkout from zone parameters (`avgSpeedKmh`, `prepTimeMinutes`, `bufferMinutes`) and stored on the order — not dynamically updated (UC-TRACK-04 is Partial).
- Live GPS tracking requires a separate location broadcast channel and mobile GPS integration — not implemented.

---

### 5.12 Reporting & Monitoring

**Bounded Context:** `ordering` → `order-history`; `payment`  
**BRD Feature:** FE-8 (admin sub-feature)

| UC ID | Use Case Name | Primary Actor | Priority | Status |
|-------|---------------|---------------|----------|--------|
| UC-RPT-01 | View platform-wide order volume and status breakdown | System Administrator | P2 | **Partial** |
| UC-RPT-02 | View restaurant-specific order performance metrics | System Administrator | P2 | **Planned** |
| UC-RPT-03 | View gross merchandise value (GMV) report | System Administrator | P2 | **Planned** |
| UC-RPT-04 | View commission earned by period | System Administrator | P2 | **Planned** |
| UC-RPT-05 | Export order data as CSV | System Administrator | P2 | **Planned** |
| UC-RPT-06 | View shipper delivery performance metrics | System Administrator | P3 | **Planned** |
| UC-RPT-07 | View demand heatmap by geography | System Administrator | P3 | **Planned** |

**Implementation Notes:**
- Reporting infrastructure relies on the existing `GET /admin/orders` endpoint with composable filters — sufficient for basic monitoring but no aggregation or charting backend exists.
- Commission calculation parameters stored in `app_settings` but no revenue reporting endpoint exists.
- Full reporting suite deferred to Release 2.

---

## 6. Future & Planned Use Cases Summary

The following use cases are explicitly deferred to future releases and excluded from MVP scope:

| Domain | UC ID | Use Case | Target Release |
|--------|-------|----------|----------------|
| Authentication | UC-AUTH-11 | Sign in via social OAuth | R2 |
| Discovery | UC-DISC-10 | View ratings / review summary | R2 |
| Reviews | UC-REV-01 through UC-REV-06 | Full review and rating module | R2 |
| Real-time Tracking | UC-TRACK-02 | Live GPS shipper tracking | R2 |
| Real-time Tracking | UC-TRACK-03 | Shipper location broadcast | R2 |
| Restaurant Operations | UC-REST-22 | Flash sale / time-limited pricing | R2 |
| Delivery Operations | UC-SHIP-08 | Route optimization | R2 |
| Delivery Operations | UC-SHIP-09 | Earnings and commission statement | R2 |
| Administration | UC-ADMIN-12 | Revenue / commission reports | R2 |
| Administration | UC-ADMIN-13 | Promotion campaign analytics | R3 |
| Administration | UC-ADMIN-14 | Admin audit log | R2 |
| Reporting | UC-RPT-02 through UC-RPT-07 | Full reporting suite | R2 |
| Promotions | (TBD) | Coupon / loyalty points system | R2+ |

---

## 7. Diagram Planning Recommendations

The following UML / architecture diagrams are recommended for subsequent documentation phases. This section does not contain the diagrams — it identifies which Use Case groups benefit most from visual representation and what perspective each diagram should take.

### 7.1 System-Level Use Case Diagram

**Scope:** All primary actors and the top-level use case groups  
**Format:** UML Use Case Diagram (umbrella view)  
**Recommended inclusions:** Guest, Customer, Restaurant Partner, Shipper, Administrator, System, VNPay as actors; domain ellipses as use case groupings; `«include»` for authentication dependency; `«extend»` for VNPay-specific payment flow  
**Priority:** High — needed for stakeholder communication

### 7.2 Customer Ordering Domain Diagram

**Scope:** §5.2 Discovery + §5.3 Cart & Checkout + §5.4 Payment + §5.5 Order Tracking  
**Format:** UML Use Case Diagram (detailed)  
**Key relationships:** Customer → Browse Restaurant → View Menu (dependency chain); Checkout `«includes»` Validate Delivery Zone; Checkout `«extends»` VNPay Payment  
**Priority:** High — core business flow

### 7.3 Restaurant Operations Domain Diagram

**Scope:** §5.6 Restaurant Operations (menu, orders, zones)  
**Format:** UML Use Case Diagram  
**Key actors:** Restaurant Partner, Admin (as secondary actor with elevated permissions)  
**Priority:** Medium

### 7.4 Order State Machine Diagram

**Scope:** All 10 order states and 12 transitions (see BRD §6.3)  
**Format:** UML State Machine Diagram  
**Note:** Already partially documented in BRD §6.3 as Mermaid flowchart; a formal state machine diagram adds guard conditions and actor labels  
**Priority:** Medium

### 7.5 Notification Event Routing Diagram

**Scope:** All domain events → notification handlers → delivery channels  
**Format:** Event flow / sequence diagram  
**Key flows:** `OrderPlacedEvent` → customer (in_app, push) + restaurant (in_app, push); `PaymentConfirmedEvent`; `OrderCancelledAfterPaymentEvent`  
**Priority:** Low — valuable for development reference

### 7.6 System Actor (Automated Process) Diagram

**Scope:** `OrderTimeoutTask`, `PaymentTimeoutTask`, `DeviceTokenCleanupTask`  
**Format:** Sequence or activity diagram  
**Priority:** Low — internal technical reference

---

## 8. Traceability Preparation

This section establishes the traceability matrix structure to be populated when Use Case Specifications are written.

### 8.1 Traceability Matrix Template

| Use Case ID | Use Case Name | BRD Feature | BRD Business Rule | User Story ID | API Endpoint(s) | Test Coverage |
|-------------|---------------|-------------|-------------------|---------------|-----------------|---------------|
| UC-CART-07 | Place order (checkout) | FE-3 | BR-2, BR-3 | US-08, US-09 | POST /checkout | — |
| UC-PAY-02 | Process VNPay IPN | FE-4 | BR-4 | US-15 | GET /payments/vnpay/ipn | — |
| UC-SHIP-02 | Claim available order | FE-7 | BR-7 | US-22 | PATCH /orders/:id/pickup | — |
| … | … | … | … | … | … | … |

> The full matrix is to be completed in the Use Case Specification phase. UC IDs and BRD feature codes are stable anchors.

### 8.2 Business Rule Cross-Reference

| Business Rule | Enforced In | Related Use Cases |
|---------------|-------------|-------------------|
| BR-1: Manual partner approval | `restaurants.isApproved` field; admin PATCH endpoint | UC-ADMIN-01, UC-ADMIN-02, UC-ADMIN-03 |
| BR-2: Single-restaurant cart | `CartService` add-item validation | UC-CART-02, UC-CART-08 |
| BR-3: Delivery radius validation | `GeoService`, `DeliveryZoneSnapshotRepository` | UC-CART-09, UC-DISC-07 |
| BR-4: COD and VNPay supported | `PlaceOrderCommand`, `PaymentService` | UC-PAY-01, UC-PAY-08 |
| BR-5: Commission = % of GMV | `AppSettingsService` (key: commission rate) | UC-ADMIN-15, UC-RPT-04 |
| BR-6: Single geographic service area | `GeoService`, delivery zone radius check | UC-CART-09, UC-DISC-06 |
| BR-7: Sequential order lifecycle | `TRANSITIONS` map in `transitions.ts` | UC-REST-06 through UC-REST-09, UC-SHIP-02 through UC-SHIP-05 |
| BR-8: Real-time availability control | `isOpen` / `isSoldOut` fields on restaurant / menu item | UC-REST-03, UC-REST-14 |
| BR-9: No B2B or subscription | Architecture constraint (no schema / endpoint) | — |

### 8.3 User Story to Use Case Mapping (Selected)

| User Story ID | Story Title (summary) | Maps To Use Cases |
|---------------|-----------------------|-------------------|
| US-01 | Customer account registration | UC-AUTH-01, UC-AUTH-07 |
| US-02 | Unified restaurant and menu discovery | UC-DISC-01 through UC-DISC-08 |
| US-07 | Customer places order | UC-CART-01 through UC-CART-11 |
| US-08 | Customer pays via VNPay | UC-PAY-01, UC-PAY-02, UC-PAY-03, UC-PAY-04 |
| US-09 | Customer pays via COD | UC-PAY-08 |
| US-10 | Customer cancels order | UC-ORD-06 |
| US-15 | VNPay IPN processing | UC-PAY-02, UC-PAY-04 |
| US-20 | Restaurant accepts order | UC-REST-06 |
| US-21 | Restaurant manages menu | UC-REST-10 through UC-REST-18 |
| US-22 | Shipper claims and delivers order | UC-SHIP-01 through UC-SHIP-07 |
| US-25 | Admin approves restaurant | UC-ADMIN-01 |
| US-33 | Customer submits review | UC-REV-01 (Planned) |

### 8.4 Use Case Count Summary

| Domain | Implemented | Partial | Planned | Total |
|--------|-------------|---------|---------|-------|
| Authentication & Account | 9 | 2 | 1 | 12 |
| Restaurant Discovery | 8 | 0 | 2 | 10 |
| Cart & Checkout | 11 | 0 | 1 | 12 |
| Payment | 8 | 1 | 1 | 10 |
| Order Tracking & History | 7 | 0 | 0 | 7 |
| Restaurant Operations | 21 | 0 | 3 | 24 |
| Delivery Operations | 7 | 0 | 2 | 9 |
| Notifications | 20 | 1 | 0 | 21 |
| Reviews & Feedback | 0 | 0 | 6 | 6 |
| Administration | 11 | 3 | 4 | 18 (approx) |
| Real-time Tracking | 1 | 1 | 2 | 4 |
| Reporting & Monitoring | 1 | 0 | 6 | 7 |
| **Total** | **104** | **8** | **28** | **~140** |

---

*End of Use Case Proposal v1.0*

*Next step: Prioritize Use Case Specifications for P1 (Must) use cases in the Customer Ordering and Payment domains. Use UC IDs from this document as identifiers throughout.*
