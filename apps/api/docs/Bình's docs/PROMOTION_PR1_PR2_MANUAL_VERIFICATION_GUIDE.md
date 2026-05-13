# Promotion PR-1 + PR-2 — Manual QA Verification Guide

> **Scope:** Phase PR-1 (Schema + Engine) and Phase PR-2 (Admin CRUD)
> **Base URL:** `http://localhost:3000/api`
> **Auth:** Bearer token from Better Auth `/api/auth/sign-in/email`
> **Swagger UI:** `http://localhost:3000/api/docs`

---

## Prerequisites

### 1. Start the server

```bash
cd apps/api
pnpm start:dev
```

### 2. Obtain tokens

Sign in as admin and as a restaurant owner using the seed credentials:

```http
POST /api/auth/sign-in/email
Content-Type: application/json

{ "email": "admin@soli.test", "password": "Admin123!" }
```

> **Note:** Use whatever test accounts exist in your dev DB. The seed script creates
> `ownerUserId = 11111111-1111-4111-8111-111111111111` (owner of R1–R3).

### 3. Seed reference IDs (from `src/drizzle/seeds/seed.ts`)

| Resource | ID |
|---|---|
| Restaurant 1 (Phở Bắc) | `fe8b2648-2260-4bc5-9acd-d88972148c78` |
| Restaurant 3 (Cơm Tấm) | `dddddddd-dddd-4ddd-8ddd-dddddddddddd` |
| Restaurant 4 (Seoul BBQ) | `eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee` |
| Promo P1 (Platform 10%) | `a0000001-0000-4000-8000-000000000001` |
| Promo P4 (Cơm Tấm 15%) | `a0000004-0000-4000-8000-000000000004` |
| Coupon COMTAM15 | `c0000001-0000-4000-8000-000000000001` |

---

## Part A — Schema Verification

### A1. Check tables exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('promotions', 'coupon_codes', 'promotion_usages');
```

**Expected:** 3 rows returned.

### A2. Check enums exist

```sql
SELECT typname FROM pg_type
WHERE typname IN (
  'promotion_type', 'promotion_scope', 'promotion_status',
  'promotion_trigger', 'stacking_mode', 'coupon_status', 'usage_status'
);
```

**Expected:** 7 rows returned.

### A3. Seed data loaded

```sql
SELECT id, name, status, type, scope, trigger FROM promotions ORDER BY created_at;
```

**Expected:** 5 rows — P1 (active), P2 (active), P3 (active), P4 (active), P5 (draft).

```sql
SELECT code, status, max_uses FROM coupon_codes;
```

**Expected:** 2 rows — `COMTAM15` (200 uses), `WELCOME10` (50 uses).

---

## Part B — Admin CRUD (Platform Admin)

> All requests require `Authorization: Bearer <admin_token>`.

### B1. Create a promotion (POST `/promotions/admin`)

```http
POST /api/promotions/admin
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Test Promo B1",
  "type": "percentage",
  "scope": "platform",
  "trigger": "auto_apply",
  "discountValue": 10,
  "maxDiscountAmount": 50000,
  "startsAt": "2025-01-01T00:00:00.000Z",
  "endsAt": "2030-12-31T23:59:59.000Z"
}
```

**Expected:** `201 Created` with `{ id, name, status: "draft", type: "percentage", ... }`

Save the `id` as `$PROMO_ID`.

### B2. Get promotion (GET `/promotions/admin/:id`)

```http
GET /api/promotions/admin/$PROMO_ID
Authorization: Bearer <admin_token>
```

**Expected:** `200 OK` with full promotion object.

### B3. List promotions (GET `/promotions/admin`)

```http
GET /api/promotions/admin?status=draft&limit=10&offset=0
Authorization: Bearer <admin_token>
```

**Expected:** `200 OK` with `{ items: [...], total, offset, limit }`.

### B4. Update promotion (PATCH `/promotions/admin/:id`)

```http
PATCH /api/promotions/admin/$PROMO_ID
Authorization: Bearer <admin_token>
Content-Type: application/json

{ "name": "Test Promo B1 — Updated" }
```

**Expected:** `200 OK` with updated `name`.

### B5. Activate promotion (PATCH `/promotions/admin/:id/activate`)

```http
PATCH /api/promotions/admin/$PROMO_ID/activate
Authorization: Bearer <admin_token>
```

**Expected:** `200 OK` with `status: "active"`.

### B6. Pause promotion (PATCH `/promotions/admin/:id/pause`)

```http
PATCH /api/promotions/admin/$PROMO_ID/pause
Authorization: Bearer <admin_token>
```

**Expected:** `200 OK` with `status: "paused"`.

### B7. Re-activate paused promotion

Repeat B5 on a `paused` promotion.

**Expected:** `200 OK` with `status: "active"`.

### B8. Cancel promotion (DELETE `/promotions/admin/:id`)

```http
DELETE /api/promotions/admin/$PROMO_ID
Authorization: Bearer <admin_token>
```

**Expected:** `204 No Content`.

Verify it no longer appears in active list:

```http
GET /api/promotions/admin?status=active
```

The cancelled promo should **not** be in `items`.

### B9. Create coupon codes (POST `/promotions/admin/:id/coupons`)

Use P4 (`a0000004-0000-4000-8000-000000000004`):

```http
POST /api/promotions/admin/a0000004-0000-4000-8000-000000000004/coupons
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "codes": ["TESTCODE1", "TESTCODE2"],
  "maxUsesPerCode": 100,
  "expiresAt": "2030-12-31T23:59:59.000Z"
}
```

**Expected:** `201 Created` with an **array** of `CouponCodeResponseDto` objects (not `{data: [...]}`).

### B10. Duplicate coupon code → 409

Re-send the same request as B9:

**Expected:** `409 Conflict` with `"One or more coupon codes already exist"`.

### B11. Cannot add coupons to auto_apply promo → 400

```http
POST /api/promotions/admin/a0000001-0000-4000-8000-000000000001/coupons
Authorization: Bearer <admin_token>
Content-Type: application/json

{ "codes": ["BADCODE"], "maxUsesPerCode": 10 }
```

**Expected:** `400 Bad Request` — auto_apply promos do not support coupon codes.

### B12. List coupon codes (GET `/promotions/admin/:id/coupons`)

```http
GET /api/promotions/admin/a0000004-0000-4000-8000-000000000004/coupons
Authorization: Bearer <admin_token>
```

**Expected:** `200 OK` with `{ items, total, offset, limit }`.

---

## Part C — Validation Edge Cases

### C1. Discount value > 100 for percentage → 400

```http
POST /api/promotions/admin
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Invalid Promo",
  "type": "percentage",
  "scope": "platform",
  "trigger": "auto_apply",
  "discountValue": 150,
  "startsAt": "2025-01-01T00:00:00.000Z",
  "endsAt": "2030-12-31T23:59:59.000Z"
}
```

**Expected:** `400 Bad Request`.

### C2. endsAt before startsAt → 400

```http
POST /api/promotions/admin
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Bad Dates",
  "type": "fixed_amount",
  "scope": "platform",
  "trigger": "auto_apply",
  "discountValue": 10000,
  "startsAt": "2030-01-01T00:00:00.000Z",
  "endsAt": "2025-01-01T00:00:00.000Z"
}
```

**Expected:** `400 Bad Request` — `endsAt must be after startsAt`.

### C3. Restaurant-scoped promo without restaurantId → 400

```http
POST /api/promotions/admin
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "No Restaurant",
  "type": "percentage",
  "scope": "restaurant",
  "trigger": "auto_apply",
  "discountValue": 10,
  "startsAt": "2025-01-01T00:00:00.000Z",
  "endsAt": "2030-12-31T23:59:59.000Z"
}
```

**Expected:** `400 Bad Request` — `restaurantId` is required for restaurant scope.

### C4. Non-admin → 403

```http
GET /api/promotions/admin
Authorization: Bearer <customer_token>
```

**Expected:** `403 Forbidden`.

### C5. No auth → 401

```http
GET /api/promotions/admin
```

**Expected:** `401 Unauthorized`.

---

## Part D — Restaurant Controller

> All requests require `Authorization: Bearer <owner_token>` and `?restaurantId=<uuid>`.

### D1. Create restaurant-scoped promo

```http
POST /api/promotions/restaurant?restaurantId=fe8b2648-2260-4bc5-9acd-d88972148c78
Authorization: Bearer <owner_token>
Content-Type: application/json

{
  "name": "Phở Bắc Lunch Special",
  "type": "percentage",
  "scope": "restaurant",
  "trigger": "auto_apply",
  "discountValue": 8,
  "restaurantId": "fe8b2648-2260-4bc5-9acd-d88972148c78",
  "minOrderAmount": 60000,
  "startsAt": "2025-01-01T00:00:00.000Z",
  "endsAt": "2030-12-31T23:59:59.000Z"
}
```

**Expected:** `201 Created`.

### D2. Non-owner cannot access another restaurant's promo → 403

Get the promo ID from D1 (`$RESTAURANT_PROMO_ID`), then call with a different restaurant's owner token:

```http
GET /api/promotions/restaurant/$RESTAURANT_PROMO_ID?restaurantId=fe8b2648-2260-4bc5-9acd-d88972148c78
Authorization: Bearer <owner2_token>
```

**Expected:** `403 Forbidden`.

### D3. Restaurant owner cannot create platform-scope promo → 403

```http
POST /api/promotions/restaurant?restaurantId=fe8b2648-2260-4bc5-9acd-d88972148c78
Authorization: Bearer <owner_token>
Content-Type: application/json

{
  "name": "Sneaky Platform",
  "type": "percentage",
  "scope": "platform",
  "trigger": "auto_apply",
  "discountValue": 50,
  "startsAt": "2025-01-01T00:00:00.000Z",
  "endsAt": "2030-12-31T23:59:59.000Z"
}
```

**Expected:** `403 Forbidden`.

### D4. Restaurant owner cannot access admin endpoints → 403

```http
GET /api/promotions/admin
Authorization: Bearer <owner_token>
```

**Expected:** `403 Forbidden`.

---

## Part E — Public Endpoints

### E1. List active promotions (anonymous)

```http
GET /api/promotions/active
```

**Expected:** `200 OK` with array of active promos (P1, P2, P3, P4 from seed).

Filter by restaurant:

```http
GET /api/promotions/active?restaurantId=fe8b2648-2260-4bc5-9acd-d88972148c78
```

**Expected:** P1 (platform) + P2 (R1-specific) appear; P3 (R4) does not.

### E2. Preview discount (POST `/promotions/preview`)

> Requires authentication.

```http
POST /api/promotions/preview
Authorization: Bearer <customer_token>
Content-Type: application/json

{
  "restaurantId": "fe8b2648-2260-4bc5-9acd-d88972148c78",
  "itemsSubtotal": 100000,
  "shippingFee": 20000
}
```

**Expected:** `200 OK`:

```json
{
  "applicable": true,
  "promotionId": "...",
  "couponCodeId": null,
  "discountAmount": 10000,
  "finalItemsSubtotal": 90000,
  "finalShippingFee": 20000
}
```

> P2 (flat 20,000 off, min 80,000) applies but P1 (10% = 10,000 off) is also active.
> The engine picks the best — 20,000 > 10,000 so P2 wins.
> `discountAmount` should be **20,000**.

### E3. Validate coupon code (POST `/promotions/coupons/validate`)

```http
POST /api/promotions/coupons/validate
Authorization: Bearer <customer_token>
Content-Type: application/json

{
  "restaurantId": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  "code": "comtam15",
  "itemsSubtotal": 80000,
  "shippingFee": 15000
}
```

> Note: lowercase code — server should normalise to `COMTAM15`.

**Expected:** `200 OK` with `applicable: true` and `discountAmount: 12000`
(15% of 80,000 = 12,000; cap of 30,000 not hit).

### E4. Unknown coupon → applicable: false

```http
POST /api/promotions/coupons/validate
Authorization: Bearer <customer_token>
Content-Type: application/json

{
  "restaurantId": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  "code": "DOESNOTEXIST",
  "itemsSubtotal": 80000,
  "shippingFee": 15000
}
```

**Expected:** `200 OK` with `applicable: false`.

### E5. Preview without auth → 401

```http
POST /api/promotions/preview
Content-Type: application/json

{
  "restaurantId": "fe8b2648-2260-4bc5-9acd-d88972148c78",
  "itemsSubtotal": 100000,
  "shippingFee": 20000
}
```

**Expected:** `401 Unauthorized`.

---

## Part F — Pricing Engine Invariants

### F1. VND floor — 15% of 150,000

Create a 15% promo and activate it, then call preview with `itemsSubtotal: 150000`.

15% × 150,000 = 22,500 → floored to **22,000** VND.

**Expected:** `discountAmount` = `22000` (multiple of 1,000).

### F2. maxDiscountAmount cap

P1 has `maxDiscountAmount: 50000`. For a 1,000,000 VND order:

10% × 1,000,000 = 100,000 → capped to **50,000**.

**Expected:** `discountAmount` ≤ 50000.

### F3. minOrderAmount not met → applicable: false

P2 requires `minOrderAmount: 80000`. For a 50,000 VND order:

**Expected:** `applicable: false` (P2 excluded; P1 still applies if subtotal ≥ 0).

---

## Part G — Automated Tests (Reference)

The full automated E2E suite is at:

```
apps/api/test/e2e/promotion-pr1-pr2.e2e-spec.ts
```

Run it with:

```bash
cd apps/api
$env:NODE_OPTIONS="--experimental-vm-modules"
npx jest "promotion-pr1-pr2" --config test/jest-e2e.json --forceExit --verbose
```

**Expected:** `42 passed, 0 failed`.

---

## Checklist Summary

| # | Scenario | HTTP Method | Path | Expected Status |
|---|---|---|---|---|
| B1 | Create promotion | POST | `/promotions/admin` | 201 |
| B2 | Get by ID | GET | `/promotions/admin/:id` | 200 |
| B3 | List with filter | GET | `/promotions/admin?status=draft` | 200 |
| B4 | Update | PATCH | `/promotions/admin/:id` | 200 |
| B5 | Activate | PATCH | `/promotions/admin/:id/activate` | 200 |
| B6 | Pause | PATCH | `/promotions/admin/:id/pause` | 200 |
| B8 | Cancel | DELETE | `/promotions/admin/:id` | 204 |
| B9 | Create coupons | POST | `/promotions/admin/:id/coupons` | 201 |
| B10 | Duplicate coupon | POST | `/promotions/admin/:id/coupons` | 409 |
| B11 | Coupon on auto_apply | POST | `/promotions/admin/:id/coupons` | 400 |
| B12 | List coupons | GET | `/promotions/admin/:id/coupons` | 200 |
| C1 | discountValue > 100 | POST | `/promotions/admin` | 400 |
| C2 | endsAt < startsAt | POST | `/promotions/admin` | 400 |
| C3 | Missing restaurantId | POST | `/promotions/admin` | 400 |
| C4 | Non-admin to admin | GET | `/promotions/admin` | 403 |
| C5 | No auth to admin | GET | `/promotions/admin` | 401 |
| D1 | Restaurant create | POST | `/promotions/restaurant` | 201 |
| D2 | Owner isolation | GET | `/promotions/restaurant/:id` | 403 |
| D3 | Restaurant → platform | POST | `/promotions/restaurant` | 403 |
| D4 | Owner → admin | GET | `/promotions/admin` | 403 |
| E1 | List active (anon) | GET | `/promotions/active` | 200 |
| E2 | Preview discount | POST | `/promotions/preview` | 200 |
| E3 | Validate coupon | POST | `/promotions/coupons/validate` | 200 |
| E4 | Unknown coupon | POST | `/promotions/coupons/validate` | 200 (applicable=false) |
| E5 | Preview no auth | POST | `/promotions/preview` | 401 |
| F1 | VND floor | POST | `/promotions/preview` | 200 (discountAmount % 1000 = 0) |
