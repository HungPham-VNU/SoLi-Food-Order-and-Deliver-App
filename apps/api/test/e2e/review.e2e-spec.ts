/**
 * review.e2e-spec.ts — UC-22 Submit Rating & Review E2E Tests
 *
 * Coverage (all scenarios from UC22 implementation proposal §16.2):
 *   §1  Happy path: submit review for a delivered order
 *   §2  Rating projection updates restaurants.average_rating / rating_sum / review_count
 *   §3  Duplicate submission → 409 (BR-22.9)
 *   §4  Order not delivered → 422 (BR-22.6, BR-22.7)
 *   §5  Order not found → 404
 *   §6  Order not owned by caller → 404 (BR-22.4, BR-22.5, no info-leak)
 *   §7  Validation: stars out of range, tags not allowlisted, comment too long
 *   §8  Auth: missing token → 401
 *   §9  Auth: wrong role (restaurant owner) → 403
 *   §10 GET /reviews/my/:orderId — returns own review, 404 for stranger
 *   §11 GET /reviews/restaurant/:id — pagination + ordering + only visible
 *   §12 GET /orders/my/:id — hasReview true after review, false before (GAP-13)
 *   §13 ReviewSubmittedEvent delivered → notification row + 'new_review' template
 *
 * All state changes go through HTTP (no direct DB inserts for orders).
 * Patterns follow apps/api/docs/Bình's docs/E2E_TESTING_PLAYBOOK.md.
 */

import type { INestApplication } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import request from 'supertest';

import { createTestApp, teardownTestApp } from '../setup/app-factory';
import {
  getTestDb,
  resetDb,
  seedBaseRestaurant,
  TEST_RESTAURANT_ID,
} from '../setup/db-setup';
import { TestAuthManager, TEST_PASSWORD } from '../helpers/test-auth';
import {
  noAuthHeaders,
  ownerHeaders,
  setAuthManager,
} from '../helpers/auth';
import { user as userTable } from '../../src/module/auth/auth.schema';
import { restaurants } from '../../src/module/restaurant-catalog/restaurant/restaurant.schema';
import { reviews } from '../../src/module/review/domain/review.schema';
import { notifications } from '../../src/module/notification/domain/notification.schema';

// ─── Suite-specific extra users ───────────────────────────────────────────────
const RV_CUSTOMER_EMAIL = 'rv-customer@test.soli';
const RV_OTHER_CUSTOMER_EMAIL = 'rv-other-customer@test.soli';
const RV_SHIPPER_EMAIL = 'rv-shipper@test.soli';
const RV_EXTRA_EMAILS = [
  RV_CUSTOMER_EMAIL,
  RV_OTHER_CUSTOMER_EMAIL,
  RV_SHIPPER_EMAIL,
] as const;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const DELIVERY_ADDRESS = {
  street: '789 Review Road',
  district: 'District 5',
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

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ─── Cart + lifecycle helpers ────────────────────────────────────────────────

async function clearCart(
  http: ReturnType<typeof request>,
  token: string,
): Promise<void> {
  await http.delete('/api/carts/my').set(authHeader(token));
}

async function addItemToCart(
  http: ReturnType<typeof request>,
  token: string,
  menuItemId: string,
): Promise<void> {
  const res = await http
    .post('/api/carts/my/items')
    .set(authHeader(token))
    .send({
      menuItemId,
      restaurantId: TEST_RESTAURANT_ID,
      restaurantName: 'E2E Test Restaurant',
      itemName: 'Test Burger',
      unitPrice: 10.0,
      quantity: 1,
    });
  expect(res.status).toBe(201);
}

async function placeOrder(
  http: ReturnType<typeof request>,
  token: string,
  menuItemId: string,
): Promise<string> {
  await clearCart(http, token);
  await addItemToCart(http, token, menuItemId);
  const res = await http
    .post('/api/carts/my/checkout')
    .set(authHeader(token))
    .send({ deliveryAddress: DELIVERY_ADDRESS, paymentMethod: 'cod' });
  expect(res.status).toBe(201);
  return res.body.orderId as string;
}

async function advanceToDelivered(
  http: ReturnType<typeof request>,
  orderId: string,
  ownerToken: string,
  shipperToken: string,
): Promise<void> {
  const steps: Array<[string, string]> = [
    [`/api/orders/${orderId}/confirm`, ownerToken],
    [`/api/orders/${orderId}/start-preparing`, ownerToken],
    [`/api/orders/${orderId}/ready`, ownerToken],
    [`/api/orders/${orderId}/pickup`, shipperToken],
    [`/api/orders/${orderId}/en-route`, shipperToken],
    [`/api/orders/${orderId}/deliver`, shipperToken],
  ];
  for (const [url, token] of steps) {
    const res = await http.patch(url).set(authHeader(token));
    expect(res.status).toBe(200);
  }
}

async function advanceToReady(
  http: ReturnType<typeof request>,
  orderId: string,
  ownerToken: string,
): Promise<void> {
  for (const url of [
    `/api/orders/${orderId}/confirm`,
    `/api/orders/${orderId}/start-preparing`,
    `/api/orders/${orderId}/ready`,
  ]) {
    const res = await http.patch(url).set(authHeader(ownerToken));
    expect(res.status).toBe(200);
  }
}

// ─── Main suite ──────────────────────────────────────────────────────────────

describe('UC-22 Submit Rating & Review E2E', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  let testAuth: TestAuthManager;

  let customerToken: string;
  let customerId: string;
  let otherCustomerToken: string;
  let shipperToken: string;

  let menuItemId: string;

  // Orders created in beforeAll
  let deliveredOrderId: string; // used by happy-path & projection
  let pendingOrderId: string; // for ineligible-status tests (pending = not yet accepted)
  // Per-test delivered orders created fresh on demand to avoid cross-test interference
  // when a previous test already created a review for the order.

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());

    await resetDb();

    const db = getTestDb();
    await db.delete(userTable).where(inArray(userTable.email, RV_EXTRA_EMAILS));

    // Standard 2-user owner pair
    testAuth = new TestAuthManager();
    await testAuth.initialize(http);
    setAuthManager(testAuth);

    // Suite extras
    const c = await signUpUser(http, RV_CUSTOMER_EMAIL, 'RV Customer');
    customerToken = c.token;
    customerId = c.userId;
    // No role update → resolveRole returns 'customer'

    const o = await signUpUser(http, RV_OTHER_CUSTOMER_EMAIL, 'RV Other Cust');
    otherCustomerToken = o.token;

    const s = await signUpUser(http, RV_SHIPPER_EMAIL, 'RV Shipper');
    shipperToken = s.token;
    await db
      .update(userTable)
      .set({ role: 'shipper' })
      .where(eq(userTable.id, s.userId));

    // Seed restaurant + fire RestaurantUpdatedEvent so the notification ACL
    // snapshot exists for the new_review notification handler.
    await seedBaseRestaurant(testAuth.ownerUserId);
    const patchRes = await http
      .patch(`/api/restaurants/${TEST_RESTAURANT_ID}`)
      .set(ownerHeaders())
      .send({ name: 'E2E Test Restaurant' });
    expect(patchRes.status).toBe(200);
    await delay(200);

    // Create menu item
    const itemRes = await http
      .post('/api/menu-items')
      .set(ownerHeaders())
      .send({
        restaurantId: TEST_RESTAURANT_ID,
        name: 'Test Burger',
        price: 10000,
      });
    expect(itemRes.status).toBe(201);
    menuItemId = itemRes.body.id as string;
    await delay(200);

    // Clear stale carts
    await clearCart(http, customerToken);
    await clearCart(http, otherCustomerToken);

    // Seed one delivered order (used by §1, §2, §3, §10, §12, §13)
    deliveredOrderId = await placeOrder(http, customerToken, menuItemId);
    await advanceToDelivered(
      http,
      deliveredOrderId,
      testAuth.ownerToken,
      shipperToken,
    );

    // Seed one pending order (used by §4 — not yet accepted by restaurant)
    pendingOrderId = await placeOrder(http, customerToken, menuItemId);
  }, 60_000);

  afterAll(async () => {
    const db = getTestDb();
    await db.delete(userTable).where(inArray(userTable.email, RV_EXTRA_EMAILS));
    await teardownTestApp(app);
  });

  /**
   * Place a fresh order and advance it to delivered. Returns the orderId.
   * Used by tests that need a clean, never-reviewed delivered order.
   */
  async function freshDeliveredOrder(
    customer: string = customerToken,
  ): Promise<string> {
    const id = await placeOrder(http, customer, menuItemId);
    await advanceToDelivered(http, id, testAuth.ownerToken, shipperToken);
    return id;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // §1  Happy path: POST /reviews on a delivered order
  // ──────────────────────────────────────────────────────────────────────────

  describe('§1 POST /api/reviews — happy path', () => {
    it('RV-01 returns 201 with the persisted review', async () => {
      const orderId = await freshDeliveredOrder();

      const res = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({
          orderId,
          stars: 5,
          comment: 'Excellent food and very fast delivery!',
          tags: ['fast_delivery', 'fresh_food'],
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        orderId,
        customerId,
        restaurantId: TEST_RESTAURANT_ID,
        stars: 5,
        comment: 'Excellent food and very fast delivery!',
        tags: ['fast_delivery', 'fresh_food'],
        moderationStatus: 'visible',
        message: expect.any(String),
      });
      expect(typeof res.body.createdAt).toBe('string');
    });

    it('RV-02 accepts the minimum payload (stars only)', async () => {
      const orderId = await freshDeliveredOrder();
      const res = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({ orderId, stars: 3 });

      expect(res.status).toBe(201);
      expect(res.body.stars).toBe(3);
      expect(res.body.comment).toBeNull();
      expect(res.body.tags).toBeNull();
    });

    it('RV-03 trims whitespace from comment', async () => {
      const orderId = await freshDeliveredOrder();
      const res = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({ orderId, stars: 4, comment: '   nice meal   ' });
      expect(res.status).toBe(201);
      expect(res.body.comment).toBe('nice meal');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §2  Rating projection
  // ──────────────────────────────────────────────────────────────────────────

  describe('§2 restaurants rating projection (BR-22.12)', () => {
    it('RV-10 increments rating_sum / review_count / average_rating atomically', async () => {
      const db = getTestDb();
      const beforeRows = await db
        .select({
          ratingSum: restaurants.ratingSum,
          reviewCount: restaurants.reviewCount,
          averageRating: restaurants.averageRating,
        })
        .from(restaurants)
        .where(eq(restaurants.id, TEST_RESTAURANT_ID));
      const before = beforeRows[0];

      const orderId = await freshDeliveredOrder();
      const res = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({ orderId, stars: 2 });
      expect(res.status).toBe(201);

      const afterRows = await db
        .select({
          ratingSum: restaurants.ratingSum,
          reviewCount: restaurants.reviewCount,
          averageRating: restaurants.averageRating,
        })
        .from(restaurants)
        .where(eq(restaurants.id, TEST_RESTAURANT_ID));
      const after = afterRows[0];

      expect(after.ratingSum).toBe(before.ratingSum + 2);
      expect(after.reviewCount).toBe(before.reviewCount + 1);
      const expectedAvg = after.ratingSum / after.reviewCount;
      expect(after.averageRating).toBeCloseTo(expectedAvg, 4);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §3  Duplicate submission
  // ──────────────────────────────────────────────────────────────────────────

  describe('§3 POST /api/reviews — duplicate (BR-22.8 / BR-22.9)', () => {
    it('RV-20 second review for the same order returns 409 MSG-RATE-03', async () => {
      const orderId = await freshDeliveredOrder();
      const first = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({ orderId, stars: 4 });
      expect(first.status).toBe(201);

      const second = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({ orderId, stars: 1 });

      expect(second.status).toBe(409);
      expect(second.body.message).toMatch(/already submitted/i);
      expect(second.body.code).toBe('MSG-RATE-03');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §4  Order not completed
  // ──────────────────────────────────────────────────────────────────────────

  describe('§4 POST /api/reviews — ineligible order (BR-22.6, BR-22.7)', () => {
    it('RV-30 pending order returns 422 MSG-RATE-02', async () => {
      const res = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({ orderId: pendingOrderId, stars: 5 });

      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/completed/i);
      expect(res.body.code).toBe('MSG-RATE-02');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §5  Order not found
  // ──────────────────────────────────────────────────────────────────────────

  describe('§5 POST /api/reviews — order not found', () => {
    it('RV-40 unknown orderId returns 404', async () => {
      const res = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({
          orderId: '00000000-0000-4000-8000-000000000000',
          stars: 5,
        });

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §6  Order not owned by caller (info-leak avoidance)
  // ──────────────────────────────────────────────────────────────────────────

  describe('§6 POST /api/reviews — wrong owner (BR-22.4, BR-22.5)', () => {
    it("RV-50 stranger's review attempt returns 404 (not 403)", async () => {
      const orderId = await freshDeliveredOrder(); // owned by customer
      const res = await http
        .post('/api/reviews')
        .set(authHeader(otherCustomerToken))
        .send({ orderId, stars: 5 });

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §7  Validation
  // ──────────────────────────────────────────────────────────────────────────

  describe('§7 POST /api/reviews — validation (MSG-RATE-01)', () => {
    it('RV-60 stars < 1 → 400', async () => {
      const res = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({ orderId: deliveredOrderId, stars: 0 });
      expect(res.status).toBe(400);
    });

    it('RV-61 stars > 5 → 400', async () => {
      const res = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({ orderId: deliveredOrderId, stars: 6 });
      expect(res.status).toBe(400);
    });

    it('RV-62 non-integer stars → 400', async () => {
      const res = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({ orderId: deliveredOrderId, stars: 3.5 });
      expect(res.status).toBe(400);
    });

    it('RV-63 unknown tag → 400', async () => {
      const res = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({
          orderId: deliveredOrderId,
          stars: 4,
          tags: ['totally_made_up'],
        });
      expect(res.status).toBe(400);
    });

    it('RV-64 more than 5 tags → 400', async () => {
      const res = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({
          orderId: deliveredOrderId,
          stars: 4,
          tags: [
            'fast_delivery',
            'good_packaging',
            'fresh_food',
            'accurate_order',
            'friendly_service',
            'cold_food',
          ],
        });
      expect(res.status).toBe(400);
    });

    it('RV-65 comment over 1000 chars → 400', async () => {
      const res = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({
          orderId: deliveredOrderId,
          stars: 4,
          comment: 'x'.repeat(1001),
        });
      expect(res.status).toBe(400);
    });

    it('RV-66 invalid UUID for orderId → 400', async () => {
      const res = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({ orderId: 'not-a-uuid', stars: 4 });
      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §8  Auth: missing token
  // ──────────────────────────────────────────────────────────────────────────

  describe('§8 POST /api/reviews — auth', () => {
    it('RV-70 no Authorization header → 401', async () => {
      const res = await http
        .post('/api/reviews')
        .set(noAuthHeaders())
        .send({ orderId: deliveredOrderId, stars: 5 });
      expect(res.status).toBe(401);
    });

    it('RV-71 restaurant-role caller → 403', async () => {
      const res = await http
        .post('/api/reviews')
        .set(ownerHeaders())
        .send({ orderId: deliveredOrderId, stars: 5 });
      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §10 GET /api/reviews/my/:orderId
  // ──────────────────────────────────────────────────────────────────────────

  describe('§10 GET /api/reviews/my/:orderId', () => {
    let myOrderId: string;

    beforeAll(async () => {
      myOrderId = await freshDeliveredOrder();
      const created = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({ orderId: myOrderId, stars: 5, comment: 'top notch' });
      expect(created.status).toBe(201);
    });

    it('RV-80 returns the caller\'s review (200)', async () => {
      const res = await http
        .get(`/api/reviews/my/${myOrderId}`)
        .set(authHeader(customerToken));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        orderId: myOrderId,
        customerId,
        stars: 5,
        comment: 'top notch',
        moderationStatus: 'visible',
      });
    });

    it('RV-81 returns 404 when no review exists', async () => {
      const orderId = await freshDeliveredOrder();
      const res = await http
        .get(`/api/reviews/my/${orderId}`)
        .set(authHeader(customerToken));
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('MSG-RATE-05');
    });

    it("RV-82 returns 404 for another customer's review", async () => {
      const res = await http
        .get(`/api/reviews/my/${myOrderId}`)
        .set(authHeader(otherCustomerToken));
      expect(res.status).toBe(404);
    });

    it('RV-83 missing token → 401', async () => {
      const res = await http
        .get(`/api/reviews/my/${myOrderId}`)
        .set(noAuthHeaders());
      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §11 GET /api/reviews/restaurant/:restaurantId — public listing
  // ──────────────────────────────────────────────────────────────────────────

  describe('§11 GET /api/reviews/restaurant/:restaurantId', () => {
    it('RV-90 returns paginated visible reviews (no auth required)', async () => {
      const res = await http.get(
        `/api/reviews/restaurant/${TEST_RESTAURANT_ID}?page=1&limit=20`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: expect.any(Array),
        total: expect.any(Number),
        page: 1,
        limit: 20,
      });
      expect(res.body.data.length).toBeGreaterThan(0);

      // Public DTO must NOT expose customerId
      for (const item of res.body.data as Array<Record<string, unknown>>) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('stars');
        expect(item).toHaveProperty('createdAt');
        expect(item).not.toHaveProperty('customerId');
        expect(item).not.toHaveProperty('moderationStatus');
      }
    });

    it('RV-91 hidden reviews are excluded (BR-22.13)', async () => {
      // Hide every review for this restaurant via direct DB update, count them,
      // then restore so subsequent assertions remain stable.
      const db = getTestDb();
      const all = await db
        .select({ id: reviews.id })
        .from(reviews)
        .where(eq(reviews.restaurantId, TEST_RESTAURANT_ID));
      expect(all.length).toBeGreaterThan(0);

      await db
        .update(reviews)
        .set({ moderationStatus: 'hidden' })
        .where(eq(reviews.restaurantId, TEST_RESTAURANT_ID));

      try {
        const res = await http.get(
          `/api/reviews/restaurant/${TEST_RESTAURANT_ID}`,
        );
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(0);
        expect(res.body.data).toEqual([]);
      } finally {
        await db
          .update(reviews)
          .set({ moderationStatus: 'visible' })
          .where(eq(reviews.restaurantId, TEST_RESTAURANT_ID));
      }
    });

    it('RV-92 invalid restaurantId UUID → 400', async () => {
      const res = await http.get('/api/reviews/restaurant/not-a-uuid');
      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §12 GET /api/orders/my/:id — hasReview flag (GAP-13)
  // ──────────────────────────────────────────────────────────────────────────

  describe('§12 GET /api/orders/my/:id — hasReview integration', () => {
    it('RV-100 hasReview=false before review, true after', async () => {
      const orderId = await freshDeliveredOrder();

      const beforeRes = await http
        .get(`/api/orders/my/${orderId}`)
        .set(authHeader(customerToken));
      expect(beforeRes.status).toBe(200);
      expect(beforeRes.body.hasReview).toBe(false);

      const submit = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({ orderId, stars: 4 });
      expect(submit.status).toBe(201);

      const afterRes = await http
        .get(`/api/orders/my/${orderId}`)
        .set(authHeader(customerToken));
      expect(afterRes.status).toBe(200);
      expect(afterRes.body.hasReview).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §13 ReviewSubmittedEvent → notification side-effect
  // ──────────────────────────────────────────────────────────────────────────

  describe('§13 ReviewSubmittedEvent → notification side-effect', () => {
    it('RV-110 inserts a new_review notification row for the restaurant owner', async () => {
      const orderId = await freshDeliveredOrder();
      const res = await http
        .post('/api/reviews')
        .set(authHeader(customerToken))
        .send({ orderId, stars: 5, comment: 'awesome' });
      expect(res.status).toBe(201);

      // Async EventBus handler — give it a moment to persist
      await delay(400);

      const db = getTestDb();
      const rows = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.type, 'new_review'),
            eq(notifications.recipientId, testAuth.ownerUserId),
          ),
        );

      expect(rows.length).toBeGreaterThan(0);
      const latest = rows[rows.length - 1];
      expect(latest.title).toMatch(/Đánh giá mới/);
      expect(latest.body).toMatch(/5 sao/);
      expect(latest.body).toMatch(new RegExp(orderId));
    });
  });
});
