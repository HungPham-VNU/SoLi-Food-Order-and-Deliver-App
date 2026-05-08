/**
 * notification-inbox.e2e-spec.ts — Phase N-3 Notification Inbox REST API E2E Tests
 *
 * Tests the full in-app notification inbox REST API:
 *  §1  Empty inbox — GET /notifications/my returns empty state correctly
 *  §2  Notification generation — EventBus publish → notification appears in inbox
 *  §3  Unread count — GET /notifications/my/unread-count (Redis-cached)
 *  §4  Mark single as read — PATCH /notifications/:id/read
 *  §5  Mark all as read — PATCH /notifications/my/read-all
 *  §6  Pagination — limit/offset parameters
 *  §7  Filters — unreadOnly and type filters
 *  §8  Cross-user isolation — my inbox only shows MY notifications
 *  §9  Mark-read idempotency — re-marking read returns success:true
 *  §10 Auth guard — 401 without token
 *  §11 Input validation — invalid UUID → 400, invalid query params handled
 *
 * Architecture:
 *  - Uses direct EventBus.publish() to trigger notifications without requiring
 *    a full checkout/payment HTTP flow (faster, more isolated).
 *  - Uses distinct email addresses to avoid collision with other E2E suites.
 *  - Deletes notification rows + resets DB in beforeAll for a clean state.
 *  - Real NestJS app, real PostgreSQL + Redis (no mocks).
 *
 * Phase: N-3 — Notification Persistence + In-App Inbox
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
  getNotificationsForUser,
  getNotification,
} from '../helpers/db';
import { notifications } from '../../src/module/notification/domain/notification.schema';
import { user as userTable } from '../../src/module/auth/auth.schema';
import { OrderPlacedEvent } from '../../src/shared/events/order-placed.event';
import { PaymentConfirmedEvent } from '../../src/shared/events/payment-confirmed.event';
import { RestaurantUpdatedEvent } from '../../src/shared/events/restaurant-updated.event';

// ─── Suite-specific test emails ───────────────────────────────────────────────
// These are separate from TEST_OWNER_EMAIL / TEST_OTHER_EMAIL to avoid
// clashes when all suites run in the same process (maxWorkers: 1).

const NI_CUSTOMER_EMAIL = 'ni-customer@test.soli';
const NI_CUSTOMER2_EMAIL = 'ni-customer2@test.soli';
const NI_OWNER_EMAIL = 'ni-owner@test.soli';
const NI_ALL_EMAILS = [NI_CUSTOMER_EMAIL, NI_CUSTOMER2_EMAIL, NI_OWNER_EMAIL];

// ─── Timing helper ────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Auth helper ──────────────────────────────────────────────────────────────

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

// ─── Test fixture UUIDs ───────────────────────────────────────────────────────
// Stable fake UUIDs used in EventBus publish calls so we have predictable data.

const FAKE_ORDER_ID_1 = 'a1000000-0000-4000-8000-000000000001';
const FAKE_ORDER_ID_2 = 'a2000000-0000-4000-8000-000000000002';
const FAKE_ORDER_ID_3 = 'a3000000-0000-4000-8000-000000000003';

// ─── Main suite ───────────────────────────────────────────────────────────────

describe('Notification Inbox REST API (Phase N-3)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let eventBus: EventBus;

  // Primary test customer
  let customerToken: string;
  let customerId: string;

  // Secondary customer — for cross-user isolation tests
  let customer2Token: string;
  let customer2Id: string;

  // Restaurant owner (receives new_order_received notifications)
  let ownerToken: string;
  let ownerId: string;

  // ─── Global setup ──────────────────────────────────────────────────────────

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    eventBus = app.get(EventBus);

    // 1. Delete suite-specific users from any previous run (before resetDb
    //    which would delete the standard users)
    const db = getTestDb();
    await db.delete(notifications); // no FK deps — safe to delete first
    await db.delete(userTable).where(inArray(userTable.email, NI_ALL_EMAILS));

    // 2. Reset standard test data (orders, restaurants, standard test users)
    await resetDb();

    // 3. Bootstrap the standard TestAuthManager (needed by seedBaseRestaurant)
    const testAuth = new TestAuthManager();
    await testAuth.initialize(http);
    setAuthManager(testAuth);

    // 4. Sign up suite-specific users
    const ownerRes = await signUpUser(http, NI_OWNER_EMAIL, 'NI Owner');
    ownerToken = ownerRes.token;
    ownerId = ownerRes.userId;
    await db.update(userTable).set({ role: 'restaurant' }).where(eq(userTable.id, ownerId));

    const customerRes = await signUpUser(http, NI_CUSTOMER_EMAIL, 'NI Customer');
    customerToken = customerRes.token;
    customerId = customerRes.userId;
    // No role update → resolveRole() → 'customer'

    const customer2Res = await signUpUser(http, NI_CUSTOMER2_EMAIL, 'NI Customer 2');
    customer2Token = customer2Res.token;
    customer2Id = customer2Res.userId;
    // No role update → resolveRole() → 'customer'

    // 5. Seed the restaurant owned by our NI owner
    await seedBaseRestaurant(ownerId);

    // 6. Trigger the NotificationRestaurantSnapshotProjector so the notification
    //    ACL table has the restaurant → owner mapping needed by OrderPlacedNotificationHandler.
    //    We publish RestaurantUpdatedEvent directly (same as what the restaurant PATCH does).
    await eventBus.publish(
      new RestaurantUpdatedEvent(
        TEST_RESTAURANT_ID,
        'E2E Test Restaurant',
        true,
        true,
        '1 Test Street, Ho Chi Minh City',
        ownerId,
      ),
    );
    await delay(200);
  }, 60_000);

  afterAll(async () => {
    await teardownTestApp(app);
  });

  // ─── Helper: publish OrderPlacedEvent and wait for handler ────────────────

  async function publishOrderPlaced(
    orderId: string,
    options: { customerId?: string; restaurantId?: string } = {},
  ): Promise<void> {
    await eventBus.publish(
      new OrderPlacedEvent(
        orderId,
        options.customerId ?? customerId,
        options.restaurantId ?? TEST_RESTAURANT_ID,
        'E2E Test Restaurant',
        15000,
        0,
        'cod',
        [{ menuItemId: 'fake-item-id', name: 'Test Burger', quantity: 1, unitPrice: 15000 }],
        { street: '123 Test St', district: 'D1', city: 'HCM' },
        undefined,
        undefined,
      ),
    );
    await delay(200);
  }

  async function publishPaymentConfirmed(
    orderId: string,
    cid: string = customerId,
  ): Promise<void> {
    await eventBus.publish(
      new PaymentConfirmedEvent(orderId, cid, 'vnpay', 15000, new Date()),
    );
    await delay(200);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // §1  Empty inbox — before any notifications are generated
  // ──────────────────────────────────────────────────────────────────────────

  describe('§1 Empty inbox', () => {
    it('NI-01 GET /notifications/my returns 200 with empty items array', async () => {
      const res = await http
        .get('/api/notifications/my')
        .set(authHeader(customerToken));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        items: [],
        total: 0,
        unreadCount: 0,
        offset: 0,
        limit: 20,
        hasMore: false,
      });
    });

    it('NI-02 GET /notifications/my/unread-count returns 0', async () => {
      const res = await http
        .get('/api/notifications/my/unread-count')
        .set(authHeader(customerToken));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ count: 0 });
    });

    it('NI-03 PATCH /notifications/my/read-all returns count: 0 when nothing to read', async () => {
      const res = await http
        .patch('/api/notifications/my/read-all')
        .set(authHeader(customerToken));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ count: 0 });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §2  Notification generation via EventBus
  // ──────────────────────────────────────────────────────────────────────────

  describe('§2 Notification generation via EventBus', () => {
    beforeAll(async () => {
      // Publish an OrderPlacedEvent which generates:
      //  - 'order_placed' in_app + push for customer
      //  - 'new_order_received' in_app + push for restaurant owner
      await publishOrderPlaced(FAKE_ORDER_ID_1);
    });

    it('NI-04 customer inbox contains order_placed notification', async () => {
      const res = await http
        .get('/api/notifications/my')
        .set(authHeader(customerToken));

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);

      const placed = (res.body.items as Array<Record<string, unknown>>).find(
        (n) => n.type === 'order_placed',
      );
      expect(placed).toBeDefined();
      expect(placed).toMatchObject({
        type: 'order_placed',
        isRead: false,
      });
      // readAt is omitted from JSON when null — verify it's absent or falsy
      expect(placed!.readAt == null).toBe(true);
      expect(placed!.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(placed!.title).toBeTruthy();
      expect(placed!.body).toBeTruthy();
      expect(placed!.createdAt).toBeTruthy();
    });

    it('NI-05 owner inbox contains new_order_received notification', async () => {
      const res = await http
        .get('/api/notifications/my')
        .set(authHeader(ownerToken));

      expect(res.status).toBe(200);
      const owned = (res.body.items as Array<Record<string, unknown>>).find(
        (n) => n.type === 'new_order_received',
      );
      expect(owned).toBeDefined();
      expect(owned!.isRead).toBe(false);
    });

    it('NI-06 notification row exists in DB with correct shape', async () => {
      const rows = await getNotificationsForUser(customerId);
      const inAppRows = rows.filter((r) => r.channel === 'in_app');
      expect(inAppRows.length).toBeGreaterThanOrEqual(1);

      const placed = inAppRows.find((r) => r.type === 'order_placed');
      expect(placed).toBeDefined();
      expect(placed!.isRead).toBe(false);
      expect(placed!.recipientId).toBe(customerId);
      expect(placed!.channel).toBe('in_app');
    });

    it('NI-07 payment_confirmed notification appears in inbox', async () => {
      await publishPaymentConfirmed(FAKE_ORDER_ID_1);

      const res = await http
        .get('/api/notifications/my')
        .set(authHeader(customerToken));

      expect(res.status).toBe(200);
      const confirmed = (res.body.items as Array<Record<string, unknown>>).find(
        (n) => n.type === 'payment_confirmed',
      );
      expect(confirmed).toBeDefined();
      expect(confirmed!.isRead).toBe(false);
    });

    it('NI-08 inbox response shape has all required fields', async () => {
      const res = await http
        .get('/api/notifications/my')
        .set(authHeader(customerToken));

      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(typeof body.total).toBe('number');
      expect(typeof body.unreadCount).toBe('number');
      expect(typeof body.offset).toBe('number');
      expect(typeof body.limit).toBe('number');
      expect(typeof body.hasMore).toBe('boolean');
      expect(Array.isArray(body.items)).toBe(true);

      const item = (body.items as Array<Record<string, unknown>>)[0];
      expect(item).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        type: expect.any(String),
        title: expect.any(String),
        body: expect.any(String),
        isRead: expect.any(Boolean),
        createdAt: expect.any(String),
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §3  Unread count
  // ──────────────────────────────────────────────────────────────────────────

  describe('§3 Unread count (Redis-cached)', () => {
    it('NI-09 unread-count reflects the number of unread notifications', async () => {
      const inboxRes = await http
        .get('/api/notifications/my')
        .set(authHeader(customerToken));
      const expectedUnread = (inboxRes.body.items as Array<Record<string, unknown>>).filter(
        (n) => !n.isRead,
      ).length;

      const countRes = await http
        .get('/api/notifications/my/unread-count')
        .set(authHeader(customerToken));

      expect(countRes.status).toBe(200);
      expect(countRes.body.count).toBe(expectedUnread);
    });

    it('NI-10 unread-count is consistent with inbox unreadCount field', async () => {
      const [inboxRes, countRes] = await Promise.all([
        http.get('/api/notifications/my').set(authHeader(customerToken)),
        http.get('/api/notifications/my/unread-count').set(authHeader(customerToken)),
      ]);

      expect(inboxRes.body.unreadCount).toBe(countRes.body.count);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §4  Mark single notification as read
  // ──────────────────────────────────────────────────────────────────────────

  describe('§4 Mark single notification as read', () => {
    let notificationId: string;
    let unreadCountBefore: number;

    beforeAll(async () => {
      // Get first unread notification
      const res = await http
        .get('/api/notifications/my?unreadOnly=true')
        .set(authHeader(customerToken));
      const items = res.body.items as Array<Record<string, unknown>>;
      expect(items.length).toBeGreaterThan(0);
      notificationId = items[0].id as string;

      const countRes = await http
        .get('/api/notifications/my/unread-count')
        .set(authHeader(customerToken));
      unreadCountBefore = countRes.body.count as number;
    });

    it('NI-11 PATCH /:id/read returns { success: true }', async () => {
      const res = await http
        .patch(`/api/notifications/${notificationId}/read`)
        .set(authHeader(customerToken));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('NI-12 notification is_read = true in DB after mark-read', async () => {
      const row = await getNotification(notificationId);
      expect(row).not.toBeNull();
      expect(row!.isRead).toBe(true);
      expect(row!.readAt).not.toBeNull();
    });

    it('NI-13 unread-count decremented by 1 after mark-read', async () => {
      const res = await http
        .get('/api/notifications/my/unread-count')
        .set(authHeader(customerToken));
      expect(res.body.count).toBe(unreadCountBefore - 1);
    });

    it('NI-14 marked notification no longer appears in unreadOnly filter', async () => {
      const res = await http
        .get('/api/notifications/my?unreadOnly=true')
        .set(authHeader(customerToken));
      const ids = (res.body.items as Array<Record<string, unknown>>).map((n) => n.id);
      expect(ids).not.toContain(notificationId);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §5  Mark all as read
  // ──────────────────────────────────────────────────────────────────────────

  describe('§5 Mark all as read', () => {
    let unreadCountBefore: number;

    beforeAll(async () => {
      const res = await http
        .get('/api/notifications/my/unread-count')
        .set(authHeader(customerToken));
      unreadCountBefore = res.body.count as number;
    });

    it('NI-15 PATCH /my/read-all returns count of rows updated', async () => {
      const res = await http
        .patch('/api/notifications/my/read-all')
        .set(authHeader(customerToken));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ count: unreadCountBefore });
    });

    it('NI-16 unread-count is 0 after mark-all-read', async () => {
      const res = await http
        .get('/api/notifications/my/unread-count')
        .set(authHeader(customerToken));
      expect(res.body.count).toBe(0);
    });

    it('NI-17 inbox shows all notifications with isRead: true', async () => {
      const res = await http
        .get('/api/notifications/my')
        .set(authHeader(customerToken));
      const unreadItems = (res.body.items as Array<Record<string, unknown>>).filter(
        (n) => !n.isRead,
      );
      expect(unreadItems).toHaveLength(0);
    });

    it('NI-18 second call to read-all returns count: 0 (idempotent)', async () => {
      const res = await http
        .patch('/api/notifications/my/read-all')
        .set(authHeader(customerToken));
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §6  Pagination
  // ──────────────────────────────────────────────────────────────────────────

  describe('§6 Pagination', () => {
    beforeAll(async () => {
      // Generate enough notifications to test pagination
      // Publish 3 more order_placed events
      await publishOrderPlaced(FAKE_ORDER_ID_2);
      await publishOrderPlaced(FAKE_ORDER_ID_3);
    });

    it('NI-19 limit parameter controls page size', async () => {
      const res = await http
        .get('/api/notifications/my?limit=1')
        .set(authHeader(customerToken));

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.limit).toBe(1);
    });

    it('NI-20 offset parameter skips rows', async () => {
      const allRes = await http
        .get('/api/notifications/my?limit=10&offset=0')
        .set(authHeader(customerToken));
      const offsetRes = await http
        .get('/api/notifications/my?limit=10&offset=1')
        .set(authHeader(customerToken));

      expect(allRes.body.items.length).toBeGreaterThanOrEqual(1);

      if (allRes.body.total > 1) {
        // First item of offset page should differ from first item of page 0
        expect(offsetRes.body.items[0]?.id).not.toBe(allRes.body.items[0]?.id);
      }
    });

    it('NI-21 hasMore is true when more rows exist beyond current page', async () => {
      const total = (
        await http
          .get('/api/notifications/my')
          .set(authHeader(customerToken))
      ).body.total as number;

      if (total > 1) {
        const res = await http
          .get('/api/notifications/my?limit=1&offset=0')
          .set(authHeader(customerToken));
        expect(res.body.hasMore).toBe(true);
      }
    });

    it('NI-22 hasMore is false on last page', async () => {
      const total = (
        await http
          .get('/api/notifications/my')
          .set(authHeader(customerToken))
      ).body.total as number;

      const res = await http
        .get(`/api/notifications/my?limit=100&offset=${total}`)
        .set(authHeader(customerToken));
      expect(res.body.hasMore).toBe(false);
      expect(res.body.items).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §7  Filters
  // ──────────────────────────────────────────────────────────────────────────

  describe('§7 Filters', () => {
    it('NI-23 unreadOnly=true returns only unread notifications', async () => {
      const res = await http
        .get('/api/notifications/my?unreadOnly=true')
        .set(authHeader(customerToken));

      expect(res.status).toBe(200);
      for (const item of res.body.items as Array<Record<string, unknown>>) {
        expect(item.isRead).toBe(false);
      }
    });

    it('NI-24 type filter returns only notifications of that type', async () => {
      const res = await http
        .get('/api/notifications/my?type=order_placed')
        .set(authHeader(customerToken));

      expect(res.status).toBe(200);
      for (const item of res.body.items as Array<Record<string, unknown>>) {
        expect(item.type).toBe('order_placed');
      }
    });

    it('NI-25 type filter + unreadOnly combined works correctly', async () => {
      const res = await http
        .get('/api/notifications/my?type=order_placed&unreadOnly=true')
        .set(authHeader(customerToken));

      expect(res.status).toBe(200);
      for (const item of res.body.items as Array<Record<string, unknown>>) {
        expect(item.type).toBe('order_placed');
        expect(item.isRead).toBe(false);
      }
    });

    it('NI-26 type filter for non-existent type returns empty items', async () => {
      const res = await http
        .get('/api/notifications/my?type=system_announcement')
        .set(authHeader(customerToken));

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §8  Cross-user isolation
  // ──────────────────────────────────────────────────────────────────────────

  describe('§8 Cross-user isolation', () => {
    beforeAll(async () => {
      // Generate a notification for customer2 only
      await publishOrderPlaced(
        'b1000000-0000-4000-8000-000000000001',
        { customerId: customer2Id },
      );
    });

    it('NI-27 customer2 inbox does not contain customer1 notifications', async () => {
      const customer1Rows = await getNotificationsForUser(customerId);
      const customer1Ids = customer1Rows.map((r) => r.id);

      const res = await http
        .get('/api/notifications/my')
        .set(authHeader(customer2Token));

      expect(res.status).toBe(200);
      const customer2Ids = (res.body.items as Array<Record<string, unknown>>).map((n) => n.id);

      // No overlap between the two users' notifications
      const overlap = customer2Ids.filter((id) => customer1Ids.includes(id as string));
      expect(overlap).toHaveLength(0);
    });

    it('NI-28 customer1 inbox does not contain customer2 notifications', async () => {
      const customer2Rows = await getNotificationsForUser(customer2Id);
      const customer2Ids = customer2Rows.map((r) => r.id);

      const res = await http
        .get('/api/notifications/my')
        .set(authHeader(customerToken));

      expect(res.status).toBe(200);
      const customer1Ids = (res.body.items as Array<Record<string, unknown>>).map((n) => n.id);

      const overlap = customer1Ids.filter((id) => customer2Ids.includes(id as string));
      expect(overlap).toHaveLength(0);
    });

    it('NI-29 customer cannot mark another user\'s notification as read', async () => {
      // Get a notification belonging to customer2
      const customer2Rows = await getNotificationsForUser(customer2Id);
      const customer2NotifId = customer2Rows.find((r) => r.channel === 'in_app')?.id;

      if (!customer2NotifId) {
        // No in-app notification for customer2 yet — generate one
        await publishOrderPlaced(
          'b2000000-0000-4000-8000-000000000002',
          { customerId: customer2Id },
        );
        const updatedRows = await getNotificationsForUser(customer2Id);
        const freshId = updatedRows.find((r) => r.channel === 'in_app')?.id;
        if (!freshId) return; // Skip if still no row

        // customer1 tries to mark customer2's notification as read
        const res = await http
          .patch(`/api/notifications/${freshId}/read`)
          .set(authHeader(customerToken));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(false); // Ownership check fails silently
      } else {
        const res = await http
          .patch(`/api/notifications/${customer2NotifId}/read`)
          .set(authHeader(customerToken));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(false);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §9  Mark-read idempotency
  // ──────────────────────────────────────────────────────────────────────────

  describe('§9 Mark-read idempotency', () => {
    it('NI-30 marking an already-read notification returns success:true (not false)', async () => {
      // Get any notification from the inbox (they should all be read at this point)
      const inboxRes = await http
        .get('/api/notifications/my?limit=1')
        .set(authHeader(customerToken));
      const items = inboxRes.body.items as Array<Record<string, unknown>>;

      if (items.length === 0) {
        // Ensure we have at least one notification
        await publishOrderPlaced(
          'c1000000-0000-4000-8000-000000000001',
        );
        await http.patch('/api/notifications/my/read-all').set(authHeader(customerToken));
        return;
      }

      const id = items[0].id as string;

      // First call
      const res1 = await http
        .patch(`/api/notifications/${id}/read`)
        .set(authHeader(customerToken));
      expect(res1.status).toBe(200);

      // Second call (idempotent)
      const res2 = await http
        .patch(`/api/notifications/${id}/read`)
        .set(authHeader(customerToken));
      expect(res2.status).toBe(200);
      // When marking an already-read notification, the DB update finds the row
      // (WHERE recipient_id = userId, no restriction on is_read status),
      // so it still returns success:true
      expect(res2.body.success).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §10  Authentication guard
  // ──────────────────────────────────────────────────────────────────────────

  describe('§10 Authentication guard', () => {
    it('NI-31 GET /notifications/my without token returns 401', async () => {
      const res = await http.get('/api/notifications/my');
      expect(res.status).toBe(401);
    });

    it('NI-32 GET /notifications/my/unread-count without token returns 401', async () => {
      const res = await http.get('/api/notifications/my/unread-count');
      expect(res.status).toBe(401);
    });

    it('NI-33 PATCH /notifications/my/read-all without token returns 401', async () => {
      const res = await http.patch('/api/notifications/my/read-all');
      expect(res.status).toBe(401);
    });

    it('NI-34 PATCH /notifications/:id/read without token returns 401', async () => {
      const res = await http.patch(
        '/api/notifications/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/read',
      );
      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // §11  Input validation
  // ──────────────────────────────────────────────────────────────────────────

  describe('§11 Input validation', () => {
    it('NI-35 PATCH /:id/read with non-UUID id returns 400', async () => {
      const res = await http
        .patch('/api/notifications/not-a-uuid/read')
        .set(authHeader(customerToken));
      expect(res.status).toBe(400);
    });

    it('NI-36 GET /my with limit=0 uses default or returns 400', async () => {
      const res = await http
        .get('/api/notifications/my?limit=0')
        .set(authHeader(customerToken));
      // limit has @Min(1) — should return 400 for invalid value
      expect([400, 422]).toContain(res.status);
    });

    it('NI-37 GET /my with limit=101 returns 400 (exceeds max)', async () => {
      const res = await http
        .get('/api/notifications/my?limit=101')
        .set(authHeader(customerToken));
      expect([400, 422]).toContain(res.status);
    });

    it('NI-38 PATCH /:id/read with valid UUID that does not exist returns success:false', async () => {
      const res = await http
        .patch('/api/notifications/ffffffff-ffff-4fff-8fff-ffffffffffff/read')
        .set(authHeader(customerToken));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
    });

    it('NI-39 GET /my with invalid type enum value returns 400', async () => {
      const res = await http
        .get('/api/notifications/my?type=not_a_real_type')
        .set(authHeader(customerToken));
      expect([400, 422]).toContain(res.status);
    });
  });
});
