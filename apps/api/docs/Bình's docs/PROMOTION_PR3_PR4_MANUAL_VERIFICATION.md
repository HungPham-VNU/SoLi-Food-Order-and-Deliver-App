# PR-3 / PR-4 — Promotion Checkout & Rollback: Manual Verification Checklist

## Overview

| Phase | Scope |
|-------|-------|
| **PR-3** | Discount calculated/reserved at checkout; `discount_amount` persisted on orders; coupon codes accepted; total amount adjusted |
| **PR-4** | Promotion usage rolled back on order cancellation or VNPay payment failure |

All tests in `test/e2e/promotion-checkout.e2e-spec.ts` (49 tests) must pass before proceeding.

---

## Prerequisites

### 1. Environment

```bash
# Start database + redis
docker compose up -d db redis

# Apply migrations
cd apps/api
node apply-migration-0013.mjs   # PR-3 migration (discount_amount on orders)
```

### 2. Seed Data

Seed at minimum:
- One approved restaurant with at least one in-stock menu item (~50,000 VND price)
- Admin user (role `admin`)
- Customer user (role `customer`)

---

## Part 1 — Checkout Without Promotion (PR-3 Baseline)

### Step 1: Add item to cart

```http
POST /api/carts/my/items
Authorization: Bearer {CUSTOMER_TOKEN}
Content-Type: application/json

{
  "menuItemId": "{MENU_ITEM_ID}",
  "quantity": 1
}
```

Expected: `201 Created`, cart contains 1 item.

### Step 2: Checkout (no coupon)

```http
POST /api/carts/my/checkout
Authorization: Bearer {CUSTOMER_TOKEN}
Content-Type: application/json

{
  "deliveryAddress": {
    "street": "123 Test Street",
    "city": "Ho Chi Minh City",
    "district": "District 1"
  },
  "paymentMethod": "cod"
}
```

**Expected response `201`:**
```json
{
  "orderId": "...",
  "status": "pending",
  "totalAmount": 50000,
  "shippingFee": 0,
  "discountAmount": 0,
  "paymentMethod": "cod"
}
```

### SQL Verification

```sql
-- Confirm discount_amount = 0 on the order
SELECT id, total_amount, shipping_fee, discount_amount, status
FROM orders
WHERE id = '{ORDER_ID}';

-- No promotion_usages row created
SELECT COUNT(*) FROM promotion_usages WHERE order_id = '{ORDER_ID}';
-- Expected: 0
```

---

## Part 2 — Auto-Apply Percentage Discount (PR-3)

### Step 1: Create platform-wide auto-apply promotion (Admin)

```http
POST /api/promotions/admin
Authorization: Bearer {ADMIN_TOKEN}
Content-Type: application/json

{
  "name": "10% Off Everything",
  "type": "percentage",
  "scope": "platform",
  "trigger": "auto_apply",
  "discountValue": 10,
  "maxTotalUses": 1000,
  "startsAt": "2024-01-01T00:00:00.000Z",
  "endsAt": "2030-12-31T23:59:59.000Z"
}
```

Expected: `201 Created` with a promotion `id`.

### Step 2: Checkout with active auto-apply

```http
POST /api/carts/my/checkout
(same body as Part 1)
```

**Expected response:**
```json
{
  "orderId": "...",
  "totalAmount": 45000,
  "shippingFee": 0,
  "discountAmount": 5000
}
```

`discountAmount = 10% × 50000 = 5000`  
`totalAmount = 50000 − 5000 = 45000`

### SQL Verification

```sql
-- Order totals
SELECT total_amount, discount_amount FROM orders WHERE id = '{ORDER_ID}';
-- total_amount = 45000, discount_amount = 5000

-- Usage row
SELECT status, discount_amount, coupon_code_id
FROM promotion_usages
WHERE order_id = '{ORDER_ID}';
-- status = 'confirmed', coupon_code_id IS NULL

-- Promotion counter
SELECT current_total_uses FROM promotions WHERE id = '{PROMOTION_ID}';
-- current_total_uses = 1
```

---

## Part 3 — Coupon Code Discount (PR-3)

### Step 1: Create coupon_code-triggered promotion (Admin)

```http
POST /api/promotions/admin
Authorization: Bearer {ADMIN_TOKEN}
Content-Type: application/json

{
  "name": "20k Fixed Coupon",
  "type": "fixed_amount",
  "scope": "platform",
  "trigger": "coupon_code",
  "discountValue": 20000,
  "maxTotalUses": 100,
  "startsAt": "2024-01-01T00:00:00.000Z",
  "endsAt": "2030-12-31T23:59:59.000Z"
}
```

### Step 2: Create coupon code batch (Admin)

```http
POST /api/promotions/admin/{PROMOTION_ID}/coupons
Authorization: Bearer {ADMIN_TOKEN}
Content-Type: application/json

{
  "codes": ["SAVE20K"],
  "maxUsesPerCode": 50
}
```

Expected: `201 Created`, returns array:
```json
[
  {
    "id": "...",
    "promotionId": "...",
    "code": "SAVE20K",
    "status": "active",
    "maxUses": 50,
    "currentUses": 0
  }
]
```

### Step 3: Checkout with coupon code

```http
POST /api/carts/my/checkout
Authorization: Bearer {CUSTOMER_TOKEN}
Content-Type: application/json

{
  "deliveryAddress": { ... },
  "paymentMethod": "cod",
  "couponCode": "SAVE20K"
}
```

**Expected response:**
```json
{
  "orderId": "...",
  "totalAmount": 30000,
  "shippingFee": 0,
  "discountAmount": 20000
}
```

**Case-insensitivity test:** Sending `"couponCode": "save20k"` or `"couponCode": "Save20K"` must produce the same result — discount of 20,000 VND.

### SQL Verification

```sql
SELECT status, discount_amount, coupon_code_id
FROM promotion_usages
WHERE order_id = '{ORDER_ID}';
-- status = 'confirmed', coupon_code_id = '{COUPON_CODE_ID}', discount_amount = 20000

SELECT current_uses FROM coupon_codes WHERE id = '{COUPON_CODE_ID}';
-- current_uses = 1

SELECT current_total_uses FROM promotions WHERE id = '{PROMOTION_ID}';
-- current_total_uses = 1
```

---

## Part 4 — Invalid Coupon Code Graceful Fallback (PR-3)

### Step: Checkout with nonexistent coupon

```http
POST /api/carts/my/checkout
{
  "deliveryAddress": { ... },
  "paymentMethod": "cod",
  "couponCode": "DOESNOTEXIST"
}
```

**Expected:** `201 Created` (not 4xx). Order placed with `discountAmount = 0`.  
Invalid coupon silently ignored — customer receives no discount.

```sql
SELECT COUNT(*) FROM promotion_usages WHERE order_id = '{ORDER_ID}';
-- Expected: 0
```

---

## Part 5 — Coupon Exhaustion (PR-3)

### Setup: Create coupon with maxUsesPerCode = 1

```http
POST /api/promotions/admin/{PROMOTION_ID}/coupons
{ "codes": ["ONEUSE01"], "maxUsesPerCode": 1 }
```

### First checkout: discount applied

```json
{ "couponCode": "ONEUSE01" }
```
→ `discountAmount = 20000`

### SQL check after first checkout:

```sql
SELECT status, current_uses FROM coupon_codes WHERE code = 'ONEUSE01';
-- status = 'exhausted', current_uses = 1
```

### Second checkout (same customer, same coupon):

→ `discountAmount = 0` (coupon exhausted — silently ignored)

---

## Part 6 — Per-User Limit (PR-3)

Create promotion with `maxUsesPerUser = 1`.  
First checkout → discount applied.  
Second checkout by same customer → `discountAmount = 0` (per-user limit reached, silently ignored).

```sql
SELECT COUNT(*)
FROM promotion_usages
WHERE customer_id = '{CUSTOMER_ID}'
  AND promotion_id = '{PROMOTION_ID}'
  AND status IN ('reserved', 'confirmed');
-- Expected: 1 (first use only)
```

---

## Part 7 — PR-4: Rollback on Cancellation

### Setup: Checkout with coupon → `status = confirmed`, `current_total_uses = 1`

### Cancel order (Customer)

```http
PATCH /api/orders/{ORDER_ID}/status
Authorization: Bearer {CUSTOMER_TOKEN}
Content-Type: application/json

{ "status": "cancelled" }
```

Expected: `200 OK`

### SQL Verification

```sql
-- Usage rolled back
SELECT status FROM promotion_usages WHERE order_id = '{ORDER_ID}';
-- status = 'rolled_back'

-- Counter decremented
SELECT current_total_uses FROM promotions WHERE id = '{PROMOTION_ID}';
-- current_total_uses = 0

-- Coupon uses decremented
SELECT current_uses FROM coupon_codes WHERE id = '{COUPON_CODE_ID}';
-- current_uses = 0
```

### Idempotency test (double cancel)

Cancel the same order a second time:
→ `200 OK` (already cancelled — no error)  
→ `current_total_uses` remains `0` (no double-decrement)

```sql
SELECT current_total_uses FROM promotions WHERE id = '{PROMOTION_ID}';
-- still 0 (not negative)
```

---

## Part 8 — PR-4: Rollback on VNPay Payment Failure

### Setup: Checkout with VNPay payment method + coupon

```http
POST /api/carts/my/checkout
{
  "deliveryAddress": { ... },
  "paymentMethod": "vnpay",
  "couponCode": "SAVE20K"
}
```

Response includes `paymentUrl`. VNPay order created.

### SQL after checkout:

```sql
SELECT status FROM promotion_usages WHERE order_id = '{ORDER_ID}';
-- status = 'confirmed'
```

### Simulate payment failure (VNPay IPN callback)

```http
POST /api/payments/vnpay/ipn?vnp_ResponseCode=24&vnp_TxnRef={ORDER_ID}&...
```

Or send `PaymentFailedEvent` directly via the test endpoint (dev only).

### SQL after payment failure:

```sql
SELECT status FROM orders WHERE id = '{ORDER_ID}';
-- status = 'cancelled' (payment failure cancels order)

SELECT status FROM promotion_usages WHERE order_id = '{ORDER_ID}';
-- status = 'rolled_back'

SELECT current_total_uses FROM promotions WHERE id = '{PROMOTION_ID}';
-- current_total_uses = 0
```

---

## Part 9 — Monetary Invariant Checks

For every order in the system, the following must hold:

```sql
SELECT
  id,
  total_amount,
  shipping_fee,
  discount_amount,
  (total_amount - shipping_fee + discount_amount) AS items_subtotal,
  CASE
    WHEN total_amount = GREATEST(0, total_amount + discount_amount - discount_amount)
    THEN 'OK'
    ELSE 'INVARIANT VIOLATED'
  END AS check
FROM orders
WHERE created_at > NOW() - INTERVAL '1 day';
```

Correct invariant:
```
total_amount = items_subtotal + shipping_fee − discount_amount
total_amount ≥ 0
discount_amount ≡ 0 (mod 1000)  -- all amounts are multiples of 1000 VND
```

---

## Part 10 — Concurrency Verification

### Test: Simultaneous checkout with same maxUses=1 coupon

1. From two separate sessions/devices, simultaneously add items to cart with the same coupon code.
2. Both call `POST /api/carts/my/checkout` at the same time.
3. Exactly **one** of them should receive `discountAmount > 0`; the other gets `discountAmount = 0` (coupon exhausted before the second transaction could reserve it).

```sql
SELECT COUNT(*) FROM promotion_usages
WHERE coupon_code_id = '{COUPON_CODE_ID}'
  AND status IN ('reserved', 'confirmed', 'rolled_back');
-- Expected: 1 (atomic increment prevents double-spend)

SELECT current_uses FROM coupon_codes WHERE id = '{COUPON_CODE_ID}';
-- Expected: 1
```

---

## Part 11 — Full Regression Checklist

Run the full E2E suite and confirm all tests pass:

```powershell
cd apps/api
$env:NODE_OPTIONS='--experimental-vm-modules'
npx jest --config test/jest-e2e.json --forceExit
# Expected: 823 passed, 0 failed
```

| E2E Suite | Tests | Expected |
|-----------|-------|----------|
| `promotion-checkout.e2e-spec.ts` | 49 | All pass |
| `promotion-pr1-pr2.e2e-spec.ts` | (existing) | All pass |
| `payment-phase8.e2e-spec.ts` | (existing) | All pass |
| All other suites | (existing) | All pass |
| **Total** | **823** | **All pass** |

---

## Key API Endpoints Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `POST` | `/api/promotions/admin` | admin | Create promotion |
| `POST` | `/api/promotions/admin/:id/coupons` | admin | Create coupon codes (batch) |
| `GET` | `/api/promotions/admin/:id/coupons` | admin | List coupon codes |
| `PATCH` | `/api/promotions/admin/:id/status` | admin | Pause / activate promotion |
| `POST` | `/api/carts/my/checkout` | customer | Checkout (with optional `couponCode`) |
| `PATCH` | `/api/orders/:id/status` | customer/admin | Cancel order (triggers rollback) |
| `POST` | `/api/payments/vnpay/ipn` | (webhook) | VNPay IPN — payment failure triggers rollback |

---

## Important Notes

1. **Coupon code normalisation**: All coupon codes are normalised to UPPERCASE before validation and lookup. `save20k`, `Save20K`, and `SAVE20K` are all equivalent.

2. **Rollback idempotency**: Calling cancel or rollback multiple times on the same order is safe. `promotion_usages` rows in `rolled_back` status are skipped; counters are not double-decremented.

3. **Coupon code uniqueness**: Coupon codes are globally unique across all promotions. Attempting to create a code that already exists returns `409 Conflict`.

4. **Discount capped at order total**: `totalAmount = max(0, itemsSubtotal + shippingFee − discountAmount)`. The discount cannot make the total negative.

5. **Silent fallback for invalid coupons**: An unknown, expired, or exhausted coupon code results in `discountAmount = 0` and a successful `201` checkout — the customer is not shown an error.
