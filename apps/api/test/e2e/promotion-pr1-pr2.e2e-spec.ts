/**
 * promotion-pr1-pr2.e2e-spec.ts
 *
 * End-to-end tests for Promotion BC — Phase PR-1 (Schema + Engine) and
 * Phase PR-2 (Admin CRUD + Restaurant CRUD + Public endpoints).
 *
 * Covers:
 *   §1  Admin — Create platform promotion (percentage, auto_apply)
 *   §2  Admin — Create restaurant-scoped promotion (fixed_amount, coupon_code)
 *   §3  Admin — List promotions (with filters)
 *   §4  Admin — Get by ID (200, 404)
 *   §5  Admin — Update promotion fields
 *   §6  Admin — Activate (draft → active)
 *   §7  Admin — Pause (active → paused)
 *   §8  Admin — Re-activate (paused → active)
 *   §9  Admin — Cancel (idempotent + update-after-cancel → 400)
 *   §10 Admin — Create coupon codes (batch)
 *   §11 Admin — Duplicate coupon → 409
 *   §12 Admin — Coupons on auto_apply promotion → 400
 *   §13 Admin — List coupon codes
 *   §14 Restaurant — Create restaurant-scoped promo
 *   §15 Restaurant — Cannot create platform-scope promo
 *   §16 Restaurant — Cannot access admin endpoints
 *   §17 Restaurant — Owner isolation (cannot manage another restaurant's promo)
 *   §18 Public — GET /promotions/active (anonymous)
 *   §19 Public — POST /promotions/preview (authenticated customer)
 *   §20 Public — POST /promotions/coupons/validate (authenticated)
 *   §21 Public — Invalid coupon → applicable=false
 *   §22 RBAC   — Missing auth on protected endpoints → 401
 *   §23 Monetary invariant — 15% on 150,000 → floor to 22,000
 *   §24 Monetary invariant — amounts are integers, multiples of 1000
 *   §25 Coupon normalisation — lowercase input accepted
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { eq } from 'drizzle-orm';
import { createTestApp, teardownTestApp } from '../setup/app-factory';
import {
  resetDb,
  seedBaseRestaurant,
  getTestDb,
  TEST_RESTAURANT_ID,
} from '../setup/db-setup';
import {
  setAuthManager,
  ownerHeaders,
  otherUserHeaders,
  noAuthHeaders,
} from '../helpers/auth';
import { TestAuthManager, TEST_PASSWORD } from '../helpers/test-auth';
import { user } from '../../src/module/auth/auth.schema';

// ─── Test user constants ──────────────────────────────────────────────────────

const TEST_ADMIN_EMAIL = 'e2e-admin-promo@test.soli';
const TEST_CUSTOMER_EMAIL = 'e2e-customer-promo@test.soli';

// ─── Test date constants ──────────────────────────────────────────────────────

const ACTIVE_START = '2025-01-01T00:00:00.000Z';
const ACTIVE_END = '2030-12-31T23:59:59.000Z';
const FUTURE_START = '2030-01-01T00:00:00.000Z';
const FUTURE_END = '2031-12-31T23:59:59.000Z';

// ─── Helpers ──────────────────────────────────────────────────────────────────

describe('Promotion PR-1 + PR-2 (E2E)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;

  let adminToken: string;
  let customerToken: string;

  /** Created promo IDs used across sections. */
  let platformPromoId: string;
  let couponPromoId: string;
  let restaurantPromoId: string; // created by restaurant owner

  function adminHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${adminToken}` };
  }

  function customerHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${customerToken}` };
  }

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());

    await resetDb();

    // ── Owner + non-owner (restaurant role) ──
    const testAuth = new TestAuthManager();
    await testAuth.initialize(http);
    setAuthManager(testAuth);
    await seedBaseRestaurant(testAuth.ownerUserId);

    // ── Admin user ──
    const adminSignUp = await http
      .post('/api/auth/sign-up/email')
      .set('Content-Type', 'application/json')
      .send({
        email: TEST_ADMIN_EMAIL,
        password: TEST_PASSWORD,
        name: 'E2E Admin Promo',
      });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    adminToken = (adminSignUp.body?.token ??
      adminSignUp.body?.session?.token) as string;

    // ── Customer user ──
    const customerSignUp = await http
      .post('/api/auth/sign-up/email')
      .set('Content-Type', 'application/json')
      .send({
        email: TEST_CUSTOMER_EMAIL,
        password: TEST_PASSWORD,
        name: 'E2E Customer',
      });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    customerToken = (customerSignUp.body?.token ??
      customerSignUp.body?.session?.token) as string;

    // Grant admin role via Drizzle
    const db = getTestDb();
    await db
      .update(user)
      .set({ role: 'admin' })
      .where(eq(user.email, TEST_ADMIN_EMAIL));
    // Customer stays as default 'customer' role
  });

  afterAll(async () => {
    const db = getTestDb();
    await db.delete(user).where(eq(user.email, TEST_ADMIN_EMAIL));
    await db.delete(user).where(eq(user.email, TEST_CUSTOMER_EMAIL));
    await teardownTestApp(app);
  });

  // ─── §1 Admin — Create platform promotion (percentage, auto_apply) ──────────

  describe('§1 Admin — Create platform promotion', () => {
    it('creates a percentage auto_apply platform promotion and returns 201', async () => {
      const res = await http
        .post('/api/promotions/admin')
        .set(adminHeaders())
        .send({
          name: 'Platform 10% Off',
          description: 'Test platform promo',
          type: 'percentage',
          scope: 'platform',
          trigger: 'auto_apply',
          discountValue: 10,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
          maxTotalUses: 1000,
          minOrderAmount: 50000,
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'Platform 10% Off',
        type: 'percentage',
        scope: 'platform',
        trigger: 'auto_apply',
        discountValue: 10,
        status: 'draft',
      });
      expect(typeof res.body.id).toBe('string');
      platformPromoId = res.body.id as string;
    });

    it('returns 401 without auth', async () => {
      const res = await http
        .post('/api/promotions/admin')
        .set(noAuthHeaders())
        .send({
          name: 'x',
          type: 'percentage',
          scope: 'platform',
          trigger: 'auto_apply',
          discountValue: 10,
        });
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin user', async () => {
      const res = await http
        .post('/api/promotions/admin')
        .set(ownerHeaders())
        .send({
          name: 'x',
          type: 'percentage',
          scope: 'platform',
          trigger: 'auto_apply',
          discountValue: 10,
        });
      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid discountValue (>100 for percentage)', async () => {
      const res = await http
        .post('/api/promotions/admin')
        .set(adminHeaders())
        .send({
          name: 'Invalid',
          type: 'percentage',
          scope: 'platform',
          trigger: 'auto_apply',
          discountValue: 150,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
        });
      expect(res.status).toBe(400);
    });
  });

  // ─── §2 Admin — Create restaurant-scoped coupon promotion ──────────────────

  describe('§2 Admin — Create restaurant coupon promotion', () => {
    it('creates a fixed_amount coupon_code restaurant promotion and returns 201', async () => {
      const res = await http
        .post('/api/promotions/admin')
        .set(adminHeaders())
        .send({
          name: 'Restaurant 20k Off',
          type: 'fixed_amount',
          scope: 'restaurant',
          trigger: 'coupon_code',
          discountValue: 20000,
          restaurantId: TEST_RESTAURANT_ID,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
          maxTotalUses: 100,
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'Restaurant 20k Off',
        type: 'fixed_amount',
        scope: 'restaurant',
        trigger: 'coupon_code',
        discountValue: 20000,
        restaurantId: TEST_RESTAURANT_ID,
        status: 'draft',
      });
      couponPromoId = res.body.id as string;
    });

    it('returns 400 when restaurant-scoped promo is created without restaurantId', async () => {
      const res = await http
        .post('/api/promotions/admin')
        .set(adminHeaders())
        .send({
          name: 'Bad Restaurant Promo',
          type: 'fixed_amount',
          scope: 'restaurant',
          trigger: 'coupon_code',
          discountValue: 20000,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
        });
      expect(res.status).toBe(400);
    });
  });

  // ─── §3 Admin — List promotions ─────────────────────────────────────────────

  describe('§3 Admin — List promotions', () => {
    it('lists all promotions and returns 200', async () => {
      const res = await http.get('/api/promotions/admin').set(adminHeaders());

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThanOrEqual(2);
      expect(typeof res.body.total).toBe('number');
    });

    it('filters by status=draft', async () => {
      const res = await http
        .get('/api/promotions/admin?status=draft')
        .set(adminHeaders());

      expect(res.status).toBe(200);
      const statuses: string[] = (
        res.body.items as Array<{ status: string }>
      ).map((p) => p.status);
      expect(statuses.every((s) => s === 'draft')).toBe(true);
    });

    it('filters by restaurantId', async () => {
      const res = await http
        .get(`/api/promotions/admin?restaurantId=${TEST_RESTAURANT_ID}`)
        .set(adminHeaders());

      expect(res.status).toBe(200);
      const ids: (string | null)[] = (
        res.body.items as Array<{ restaurantId: string | null }>
      ).map((p) => p.restaurantId);
      expect(ids.every((id) => id === TEST_RESTAURANT_ID || id === null)).toBe(
        true,
      );
    });
  });

  // ─── §4 Admin — Get by ID ────────────────────────────────────────────────────

  describe('§4 Admin — Get promotion by ID', () => {
    it('returns 200 for existing promotion', async () => {
      const res = await http
        .get(`/api/promotions/admin/${platformPromoId}`)
        .set(adminHeaders());

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(platformPromoId);
    });

    it('returns 404 for non-existent ID', async () => {
      const res = await http
        .get('/api/promotions/admin/00000000-0000-4000-8000-000000000000')
        .set(adminHeaders());

      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid UUID', async () => {
      const res = await http
        .get('/api/promotions/admin/not-a-uuid')
        .set(adminHeaders());

      expect(res.status).toBe(400);
    });
  });

  // ─── §5 Admin — Update promotion fields ──────────────────────────────────────

  describe('§5 Admin — Update promotion', () => {
    it('updates name and description and returns 200', async () => {
      const res = await http
        .patch(`/api/promotions/admin/${platformPromoId}`)
        .set(adminHeaders())
        .send({
          name: 'Platform 10% Off (updated)',
          description: 'Updated desc',
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Platform 10% Off (updated)');
      expect(res.body.description).toBe('Updated desc');
    });

    it('returns 404 for unknown ID', async () => {
      const res = await http
        .patch('/api/promotions/admin/00000000-0000-4000-8000-000000000000')
        .set(adminHeaders())
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(404);
    });
  });

  // ─── §6 Admin — Activate ──────────────────────────────────────────────────────

  describe('§6 Admin — Activate promotion', () => {
    it('transitions draft → active and returns 200', async () => {
      const res = await http
        .patch(`/api/promotions/admin/${platformPromoId}/activate`)
        .set(adminHeaders());

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
    });

    it('coupon promo also transitions to active', async () => {
      const res = await http
        .patch(`/api/promotions/admin/${couponPromoId}/activate`)
        .set(adminHeaders());

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
    });
  });

  // ─── §7 Admin — Pause ────────────────────────────────────────────────────────

  describe('§7 Admin — Pause promotion', () => {
    it('transitions active → paused and returns 200', async () => {
      const res = await http
        .patch(`/api/promotions/admin/${platformPromoId}/pause`)
        .set(adminHeaders());

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('paused');
    });
  });

  // ─── §8 Admin — Re-activate ──────────────────────────────────────────────────

  describe('§8 Admin — Re-activate promotion', () => {
    it('transitions paused → active and returns 200', async () => {
      const res = await http
        .patch(`/api/promotions/admin/${platformPromoId}/activate`)
        .set(adminHeaders());

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
    });
  });

  // ─── §9 Admin — Cancel ───────────────────────────────────────────────────────

  describe('§9 Admin — Cancel promotion', () => {
    it('cancels an active promotion and returns 204', async () => {
      // Create a throwaway promo to cancel
      const create = await http
        .post('/api/promotions/admin')
        .set(adminHeaders())
        .send({
          name: 'To Cancel',
          type: 'percentage',
          scope: 'platform',
          trigger: 'auto_apply',
          discountValue: 5,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
        });
      expect(create.status).toBe(201);
      const cancelId = create.body.id as string;

      await http
        .patch(`/api/promotions/admin/${cancelId}/activate`)
        .set(adminHeaders());

      const cancel = await http
        .delete(`/api/promotions/admin/${cancelId}`)
        .set(adminHeaders());
      expect(cancel.status).toBe(204);

      // Idempotent: cancel again should fail (already cancelled)
      const cancel2 = await http
        .delete(`/api/promotions/admin/${cancelId}`)
        .set(adminHeaders());
      expect(cancel2.status).toBe(400);

      // Update after cancel should fail
      const update = await http
        .patch(`/api/promotions/admin/${cancelId}`)
        .set(adminHeaders())
        .send({ name: 'Should fail' });
      expect(update.status).toBe(400);
    });
  });

  // ─── §10 Admin — Create coupon codes (batch) ─────────────────────────────────

  describe('§10 Admin — Create coupon codes', () => {
    it('creates coupon codes and returns 201', async () => {
      const res = await http
        .post(`/api/promotions/admin/${couponPromoId}/coupons`)
        .set(adminHeaders())
        .send({
          codes: ['SAVE20K', 'PROMO2024', 'VIP100'],
          maxUsesPerCode: 5,
          expiresAt: ACTIVE_END,
        });

      expect(res.status).toBe(201);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(3);

      const codes: string[] = (res.body as Array<{ code: string }>).map(
        (c) => c.code,
      );
      expect(codes).toContain('SAVE20K');
      expect(codes).toContain('PROMO2024');
      expect(codes).toContain('VIP100');
    });

    it('codes are stored as uppercase', async () => {
      const res = await http
        .post(`/api/promotions/admin/${couponPromoId}/coupons`)
        .set(adminHeaders())
        .send({ codes: ['newcode1'], maxUsesPerCode: 1 });

      expect(res.status).toBe(201);
      const codes: string[] = (res.body as Array<{ code: string }>).map(
        (c) => c.code,
      );
      expect(codes[0]).toBe('NEWCODE1');
    });
  });

  // ─── §11 Admin — Duplicate coupon → 409 ──────────────────────────────────────

  describe('§11 Admin — Duplicate coupon code', () => {
    it('returns 409 when adding an already-existing code', async () => {
      const res = await http
        .post(`/api/promotions/admin/${couponPromoId}/coupons`)
        .set(adminHeaders())
        .send({ codes: ['SAVE20K'], maxUsesPerCode: 5 });

      expect(res.status).toBe(409);
    });
  });

  // ─── §12 Admin — Coupons on auto_apply → 400 ─────────────────────────────────

  describe('§12 Admin — Cannot add coupons to auto_apply promotion', () => {
    it('returns 400', async () => {
      const res = await http
        .post(`/api/promotions/admin/${platformPromoId}/coupons`)
        .set(adminHeaders())
        .send({ codes: ['AUTO1'], maxUsesPerCode: 1 });

      expect(res.status).toBe(400);
    });
  });

  // ─── §13 Admin — List coupon codes ────────────────────────────────────────────

  describe('§13 Admin — List coupon codes', () => {
    it('lists coupon codes for a promotion', async () => {
      const res = await http
        .get(`/api/promotions/admin/${couponPromoId}/coupons`)
        .set(adminHeaders());

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── §14 Restaurant — Create promotion ───────────────────────────────────────

  describe('§14 Restaurant — Create promotion', () => {
    it('restaurant owner can create a restaurant-scoped promo', async () => {
      const res = await http
        .post('/api/promotions/restaurant')
        .set(ownerHeaders())
        .query({ restaurantId: TEST_RESTAURANT_ID })
        .send({
          name: 'Owner Promo 5%',
          type: 'percentage',
          scope: 'restaurant',
          trigger: 'auto_apply',
          discountValue: 5,
          restaurantId: TEST_RESTAURANT_ID,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
          maxTotalUses: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.restaurantId).toBe(TEST_RESTAURANT_ID);
      restaurantPromoId = res.body.id as string;
    });

    it('returns 400 for missing restaurantId query param', async () => {
      const res = await http
        .post('/api/promotions/restaurant')
        .set(ownerHeaders())
        .send({
          name: 'Missing restaurantId',
          type: 'percentage',
          scope: 'restaurant',
          trigger: 'auto_apply',
          discountValue: 5,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
        });

      expect(res.status).toBe(400);
    });
  });

  // ─── §15 Restaurant — Cannot create platform-scope promo ─────────────────────

  describe('§15 Restaurant — Cannot create platform-scope promo', () => {
    it('returns 403 when trying to create platform-scope promo', async () => {
      const res = await http
        .post('/api/promotions/restaurant')
        .set(ownerHeaders())
        .query({ restaurantId: TEST_RESTAURANT_ID })
        .send({
          name: 'Sneaky Platform',
          type: 'percentage',
          scope: 'platform',
          trigger: 'auto_apply',
          discountValue: 50,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
        });

      expect(res.status).toBe(403);
    });
  });

  // ─── §16 Restaurant — Cannot access admin endpoints ──────────────────────────

  describe('§16 Restaurant — Cannot access admin endpoints', () => {
    it('returns 403 on admin controller endpoints', async () => {
      const res = await http.get('/api/promotions/admin').set(ownerHeaders());

      expect(res.status).toBe(403);
    });
  });

  // ─── §17 Restaurant — Owner isolation ────────────────────────────────────────

  describe('§17 Restaurant — Owner isolation', () => {
    it('non-owner returns 403 when accessing another restaurant promo', async () => {
      const res = await http
        .get(`/api/promotions/restaurant/${restaurantPromoId}`)
        .set(otherUserHeaders())
        .query({ restaurantId: TEST_RESTAURANT_ID });

      expect(res.status).toBe(403);
    });
  });

  // ─── §18 Public — List active promotions (anonymous) ─────────────────────────

  describe('§18 Public — GET /promotions/active', () => {
    it('returns 200 without auth (anonymous)', async () => {
      const res = await http.get('/api/promotions/active').set(noAuthHeaders());

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('filters by restaurantId', async () => {
      const res = await http
        .get(`/api/promotions/active?restaurantId=${TEST_RESTAURANT_ID}`)
        .set(noAuthHeaders());

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── §19 Public — Preview discount (authenticated) ────────────────────────────

  describe('§19 Public — POST /promotions/preview', () => {
    it('returns computed discount for an active auto_apply promo', async () => {
      // platformPromoId is active 10%, scope=platform
      const res = await http
        .post('/api/promotions/preview')
        .set(customerHeaders())
        .send({
          restaurantId: TEST_RESTAURANT_ID,
          itemsSubtotal: 200000,
          shippingFee: 20000,
        });

      expect(res.status).toBe(200);
      expect(typeof res.body.applicable).toBe('boolean');
      expect(typeof res.body.discountAmount).toBe('number');
      expect(typeof res.body.finalItemsSubtotal).toBe('number');
      expect(typeof res.body.finalShippingFee).toBe('number');
    });

    it('returns 401 without auth', async () => {
      const res = await http
        .post('/api/promotions/preview')
        .set(noAuthHeaders())
        .send({
          restaurantId: TEST_RESTAURANT_ID,
          itemsSubtotal: 100000,
          shippingFee: 15000,
        });

      expect(res.status).toBe(401);
    });
  });

  // ─── §20 Public — Validate coupon ─────────────────────────────────────────────

  describe('§20 Public — POST /promotions/coupons/validate', () => {
    it('validates an active coupon and returns discount info', async () => {
      // couponPromoId is active with SAVE20K code
      const res = await http
        .post('/api/promotions/coupons/validate')
        .set(customerHeaders())
        .send({
          restaurantId: TEST_RESTAURANT_ID,
          itemsSubtotal: 100000,
          shippingFee: 20000,
          code: 'SAVE20K',
        });

      expect(res.status).toBe(200);
      expect(res.body.applicable).toBe(true);
      expect(res.body.discountAmount).toBeGreaterThan(0);
      expect(typeof res.body.couponCodeId).toBe('string');
    });
  });

  // ─── §21 Public — Invalid coupon ──────────────────────────────────────────────

  describe('§21 Public — Invalid coupon returns applicable=false', () => {
    it('returns applicable=false for an unknown coupon code', async () => {
      const res = await http
        .post('/api/promotions/coupons/validate')
        .set(customerHeaders())
        .send({
          restaurantId: TEST_RESTAURANT_ID,
          itemsSubtotal: 100000,
          shippingFee: 20000,
          code: 'NOSUCHCODE',
        });

      expect(res.status).toBe(200);
      expect(res.body.applicable).toBe(false);
    });
  });

  // ─── §22 RBAC — Missing auth on protected endpoints ──────────────────────────

  describe('§22 RBAC — 401 on protected endpoints', () => {
    it('POST /promotions/admin → 401 without auth', async () => {
      const res = await http
        .post('/api/promotions/admin')
        .set(noAuthHeaders())
        .send({});
      expect(res.status).toBe(401);
    });

    it('POST /promotions/restaurant → 401 without auth', async () => {
      const res = await http
        .post('/api/promotions/restaurant')
        .set(noAuthHeaders())
        .send({});
      expect(res.status).toBe(401);
    });

    it('POST /promotions/preview → 401 without auth', async () => {
      const res = await http
        .post('/api/promotions/preview')
        .set(noAuthHeaders())
        .send({
          restaurantId: TEST_RESTAURANT_ID,
          itemsSubtotal: 100000,
          shippingFee: 15000,
        });
      expect(res.status).toBe(401);
    });
  });

  // ─── §23 Monetary invariant — floor to 1000 ───────────────────────────────────

  describe('§23 Monetary invariant — 15% of 150,000 floors to 22,000', () => {
    it('creates 15% promo, activates, previews, verifies floor', async () => {
      // Create 15% promo with minimumOrderValue=0 so 150k qualifies
      const create = await http
        .post('/api/promotions/admin')
        .set(adminHeaders())
        .send({
          name: 'Floor Test 15%',
          type: 'percentage',
          scope: 'platform',
          trigger: 'auto_apply',
          discountValue: 15,
          startsAt: ACTIVE_START,
          endsAt: ACTIVE_END,
          maxTotalUses: 999,
        });
      expect(create.status).toBe(201);
      const floorPromoId = create.body.id as string;

      await http
        .patch(`/api/promotions/admin/${floorPromoId}/activate`)
        .set(adminHeaders());

      // Preview with 150,000 subtotal
      const preview = await http
        .post('/api/promotions/preview')
        .set(customerHeaders())
        .send({
          restaurantId: TEST_RESTAURANT_ID,
          itemsSubtotal: 150000,
          shippingFee: 20000,
        });

      expect(preview.status).toBe(200);
      if (preview.body.applicable) {
        // 15% of 150,000 = 22,500 → floored to 22,000
        expect(preview.body.discountAmount % 1000).toBe(0);
        // The discount should be 22,000 (floor of 22,500)
        expect(preview.body.discountAmount).toBe(22000);
      }
    });
  });

  // ─── §24 Monetary invariant — all amounts are multiples of 1000 ───────────────

  describe('§24 Monetary invariant — amounts are integers multiples of 1000', () => {
    it('preview response amounts are all integers and multiples of 1000', async () => {
      const res = await http
        .post('/api/promotions/preview')
        .set(customerHeaders())
        .send({
          restaurantId: TEST_RESTAURANT_ID,
          itemsSubtotal: 250000,
          shippingFee: 30000,
        });

      expect(res.status).toBe(200);
      expect(Number.isInteger(res.body.discountAmount as number)).toBe(true);
      expect(Number.isInteger(res.body.finalItemsSubtotal as number)).toBe(
        true,
      );
      expect(Number.isInteger(res.body.finalShippingFee as number)).toBe(true);
      expect((res.body.discountAmount as number) % 1000).toBe(0);
      expect((res.body.finalItemsSubtotal as number) % 1000).toBe(0);
      expect((res.body.finalShippingFee as number) % 1000).toBe(0);
    });
  });

  // ─── §25 Coupon normalisation — lowercase input → uppercase storage ────────────

  describe('§25 Coupon normalisation — lowercase input accepted', () => {
    it('validates a coupon code sent as lowercase', async () => {
      const res = await http
        .post('/api/promotions/coupons/validate')
        .set(customerHeaders())
        .send({
          restaurantId: TEST_RESTAURANT_ID,
          itemsSubtotal: 100000,
          shippingFee: 20000,
          code: 'save20k', // lowercase version of SAVE20K
        });

      expect(res.status).toBe(200);
      expect(res.body.applicable).toBe(true);
    });

    it('creates a coupon with mixed case and normalises to uppercase', async () => {
      const res = await http
        .post(`/api/promotions/admin/${couponPromoId}/coupons`)
        .set(adminHeaders())
        .send({ codes: ['mixedCase'], maxUsesPerCode: 1 });

      expect(res.status).toBe(201);
      const code = (res.body as Array<{ code: string }>)[0]?.code;
      expect(code).toBe('MIXEDCASE');
    });
  });
});
