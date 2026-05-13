/**
 * promotion-checkout.e2e-spec.ts — Phase PR-3 + PR-4 E2E Tests
 *
 * Covers the checkout-with-promotion integration end-to-end:
 *
 *   §1  Baseline — checkout with no active promotion (discountAmount=0)
 *   §2  Auto-apply percentage discount applied at checkout
 *   §3  Coupon code discount — DB state (usage row + counter) verified
 *   §4  Invalid coupon code — graceful fallback (order placed without discount)
 *   §5  Coupon exhaustion — maxUses=1 on coupon prevents second redemption
 *   §6  Per-user limit — maxUsesPerUser=1 prevents same customer second use
 *   §7  PR-4: Rollback on customer cancellation (usage rolled_back, counter=0)
 *   §8  PR-4: Rollback on payment failure (PaymentFailedEvent → cancel → rollback)
 *   §9  PR-4: Rollback idempotency (double cancel → counter not double-decremented)
 *   §10 Monetary invariant (totalAmount = itemsTotal + shippingFee − discountAmount)
 *   §11 Case-insensitive coupon input (lowercase accepted via @Transform)
 *
 * Users:
 *   PC_ADMIN    — 'admin' role, manages promotions via admin API
 *   PC_CUSTOMER — default 'user' role → resolveRole() → 'customer'; places orders
 *   testAuth    — TestAuthManager owner; 'restaurant' role; owns TEST_RESTAURANT_ID
 *
 * Follows the E2E Testing Playbook: real NestJS app, real DB, real Redis, no mocks.
 * State is verified via DB helpers (promotion_usages, promotions, orders tables).
 * Each section manages its own promotion lifecycle: create → activate → pause/cancel in afterAll.
 */

import type { INestApplication } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';

import { createTestApp, teardownTestApp } from '../setup/app-factory';
import {
  resetDb,
  seedBaseRestaurant,
  getTestDb,
  TEST_RESTAURANT_ID,
} from '../setup/db-setup';
import { TestAuthManager, TEST_PASSWORD } from '../helpers/test-auth';
import { setAuthManager, ownerHeaders } from '../helpers/auth';
import {
  getOrder,
  getPromotionUsagesByOrderId,
  getPromotion,
  getCouponCode,
} from '../helpers/db';
import { user as userTable } from '../../src/module/auth/auth.schema';
import { PaymentFailedEvent } from '../../src/shared/events/payment-failed.event';

// ─── Test-suite-specific email constants ──────────────────────────────────────
// Use distinct emails from the base TestAuthManager pair to avoid collisions
// when suites run together. resetDb() only cleans TEST_OWNER_EMAIL / TEST_OTHER_EMAIL;
// we delete PC emails manually in beforeAll / afterAll.

const PC_ADMIN_EMAIL = 'pc-admin@test.soli';
const PC_CUSTOMER_EMAIL = 'pc-customer@test.soli';
const PC_ALL_EMAILS = [PC_ADMIN_EMAIL, PC_CUSTOMER_EMAIL] as const;

// ─── Timing helper ────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Monetary constants ───────────────────────────────────────────────────────
/** Menu item price used across all checkout tests (integer VND). */
const ITEM_PRICE = 50000;

/** Active date range that makes promotions eligible. */
const ACTIVE_START = new Date(Date.now() - 86_400_000).toISOString(); // yesterday
const ACTIVE_END = new Date(Date.now() + 86_400_000).toISOString(); // tomorrow

// ─── Delivery address with NO coordinates ─────────────────────────────────────
// No lat/lng → resolveDeliveryPricing returns null → shippingFee = 0.
// This simplifies monetary assertions: totalAmount = itemsTotal - discountAmount.
const DELIVERY_ADDRESS = {
  street: '99 Promo Street',
  district: 'District 1',
  city: 'Ho Chi Minh City',
};

// ─── Sign-up helper ───────────────────────────────────────────────────────────

async function signUpUser(
  http: ReturnType<typeof request>,
  email: string,
  name: string,
): Promise<{ token: string; userId: string }> {
  const res = await http
    .post('/api/auth/sign-up/email')
    .set('Content-Type', 'application/json')
    .send({ email, password: TEST_PASSWORD, name });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `signUpUser failed for "${email}" — HTTP ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }
  return {
    token: res.body.token as string,
    userId: res.body.user.id as string,
  };
}

// ─── Main describe block ──────────────────────────────────────────────────────

describe('Promotion Checkout E2E (Phase PR-3 + PR-4)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let testAuth: TestAuthManager;

  // Extra actors for this suite
  let adminToken: string;
  let customerToken: string;
  let customerId: string;

  // Menu item whose ACL snapshot is used at checkout
  let snapshotItemId: string;

  // ─── Header factories ────────────────────────────────────────────────────

  function adminHeaders() {
    return { Authorization: `Bearer ${adminToken}` };
  }
  function customerHeaders() {
    return { Authorization: `Bearer ${customerToken}` };
  }

  // ─── Cart & checkout helpers ─────────────────────────────────────────────

  async function clearCart(token: string): Promise<void> {
    await http
      .delete('/api/carts/my')
      .set({ Authorization: `Bearer ${token}` });
  }

  async function addItemToCart(token: string): Promise<void> {
    const res = await http
      .post('/api/carts/my/items')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        menuItemId: snapshotItemId,
        restaurantId: TEST_RESTAURANT_ID,
        restaurantName: 'E2E Test Restaurant',
        itemName: 'Promo Test Item',
        unitPrice: ITEM_PRICE,
        quantity: 1,
      });
    expect(res.status).toBe(201);
  }

  /**
   * Clear cart, add one item, then checkout.
   * Returns the key fields from the checkout response.
   */
  async function doCheckout(
    token: string,
    opts: {
      couponCode?: string;
      paymentMethod?: 'cod' | 'vnpay';
    } = {},
  ): Promise<{
    orderId: string;
    totalAmount: number;
    shippingFee: number;
    discountAmount: number;
  }> {
    await clearCart(token);
    await addItemToCart(token);

    const body: Record<string, unknown> = {
      deliveryAddress: DELIVERY_ADDRESS,
      paymentMethod: opts.paymentMethod ?? 'cod',
    };
    if (opts.couponCode !== undefined) {
      body.couponCode = opts.couponCode;
    }

    const res = await http
      .post('/api/carts/my/checkout')
      .set({ Authorization: `Bearer ${token}` })
      .send(body);

    expect(res.status).toBe(201);
    return {
      orderId: res.body.orderId as string,
      totalAmount: res.body.totalAmount as number,
      shippingFee: res.body.shippingFee as number,
      discountAmount: res.body.discountAmount as number,
    };
  }

  // ─── Global setup ─────────────────────────────────────────────────────────

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());

    // 1. Reset all E2E data
    await resetDb();

    // 2. Remove any leftover PC users from a prior run
    const db = getTestDb();
    await db.delete(userTable).where(inArray(userTable.email, PC_ALL_EMAILS));

    // 3. Bootstrap standard 2-user auth manager (owner = restaurant role)
    testAuth = new TestAuthManager();
    await testAuth.initialize(http);
    setAuthManager(testAuth);

    // 4. Create extra actors
    const adminResult = await signUpUser(http, PC_ADMIN_EMAIL, 'PC Admin');
    adminToken = adminResult.token;
    await db
      .update(userTable)
      .set({ role: 'admin' })
      .where(eq(userTable.email, PC_ADMIN_EMAIL));

    const customerResult = await signUpUser(
      http,
      PC_CUSTOMER_EMAIL,
      'PC Customer',
    );
    customerToken = customerResult.token;
    customerId = customerResult.userId;
    // Customer gets NO explicit role update → resolveRole() returns 'customer'

    // 5. Seed restaurant row + trigger snapshot projection
    await seedBaseRestaurant(testAuth.ownerUserId);
    const patchRes = await http
      .patch(`/api/restaurants/${TEST_RESTAURANT_ID}`)
      .set(ownerHeaders())
      .send({ name: 'E2E Test Restaurant' });
    expect(patchRes.status).toBe(200);
    await delay(200);

    // 6. Create menu item (price=50000) and wait for ACL snapshot
    const itemRes = await http
      .post('/api/menu-items')
      .set(ownerHeaders())
      .send({
        restaurantId: TEST_RESTAURANT_ID,
        name: 'Promo Test Item',
        price: ITEM_PRICE,
      });
    expect(itemRes.status).toBe(201);
    snapshotItemId = itemRes.body.id as string;
    await delay(200);

    // 7. Clear carts to start clean
    await clearCart(testAuth.ownerToken);
    await clearCart(customerToken);
  });

  afterAll(async () => {
    const db = getTestDb();
    await db.delete(userTable).where(inArray(userTable.email, PC_ALL_EMAILS));
    await teardownTestApp(app);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §1 Baseline — checkout with no active promotion
  // ──────────────────────────────────────────────────────────────────────────

  describe('§1 Baseline — no active promotion', () => {
    let result: Awaited<ReturnType<typeof doCheckout>>;

    beforeAll(async () => {
      result = await doCheckout(customerToken);
    });

    it('PC-01 checkout returns HTTP 201', async () => {
      // Verified implicitly by doCheckout (expects 201)
      expect(result.orderId).toBeTruthy();
    });

    it('PC-02 discountAmount is 0 when no promotion is active', () => {
      expect(result.discountAmount).toBe(0);
    });

    it('PC-03 totalAmount equals itemsTotal when no discount', () => {
      expect(result.totalAmount).toBe(ITEM_PRICE);
    });

    it('PC-04 shippingFee is 0 (no delivery coordinates)', () => {
      expect(result.shippingFee).toBe(0);
    });

    it('PC-05 no promotion_usages row created for unpromotted order', async () => {
      const usages = await getPromotionUsagesByOrderId(result.orderId);
      expect(usages).toHaveLength(0);
    });

    it('PC-06 DB orders.discount_amount = 0', async () => {
      const order = await getOrder(result.orderId);
      expect(order).not.toBeNull();
      expect(order!.discountAmount).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §2 Auto-apply 10% platform promotion
  // ──────────────────────────────────────────────────────────────────────────

  describe('§2 Auto-apply 10% percentage promotion', () => {
    let promoId: string;
    let result: Awaited<ReturnType<typeof doCheckout>>;
    // 10% of 50000 = 5000 → floorToThousand(5000) = 5000
    const EXPECTED_DISCOUNT = 5000;

    beforeAll(async () => {
      // Create platform auto-apply 10% promotion (no min order amount)
      const createRes = await http
        .post('/api/promotions/admin')
        .set(adminHeaders())
        .send({
          name: 'PC Auto-Apply 10% Test',
          type: 'percentage',
          scope: 'platform',
          trigger: 'auto_apply',
          discountValue: 10,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
          maxTotalUses: 1000,
        });
      expect(createRes.status).toBe(201);
      promoId = createRes.body.id as string;

      // Activate the promotion
      const activateRes = await http
        .patch(`/api/promotions/admin/${promoId}/activate`)
        .set(adminHeaders());
      expect(activateRes.status).toBe(200);

      // Checkout
      result = await doCheckout(customerToken);
    });

    afterAll(async () => {
      // Pause so it does not bleed into subsequent sections
      await http
        .patch(`/api/promotions/admin/${promoId}/pause`)
        .set(adminHeaders());
    });

    it('PC-10 discountAmount = 5000 (10% of 50000)', () => {
      expect(result.discountAmount).toBe(EXPECTED_DISCOUNT);
    });

    it('PC-11 totalAmount = itemsTotal − discountAmount', () => {
      expect(result.totalAmount).toBe(ITEM_PRICE - EXPECTED_DISCOUNT);
    });

    it('PC-12 DB orders.discount_amount persisted correctly', async () => {
      const order = await getOrder(result.orderId);
      expect(order!.discountAmount).toBe(EXPECTED_DISCOUNT);
    });

    it('PC-13 DB orders.total_amount equals response totalAmount', async () => {
      const order = await getOrder(result.orderId);
      expect(order!.totalAmount).toBe(result.totalAmount);
    });

    it('PC-14 promotion_usages row created with status=confirmed', async () => {
      const usages = await getPromotionUsagesByOrderId(result.orderId);
      expect(usages).toHaveLength(1);
      expect(usages[0].status).toBe('confirmed');
    });

    it('PC-15 promotion_usages.discount_amount matches checkout discountAmount', async () => {
      const usages = await getPromotionUsagesByOrderId(result.orderId);
      expect(usages[0].discountAmount).toBe(EXPECTED_DISCOUNT);
    });

    it('PC-16 promotion_usages.coupon_code_id is null (auto_apply — no coupon)', async () => {
      const usages = await getPromotionUsagesByOrderId(result.orderId);
      expect(usages[0].couponCodeId).toBeNull();
    });

    it('PC-17 promotions.current_total_uses incremented to 1', async () => {
      const promo = await getPromotion(promoId);
      expect(promo!.currentTotalUses).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §3 Coupon code — 20k fixed_amount restaurant promotion
  // ──────────────────────────────────────────────────────────────────────────

  describe('§3 Coupon code 20k fixed_amount discount', () => {
    let promoId: string;
    let couponId: string;
    const COUPON_CODE = 'PROMO20K';
    const EXPECTED_DISCOUNT = 20000;
    let result: Awaited<ReturnType<typeof doCheckout>>;

    beforeAll(async () => {
      // Create restaurant-scoped coupon_code promotion
      const createRes = await http
        .post('/api/promotions/admin')
        .set(adminHeaders())
        .send({
          name: 'PC Coupon 20k Test',
          type: 'fixed_amount',
          scope: 'restaurant',
          trigger: 'coupon_code',
          discountValue: 20000,
          restaurantId: TEST_RESTAURANT_ID,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
          maxTotalUses: 100,
        });
      expect(createRes.status).toBe(201);
      promoId = createRes.body.id as string;

      // Activate
      await http
        .patch(`/api/promotions/admin/${promoId}/activate`)
        .set(adminHeaders());

      // Create coupon code (endpoint accepts codes array + maxUsesPerCode)
      const couponRes = await http
        .post(`/api/promotions/admin/${promoId}/coupons`)
        .set(adminHeaders())
        .send({ codes: [COUPON_CODE], maxUsesPerCode: 50 });
      expect(couponRes.status).toBe(201);
      couponId = (couponRes.body as Array<{ id: string }>)[0].id;

      // Checkout with coupon
      result = await doCheckout(customerToken, { couponCode: COUPON_CODE });
    });

    afterAll(async () => {
      await http
        .patch(`/api/promotions/admin/${promoId}/pause`)
        .set(adminHeaders());
    });

    it('PC-20 discountAmount = 20000 (fixed_amount coupon)', () => {
      expect(result.discountAmount).toBe(EXPECTED_DISCOUNT);
    });

    it('PC-21 totalAmount = itemsTotal − discountAmount', () => {
      expect(result.totalAmount).toBe(ITEM_PRICE - EXPECTED_DISCOUNT);
    });

    it('PC-22 promotion_usages row created with status=confirmed', async () => {
      const usages = await getPromotionUsagesByOrderId(result.orderId);
      expect(usages).toHaveLength(1);
      expect(usages[0].status).toBe('confirmed');
    });

    it('PC-23 promotion_usages.coupon_code_id is set for coupon_code promotions', async () => {
      const usages = await getPromotionUsagesByOrderId(result.orderId);
      expect(usages[0].couponCodeId).toBe(couponId);
    });

    it('PC-24 coupon_codes.current_uses incremented to 1 after checkout', async () => {
      const coupon = await getCouponCode(couponId);
      expect(coupon!.currentUses).toBe(1);
    });

    it('PC-25 promotions.current_total_uses incremented to 1 after checkout', async () => {
      const promo = await getPromotion(promoId);
      expect(promo!.currentTotalUses).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §4 Invalid coupon code — graceful fallback (order placed without discount)
  // ──────────────────────────────────────────────────────────────────────────

  describe('§4 Invalid coupon code — graceful fallback', () => {
    let result: Awaited<ReturnType<typeof doCheckout>>;

    beforeAll(async () => {
      // Checkout with a coupon code that does not exist in the DB
      result = await doCheckout(customerToken, { couponCode: 'NOSUCHCODE99' });
    });

    it('PC-30 checkout returns HTTP 201 (not 4xx) for unknown coupon', () => {
      // Verified by doCheckout (expects 201)
      expect(result.orderId).toBeTruthy();
    });

    it('PC-31 discountAmount = 0 when coupon is invalid', () => {
      expect(result.discountAmount).toBe(0);
    });

    it('PC-32 totalAmount = itemsTotal (no discount applied)', () => {
      expect(result.totalAmount).toBe(ITEM_PRICE);
    });

    it('PC-33 no promotion_usages row created for invalid coupon', async () => {
      const usages = await getPromotionUsagesByOrderId(result.orderId);
      expect(usages).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §5 Coupon exhaustion — maxUses=1 on coupon_code
  // ──────────────────────────────────────────────────────────────────────────

  describe('§5 Coupon exhaustion — maxUses=1', () => {
    let promoId: string;
    let couponId: string;
    const COUPON_CODE = 'ONEUSE01';
    let firstOrderResult: Awaited<ReturnType<typeof doCheckout>>;

    beforeAll(async () => {
      // Create coupon promo (unlimited total uses, coupon itself has maxUses=1)
      const createRes = await http
        .post('/api/promotions/admin')
        .set(adminHeaders())
        .send({
          name: 'PC Exhaustion Test Promo',
          type: 'fixed_amount',
          scope: 'restaurant',
          trigger: 'coupon_code',
          discountValue: 10000,
          restaurantId: TEST_RESTAURANT_ID,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
          maxTotalUses: 100,
        });
      expect(createRes.status).toBe(201);
      promoId = createRes.body.id as string;

      await http
        .patch(`/api/promotions/admin/${promoId}/activate`)
        .set(adminHeaders());

      const couponRes = await http
        .post(`/api/promotions/admin/${promoId}/coupons`)
        .set(adminHeaders())
        .send({ codes: [COUPON_CODE], maxUsesPerCode: 1 });
      expect(couponRes.status).toBe(201);
      couponId = (couponRes.body as Array<{ id: string }>)[0].id;

      // First checkout — should succeed with discount
      firstOrderResult = await doCheckout(customerToken, {
        couponCode: COUPON_CODE,
      });
    });

    afterAll(async () => {
      await http
        .patch(`/api/promotions/admin/${promoId}/pause`)
        .set(adminHeaders());
    });

    it('PC-40 first checkout with maxUses=1 coupon applies discount', () => {
      expect(firstOrderResult.discountAmount).toBe(10000);
    });

    it('PC-41 coupon status becomes exhausted after first redemption', async () => {
      const coupon = await getCouponCode(couponId);
      // currentUses=1 == maxUses=1 → service calls checkAndMarkExhausted
      expect(coupon!.currentUses).toBe(1);
      expect(coupon!.status).toBe('exhausted');
    });

    it('PC-42 second checkout with exhausted coupon returns discountAmount=0', async () => {
      // Second checkout by same customer — coupon is now exhausted
      const secondResult = await doCheckout(customerToken, {
        couponCode: COUPON_CODE,
      });
      // findActiveByCode returns null (status='exhausted') → falls to auto_apply
      // No active auto_apply promo → discountAmount=0
      expect(secondResult.discountAmount).toBe(0);
      expect(secondResult.totalAmount).toBe(ITEM_PRICE);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §6 Per-user limit — maxUsesPerUser=1
  // ──────────────────────────────────────────────────────────────────────────

  describe('§6 Per-user limit — maxUsesPerUser=1', () => {
    let promoId: string;
    let firstOrderResult: Awaited<ReturnType<typeof doCheckout>>;
    const EXPECTED_DISCOUNT = 5000; // 10% of 50000

    beforeAll(async () => {
      // Create auto-apply promo with maxUsesPerUser=1
      const createRes = await http
        .post('/api/promotions/admin')
        .set(adminHeaders())
        .send({
          name: 'PC Per-User Limit Test',
          type: 'percentage',
          scope: 'platform',
          trigger: 'auto_apply',
          discountValue: 10,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
          maxTotalUses: 1000,
          maxUsesPerUser: 1,
        });
      expect(createRes.status).toBe(201);
      promoId = createRes.body.id as string;

      await http
        .patch(`/api/promotions/admin/${promoId}/activate`)
        .set(adminHeaders());

      // First checkout — should apply discount
      firstOrderResult = await doCheckout(customerToken);
    });

    afterAll(async () => {
      await http
        .patch(`/api/promotions/admin/${promoId}/pause`)
        .set(adminHeaders());
    });

    it('PC-50 first checkout applies discount when per-user limit not reached', () => {
      expect(firstOrderResult.discountAmount).toBe(EXPECTED_DISCOUNT);
    });

    it('PC-51 second checkout by same customer gets discountAmount=0 (limit reached)', async () => {
      // countActiveUsagesByCustomer(promoId, customerId) = 1 → 1 >= maxUsesPerUser=1
      // → per-user quota exceeded → noDiscount
      const secondResult = await doCheckout(customerToken);
      expect(secondResult.discountAmount).toBe(0);
      expect(secondResult.totalAmount).toBe(ITEM_PRICE);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §7 PR-4 — Rollback on customer cancellation
  // ──────────────────────────────────────────────────────────────────────────

  describe('§7 PR-4 — Rollback on customer cancellation', () => {
    let promoId: string;
    let orderId: string;
    const EXPECTED_DISCOUNT = 5000;

    beforeAll(async () => {
      const createRes = await http
        .post('/api/promotions/admin')
        .set(adminHeaders())
        .send({
          name: 'PC Rollback Cancel Test',
          type: 'percentage',
          scope: 'platform',
          trigger: 'auto_apply',
          discountValue: 10,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
          maxTotalUses: 1000,
        });
      expect(createRes.status).toBe(201);
      promoId = createRes.body.id as string;

      await http
        .patch(`/api/promotions/admin/${promoId}/activate`)
        .set(adminHeaders());

      const result = await doCheckout(customerToken);
      orderId = result.orderId;
    });

    afterAll(async () => {
      await http
        .patch(`/api/promotions/admin/${promoId}/pause`)
        .set(adminHeaders());
    });

    it('PC-60 discount applied at checkout (precondition)', async () => {
      const order = await getOrder(orderId);
      expect(order!.discountAmount).toBe(EXPECTED_DISCOUNT);
    });

    it('PC-61 promotion_usages.status=confirmed immediately after checkout', async () => {
      const usages = await getPromotionUsagesByOrderId(orderId);
      expect(usages).toHaveLength(1);
      expect(usages[0].status).toBe('confirmed');
    });

    it('PC-62 promotions.current_total_uses=1 before cancellation', async () => {
      const promo = await getPromotion(promoId);
      expect(promo!.currentTotalUses).toBe(1);
    });

    it('PC-63 customer can cancel their own pending order', async () => {
      const res = await http
        .patch(`/api/orders/${orderId}/cancel`)
        .set(customerHeaders())
        .send({ reason: 'Testing PR-4 rollback' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');
    });

    it('PC-64 promotion_usages.status=rolled_back after cancellation', async () => {
      // Allow async PromotionRollbackOnCancellationHandler to complete
      await delay(300);
      const usages = await getPromotionUsagesByOrderId(orderId);
      expect(usages[0].status).toBe('rolled_back');
    });

    it('PC-65 promotions.current_total_uses decremented to 0 after rollback', async () => {
      const promo = await getPromotion(promoId);
      expect(promo!.currentTotalUses).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §8 PR-4 — Rollback on payment failure (PaymentFailedEvent)
  // ──────────────────────────────────────────────────────────────────────────

  describe('§8 PR-4 — Rollback on payment failure', () => {
    let promoId: string;
    let orderId: string;

    beforeAll(async () => {
      const createRes = await http
        .post('/api/promotions/admin')
        .set(adminHeaders())
        .send({
          name: 'PC Rollback Payment Fail Test',
          type: 'percentage',
          scope: 'platform',
          trigger: 'auto_apply',
          discountValue: 10,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
          maxTotalUses: 1000,
        });
      expect(createRes.status).toBe(201);
      promoId = createRes.body.id as string;

      await http
        .patch(`/api/promotions/admin/${promoId}/activate`)
        .set(adminHeaders());

      // Place VNPay order — discount is applied and usage confirmed
      const result = await doCheckout(customerToken, {
        paymentMethod: 'vnpay',
      });
      orderId = result.orderId;
    });

    afterAll(async () => {
      await http
        .patch(`/api/promotions/admin/${promoId}/pause`)
        .set(adminHeaders());
    });

    it('PC-70 VNPay order placed with discount (precondition)', async () => {
      const order = await getOrder(orderId);
      expect(order!.discountAmount).toBe(5000);
      expect(order!.paymentMethod).toBe('vnpay');
      expect(order!.status).toBe('pending');
    });

    it('PC-71 usage confirmed before payment failure', async () => {
      const usages = await getPromotionUsagesByOrderId(orderId);
      expect(usages).toHaveLength(1);
      expect(usages[0].status).toBe('confirmed');
    });

    it('PC-72 PaymentFailedEvent cancels order and triggers rollback', async () => {
      // Simulate payment gateway failure by publishing the event directly
      const eventBus = app.get(EventBus);
      eventBus.publish(
        new PaymentFailedEvent(
          orderId,
          customerId,
          'vnpay',
          'Payment gateway timeout',
          new Date(),
        ),
      );

      // Allow multi-hop async chain to complete:
      //   PaymentFailedEvent → PaymentFailedEventHandler → TransitionOrderCommand
      //   → TransitionOrderHandler → OrderStatusChangedEvent
      //   → PromotionRollbackOnCancellationHandler → rollbackReservations
      await delay(500);

      const order = await getOrder(orderId);
      expect(order!.status).toBe('cancelled');
    });

    it('PC-73 promotion_usages.status=rolled_back after payment failure', async () => {
      const usages = await getPromotionUsagesByOrderId(orderId);
      expect(usages[0].status).toBe('rolled_back');
    });

    it('PC-74 promotions.current_total_uses decremented to 0 after rollback', async () => {
      const promo = await getPromotion(promoId);
      expect(promo!.currentTotalUses).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §9 PR-4 — Rollback idempotency (double cancel)
  // ──────────────────────────────────────────────────────────────────────────

  describe('§9 PR-4 — Rollback idempotency (double cancel)', () => {
    let promoId: string;
    let orderId: string;

    beforeAll(async () => {
      const createRes = await http
        .post('/api/promotions/admin')
        .set(adminHeaders())
        .send({
          name: 'PC Rollback Idempotency Test',
          type: 'percentage',
          scope: 'platform',
          trigger: 'auto_apply',
          discountValue: 10,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
          maxTotalUses: 1000,
        });
      expect(createRes.status).toBe(201);
      promoId = createRes.body.id as string;

      await http
        .patch(`/api/promotions/admin/${promoId}/activate`)
        .set(adminHeaders());

      const result = await doCheckout(customerToken);
      orderId = result.orderId;
    });

    afterAll(async () => {
      await http
        .patch(`/api/promotions/admin/${promoId}/pause`)
        .set(adminHeaders());
    });

    it('PC-80 first cancel transitions order to cancelled and rolls back usage', async () => {
      const res = await http
        .patch(`/api/orders/${orderId}/cancel`)
        .set(customerHeaders())
        .send({ reason: 'Test rollback idempotency' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');

      await delay(300);

      const usages = await getPromotionUsagesByOrderId(orderId);
      expect(usages[0].status).toBe('rolled_back');

      const promo = await getPromotion(promoId);
      expect(promo!.currentTotalUses).toBe(0);
    });

    it('PC-81 second cancel is idempotent (200, no double-decrement)', async () => {
      // Idempotency: TransitionOrderHandler returns the current order unchanged
      // when toStatus === order.status (already cancelled). No OrderStatusChangedEvent
      // is published, so PromotionRollbackOnCancellationHandler does NOT fire again.
      const res = await http
        .patch(`/api/orders/${orderId}/cancel`)
        .set(customerHeaders())
        .send({ reason: 'Re-cancel for idempotency test' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');

      await delay(300);

      // Counter must still be 0, not -1
      const promo = await getPromotion(promoId);
      expect(promo!.currentTotalUses).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §10 Monetary invariant
  // ──────────────────────────────────────────────────────────────────────────

  describe('§10 Monetary invariant', () => {
    let promoId: string;

    beforeAll(async () => {
      const createRes = await http
        .post('/api/promotions/admin')
        .set(adminHeaders())
        .send({
          name: 'PC Monetary Invariant Test',
          type: 'percentage',
          scope: 'platform',
          trigger: 'auto_apply',
          discountValue: 10,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
        });
      expect(createRes.status).toBe(201);
      promoId = createRes.body.id as string;

      await http
        .patch(`/api/promotions/admin/${promoId}/activate`)
        .set(adminHeaders());
    });

    afterAll(async () => {
      await http
        .patch(`/api/promotions/admin/${promoId}/pause`)
        .set(adminHeaders());
    });

    it('PC-90 totalAmount = itemsTotal + shippingFee − discountAmount (response)', async () => {
      const result = await doCheckout(customerToken);
      const itemsTotal = ITEM_PRICE; // 1 item × 50000
      expect(result.totalAmount).toBe(
        itemsTotal + result.shippingFee - result.discountAmount,
      );
    });

    it('PC-91 DB total_amount matches the same invariant', async () => {
      const result = await doCheckout(customerToken);
      const order = await getOrder(result.orderId);
      const itemsTotal = ITEM_PRICE;
      // shippingFee=0 (no coordinates) → invariant: total = items - discount
      expect(order!.totalAmount).toBe(
        itemsTotal + order!.shippingFee - order!.discountAmount,
      );
    });

    it('PC-92 discountAmount is a multiple of 1000 VND', async () => {
      const result = await doCheckout(customerToken);
      expect(result.discountAmount % 1000).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §11 Case-insensitive coupon input
  // ──────────────────────────────────────────────────────────────────────────

  describe('§11 Case-insensitive coupon input', () => {
    let promoId: string;
    let couponId: string;
    const COUPON_CODE_UPPER = 'UPPERCASE1';

    beforeAll(async () => {
      const createRes = await http
        .post('/api/promotions/admin')
        .set(adminHeaders())
        .send({
          name: 'PC Case-Insensitive Coupon Test',
          type: 'fixed_amount',
          scope: 'restaurant',
          trigger: 'coupon_code',
          discountValue: 5000,
          restaurantId: TEST_RESTAURANT_ID,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
          maxTotalUses: 100,
        });
      expect(createRes.status).toBe(201);
      promoId = createRes.body.id as string;

      await http
        .patch(`/api/promotions/admin/${promoId}/activate`)
        .set(adminHeaders());

      const couponRes = await http
        .post(`/api/promotions/admin/${promoId}/coupons`)
        .set(adminHeaders())
        .send({ codes: [COUPON_CODE_UPPER], maxUsesPerCode: 50 });
      expect(couponRes.status).toBe(201);
      couponId = (couponRes.body as Array<{ id: string }>)[0].id;
    });

    afterAll(async () => {
      await http
        .patch(`/api/promotions/admin/${promoId}/pause`)
        .set(adminHeaders());
    });

    it('PC-100 uppercase coupon code accepted and discount applied', async () => {
      const result = await doCheckout(customerToken, {
        couponCode: COUPON_CODE_UPPER, // 'UPPERCASE1'
      });
      expect(result.discountAmount).toBe(5000);
    });

    it('PC-101 lowercase coupon code is normalised and accepted (same discount)', async () => {
      // @Transform(toUpperCase) in CheckoutDto normalises 'uppercase1' → 'UPPERCASE1'
      // before validation — the @Matches regex then passes.
      const result = await doCheckout(customerToken, {
        couponCode: 'uppercase1', // lowercase → normalised to 'UPPERCASE1' by DTO
      });
      expect(result.discountAmount).toBe(5000);
    });

    it('PC-102 mixed-case coupon code also normalised correctly', async () => {
      const result = await doCheckout(customerToken, {
        couponCode: 'Uppercase1', // mixed → normalised to 'UPPERCASE1'
      });
      expect(result.discountAmount).toBe(5000);
    });

    it('PC-103 coupon uses incremented for each normalised redemption', async () => {
      const coupon = await getCouponCode(couponId);
      // Three checkouts above: each used the same normalised code
      expect(coupon!.currentUses).toBe(3);
    });
  });
});
