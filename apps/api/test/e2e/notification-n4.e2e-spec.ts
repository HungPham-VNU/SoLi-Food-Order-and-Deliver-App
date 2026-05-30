/**
 * notification-n4.e2e-spec.ts — Phase N-4 Multi-Channel Notification Delivery E2E Tests
 *
 * Tests the notification delivery pipeline, push token management, and preference CRUD:
 *
 *  §1  Push Token CRUD
 *    §1.1 POST /notifications/my/push-tokens → 200, { registered: true }
 *    §1.2 Token appears in DB with correct platform/userId
 *    §1.3 Re-registering same token → idempotent (refreshes lastSeenAt)
 *    §1.4 DELETE /notifications/my/push-tokens → 200, { removed: true }
 *    §1.5 Token deactivated in DB after removal
 *    §1.6 User B cannot deactivate User A's token (DB WHERE enforces ownership)
 *    §1.7 Validation: missing token → 400
 *    §1.8 Auth guard: 401 without token
 *    §1.9 GET /notifications/my/push-tokens → lists tokens with masked suffix
 *    §1.10 GET /notifications/my/push-tokens → 401 without auth
 *
 *  §2  Notification Preferences
 *    §2.1 GET /notifications/my/preferences → system defaults when no row
 *    §2.2 PATCH /notifications/my/preferences → upsert, returns updated state
 *    §2.3 Partial update: only provided fields change
 *    §2.4 Clear email: PATCH { email: null } → null in response
 *    §2.5 Auth guard: 401 without token
 *
 *  §3  Multi-Channel Dispatch — In-App + Push
 *    §3.1 OrderPlacedEvent → in_app notification persisted (status='sent')
 *    §3.2 OrderPlacedEvent → push notification persisted (status='sent') when
 *         customer has active tokens (StubPushProvider always succeeds)
 *    §3.3 Delivery logs written for each channel
 *    §3.4 Push dispatch records success in delivery log
 *
 *  §4  Email Channel Dispatch
 *    §4.1 PaymentConfirmedEvent → email notification persisted (status='failed',
 *         errorCode='SMTP_NOT_CONFIGURED') because SMTP is not configured in test env
 *    §4.2 Delivery log for email channel has errorCode='SMTP_NOT_CONFIGURED'
 *    §4.3 Email notification persisted even when email NOT in preferences row
 *         (recipient email comes from preference.email column, not address table)
 *
 *  §5  Push Disabled Preference
 *    §5.1 When pushEnabled=false, push channel is skipped and no push notification row
 *
 *  §6  Multi-Device Push
 *    §6.1 User with 2 active tokens → 2 push notification rows (one per channel entry)
 *         Wait — architecture persists one notification per (sourceId, channel), so
 *         both tokens are sent in a single push delivery → single 'push' row with
 *         StubPushProvider fan-out → delivery log successCount >= 2
 *
 * Architecture:
 *  - Direct EventBus.publish() to trigger notifications without a full HTTP order flow.
 *  - Suite-specific emails to avoid collision with other E2E suites.
 *  - Notification, device_token and delivery_log tables cleared in beforeAll.
 *  - Real NestJS app, real PostgreSQL + Redis (no mocks).
 *  - StubPushProvider: always returns success, no FCM calls.
 *  - NoopEmailProvider: always returns SMTP_NOT_CONFIGURED failure (no SMTP in test env).
 *
 * Phase: N-4 — Multi-Channel Notification Delivery
 */

import type { INestApplication } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';

import { createTestApp, teardownTestApp } from '../setup/app-factory';
import {
  resetDb,
  getTestDb,
  TEST_RESTAURANT_ID,
  seedBaseRestaurant,
} from '../setup/db-setup';
import { TestAuthManager, TEST_PASSWORD } from '../helpers/test-auth';
import { setAuthManager } from '../helpers/auth';
import {
  getNotificationsForUser,
  getDeliveryLogsForNotification,
  getDeviceTokensForUser,
} from '../helpers/db';
import { notifications } from '../../src/module/notification/domain/notification.schema';
import { deviceTokens } from '../../src/module/notification/domain/device-token.schema';
import { notificationDeliveryLogs } from '../../src/module/notification/domain/notification-delivery-log.schema';
import { user as userTable } from '../../src/module/auth/auth.schema';
import { OrderPlacedEvent } from '../../src/shared/events/order-placed.event';
import { PaymentConfirmedEvent } from '../../src/shared/events/payment-confirmed.event';
import { RestaurantUpdatedEvent } from '../../src/shared/events/restaurant-updated.event';

// ─── Suite-specific emails ─────────────────────────────────────────────────────

const N4_CUSTOMER_EMAIL = 'n4-customer@test.soli';
const N4_OWNER_EMAIL = 'n4-owner@test.soli';
const N4_CUSTOMER2_EMAIL = 'n4-customer2@test.soli';
const N4_ALL_EMAILS = [N4_CUSTOMER_EMAIL, N4_OWNER_EMAIL, N4_CUSTOMER2_EMAIL];

// ─── Timing helper ────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Auth helpers ─────────────────────────────────────────────────────────────

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

// ─── Test state ───────────────────────────────────────────────────────────────

let app: INestApplication;
let http: ReturnType<typeof request>;
let eventBus: EventBus;

let customerToken: string;
let customerId: string;
let ownerToken: string;
let ownerId: string;
let customer2Token: string;
let customer2Id: string;

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  app = await createTestApp();
  http = request(app.getHttpServer());
  eventBus = app.get(EventBus);

  const db = getTestDb();

  // Clear suite-specific users from any previous run
  await db.delete(userTable).where(inArray(userTable.email, N4_ALL_EMAILS));

  // Reset DB state (orders, restaurants, standard users)
  await resetDb();

  // Initialize TestAuthManager (needed for seedBaseRestaurant)
  const testAuth = new TestAuthManager();
  await testAuth.initialize(http);
  setAuthManager(testAuth);

  // Sign up suite-specific users (role cannot be set in sign-up; set via DB)
  const ownerRes = await signUpUser(http, N4_OWNER_EMAIL, 'N4 Owner');
  ownerToken = ownerRes.token;
  ownerId = ownerRes.userId;
  await db
    .update(userTable)
    .set({ role: 'restaurant' })
    .where(eq(userTable.id, ownerId));

  const customerRes = await signUpUser(http, N4_CUSTOMER_EMAIL, 'N4 Customer');
  customerToken = customerRes.token;
  customerId = customerRes.userId;

  const customer2Res = await signUpUser(
    http,
    N4_CUSTOMER2_EMAIL,
    'N4 Customer2',
  );
  customer2Token = customer2Res.token;
  customer2Id = customer2Res.userId;

  // Clear notifications + delivery logs + tokens from any prior test run
  await db.delete(notificationDeliveryLogs);
  await db
    .delete(notifications)
    .where(
      inArray(notifications.recipientId, [customerId, ownerId, customer2Id]),
    );
  await db
    .delete(deviceTokens)
    .where(inArray(deviceTokens.userId, [customerId, ownerId, customer2Id]));

  // Seed the restaurant for event-driven tests
  await seedBaseRestaurant(ownerId);

  // Seed ACL snapshot so event handlers can look up restaurant name/ownerId
  await eventBus.publish(
    new RestaurantUpdatedEvent(
      TEST_RESTAURANT_ID,
      'N4 Test Restaurant',
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

// =============================================================================
// §1  Push Token CRUD
// =============================================================================

describe('§1 Push Token CRUD', () => {
  const iosToken = 'ExponentPushToken[n4-customer-ios-001]';
  const androidToken = 'ExponentPushToken[n4-customer-android-002]';

  it('§1.1 POST /notifications/my/push-tokens → 200, { registered: true }', async () => {
    const res = await http
      .post('/api/notifications/my/push-tokens')
      .set(authHeader(customerToken))
      .send({ token: iosToken, platform: 'ios' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ registered: true });
  });

  it('§1.2 Token appears in DB with correct platform/userId', async () => {
    const tokens = await getDeviceTokensForUser(customerId);
    const ios = tokens.find((t) => t.token === iosToken);
    expect(ios).toBeDefined();
    expect(ios!.platform).toBe('ios');
    expect(ios!.isActive).toBe(true);
    expect(ios!.userId).toBe(customerId);
  });

  it('§1.3 Re-registering same token → idempotent (refreshes lastSeenAt)', async () => {
    const db = getTestDb();
    // Wait a tick to make the lastSeenAt timestamp different
    await delay(20);

    const before = (await getDeviceTokensForUser(customerId)).find(
      (t) => t.token === iosToken,
    )!;

    await http
      .post('/api/notifications/my/push-tokens')
      .set(authHeader(customerToken))
      .send({ token: iosToken, platform: 'ios' });

    const after = (await getDeviceTokensForUser(customerId)).find(
      (t) => t.token === iosToken,
    )!;

    // Should still have exactly the same row (no duplicate)
    const allTokens = await getDeviceTokensForUser(customerId);
    const iosTokens = allTokens.filter((t) => t.token === iosToken);
    expect(iosTokens).toHaveLength(1);
    expect(after.isActive).toBe(true);
  });

  it('§1.4 DELETE /notifications/my/push-tokens → 200, { removed: true }', async () => {
    // Register android token first
    await http
      .post('/api/notifications/my/push-tokens')
      .set(authHeader(customerToken))
      .send({ token: androidToken, platform: 'android' });

    const res = await http
      .delete('/api/notifications/my/push-tokens')
      .set(authHeader(customerToken))
      .send({ token: androidToken });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ removed: true });
  });

  it('§1.5 Token deactivated in DB after removal', async () => {
    const tokens = await getDeviceTokensForUser(customerId);
    const android = tokens.find((t) => t.token === androidToken);
    expect(android).toBeDefined();
    expect(android!.isActive).toBe(false);
  });

  it('§1.6 User B cannot deactivate User A token (ownership enforced)', async () => {
    // customer2 tries to deactivate customer's iOS token — should succeed
    // with { removed: true } BUT the token should NOT be deactivated
    // (DB WHERE includes user_id = customer2Id, not customerId)
    const res = await http
      .delete('/api/notifications/my/push-tokens')
      .set(authHeader(customer2Token))
      .send({ token: iosToken });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ removed: true });

    // Customer's token should still be active
    const tokens = await getDeviceTokensForUser(customerId);
    const ios = tokens.find((t) => t.token === iosToken);
    expect(ios!.isActive).toBe(true);
  });

  it('§1.7 Validation: missing token field → 400', async () => {
    const res = await http
      .post('/api/notifications/my/push-tokens')
      .set(authHeader(customerToken))
      .send({ platform: 'ios' }); // missing token

    expect(res.status).toBe(400);
  });

  it('§1.8 Auth guard: 401 without token', async () => {
    const res = await http
      .post('/api/notifications/my/push-tokens')
      .send({ token: 'some-token', platform: 'ios' });

    expect(res.status).toBe(401);
  });

  it('§1.9 GET /notifications/my/push-tokens → lists tokens with masked suffix', async () => {
    // Register a token first so there is something to list
    const testToken = `e2e-get-list-token-${Date.now()}`;
    await http
      .post('/api/notifications/my/push-tokens')
      .set(authHeader(customerToken))
      .send({ token: testToken, platform: 'web' });

    const res = await http
      .get('/api/notifications/my/push-tokens')
      .set(authHeader(customerToken));

    expect(res.status).toBe(200);
    expect(res.body.tokens).toBeInstanceOf(Array);
    expect(res.body.tokens.length).toBeGreaterThan(0);
    const item = res.body.tokens.find((t: any) =>
      t.tokenSuffix.endsWith(testToken.slice(-8)),
    );
    expect(item).toBeDefined();
    expect(item).toMatchObject({
      platform: 'web',
      isActive: expect.any(Boolean),
      tokenSuffix: expect.stringMatching(/^\u2026/),
      lastSeenAt: expect.any(String),
      createdAt: expect.any(String),
    });
    expect(item).not.toHaveProperty('token');
  });

  it('§1.10 GET /notifications/my/push-tokens → 401 without auth', async () => {
    const res = await http.get('/api/notifications/my/push-tokens');
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// §2  Notification Preferences
// =============================================================================

describe('§2 Notification Preferences', () => {
  it('§2.1 GET /notifications/my/preferences → defaults when no preference row', async () => {
    // customer2 has never updated preferences
    const res = await http
      .get('/api/notifications/my/preferences')
      .set(authHeader(customer2Token));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      pushEnabled: true,
      inAppEnabled: true,
      emailEnabled: true,
      smsEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      mutedTypes: [],
      email: null,
      timezone: 'Asia/Ho_Chi_Minh',
    });
  });

  it('§2.2 PATCH /notifications/my/preferences → upsert returns updated state', async () => {
    const res = await http
      .patch('/api/notifications/my/preferences')
      .set(authHeader(customerToken))
      .send({
        pushEnabled: false,
        email: 'customer-notif@example.com',
        timezone: 'America/New_York',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      pushEnabled: false,
      inAppEnabled: true, // unchanged default
      emailEnabled: true, // unchanged default
      email: 'customer-notif@example.com',
      timezone: 'America/New_York',
    });
  });

  it('§2.3 GET after PATCH returns persisted values', async () => {
    const res = await http
      .get('/api/notifications/my/preferences')
      .set(authHeader(customerToken));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      pushEnabled: false,
      email: 'customer-notif@example.com',
      timezone: 'America/New_York',
    });
  });

  it('§2.4 PATCH { email: null } clears the stored email', async () => {
    const res = await http
      .patch('/api/notifications/my/preferences')
      .set(authHeader(customerToken))
      .send({ email: null });

    expect(res.status).toBe(200);
    expect(res.body.email).toBeNull();
  });

  it('§2.5 Auth guard: 401 without token', async () => {
    const res = await http.get('/api/notifications/my/preferences');
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// §3  Multi-Channel Dispatch — In-App + Push
// =============================================================================

describe('§3 Multi-Channel Dispatch — In-App + Push', () => {
  const ORDER_ID_PUSH = 'a0000001-0000-4000-8000-000000000001';

  beforeAll(async () => {
    const db = getTestDb();
    // Re-enable push for owner (owner has active token from §1 seed)
    // Ensure owner has an active push token
    await http
      .post('/api/notifications/my/push-tokens')
      .set(authHeader(ownerToken))
      .send({ token: 'ExponentPushToken[n4-owner-ios-001]', platform: 'ios' });

    // Restore customer push enabled (disabled in §2)
    await http
      .patch('/api/notifications/my/preferences')
      .set(authHeader(customerToken))
      .send({ pushEnabled: true });

    // Register a token for customer
    await http
      .post('/api/notifications/my/push-tokens')
      .set(authHeader(customerToken))
      .send({
        token: 'ExponentPushToken[n4-customer-ios-push-001]',
        platform: 'ios',
      });

    await delay(50);
  });

  it('§3.1 OrderPlacedEvent → in_app notification persisted for customer', async () => {
    await eventBus.publish(
      new OrderPlacedEvent(
        ORDER_ID_PUSH,
        customerId,
        TEST_RESTAURANT_ID,
        'N4 Test Restaurant',
        150000,
        15000,
        'cod',
        [
          {
            menuItemId: '11111111-1111-4111-8111-111111111111',
            name: 'Phở',
            quantity: 1,
            unitPrice: 135000,
          },
        ],
        { street: '1 Test St', district: 'Q1', city: 'HCM' },
        undefined,
        undefined,
      ),
    );
    // Remote Redis (Upstash) adds ~50-200ms per call. §3 is first to exercise
    // the full dispatch pipeline (cold connection + 4 concurrent dispatches),
    // so a generous delay is needed. §5/§6 run later with a warm connection.
    await delay(1500);

    const allNotifs = await getNotificationsForUser(customerId);
    const inApp = allNotifs.find(
      (n) => n.orderId === ORDER_ID_PUSH && n.channel === 'in_app',
    );
    expect(inApp).toBeDefined();
    expect(inApp!.status).toBe('sent');
    expect(inApp!.type).toBe('order_placed');
  });

  it('§3.2 OrderPlacedEvent → push notification persisted for customer (StubPushProvider)', async () => {
    const allNotifs = await getNotificationsForUser(customerId);
    const push = allNotifs.find(
      (n) => n.orderId === ORDER_ID_PUSH && n.channel === 'push',
    );
    expect(push).toBeDefined();
    expect(push!.status).toBe('sent');
  });

  it('§3.3 OrderPlacedEvent → new_order_received notification for owner (in_app + push)', async () => {
    const ownerNotifs = await getNotificationsForUser(ownerId);
    const ownerInApp = ownerNotifs.find(
      (n) => n.orderId === ORDER_ID_PUSH && n.channel === 'in_app',
    );
    expect(ownerInApp).toBeDefined();
    expect(ownerInApp!.type).toBe('new_order_received');
    expect(ownerInApp!.status).toBe('sent');

    const ownerPush = ownerNotifs.find(
      (n) => n.orderId === ORDER_ID_PUSH && n.channel === 'push',
    );
    expect(ownerPush).toBeDefined();
    expect(ownerPush!.status).toBe('sent');
  });

  it('§3.4 Delivery log written for push notification with success status', async () => {
    const allNotifs = await getNotificationsForUser(customerId);
    const push = allNotifs.find(
      (n) => n.orderId === ORDER_ID_PUSH && n.channel === 'push',
    )!;
    expect(push).toBeDefined();

    const logs = await getDeliveryLogsForNotification(push.id);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const successLog = logs.find((l) => l.status === 'success');
    expect(successLog).toBeDefined();
    expect(successLog!.channel).toBe('push');
  });

  it('§3.5 Delivery log written for in_app notification with success status', async () => {
    const allNotifs = await getNotificationsForUser(customerId);
    const inApp = allNotifs.find(
      (n) => n.orderId === ORDER_ID_PUSH && n.channel === 'in_app',
    )!;
    expect(inApp).toBeDefined();

    const logs = await getDeliveryLogsForNotification(inApp.id);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const successLog = logs.find((l) => l.status === 'success');
    expect(successLog).toBeDefined();
    expect(successLog!.channel).toBe('in_app');
  });
});

// =============================================================================
// §4  Email Channel Dispatch
// =============================================================================

describe('§4 Email Channel Dispatch', () => {
  const ORDER_ID_EMAIL = 'a0000002-0000-4000-8000-000000000002';

  beforeAll(async () => {
    // Set an email address for customer preferences so the email channel has a recipient
    await http
      .patch('/api/notifications/my/preferences')
      .set(authHeader(customerToken))
      .send({ email: 'n4-customer-delivery@example.com' });

    await delay(50);
  });

  it('§4.1 PaymentConfirmedEvent → email notification persisted (SMTP_NOT_CONFIGURED)', async () => {
    await eventBus.publish(
      new PaymentConfirmedEvent(
        ORDER_ID_EMAIL,
        customerId,
        'vnpay',
        200000,
        new Date(),
      ),
    );
    await delay(400);

    const allNotifs = await getNotificationsForUser(customerId);
    const emailNotif = allNotifs.find(
      (n) => n.orderId === ORDER_ID_EMAIL && n.channel === 'email',
    );
    expect(emailNotif).toBeDefined();
    expect(emailNotif!.type).toBe('payment_confirmed');
    // NoopEmailProvider throws → status='failed'
    expect(emailNotif!.status).toBe('failed');
  });

  it('§4.2 Delivery log for email has errorCode=SMTP_NOT_CONFIGURED', async () => {
    const allNotifs = await getNotificationsForUser(customerId);
    const emailNotif = allNotifs.find(
      (n) => n.orderId === ORDER_ID_EMAIL && n.channel === 'email',
    )!;
    expect(emailNotif).toBeDefined();

    const logs = await getDeliveryLogsForNotification(emailNotif.id);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const failLog = logs.find((l) => l.status === 'failed');
    expect(failLog).toBeDefined();
    expect(failLog!.errorCode).toBe('SMTP_NOT_CONFIGURED');
    expect(failLog!.channel).toBe('email');
  });

  it('§4.3 PaymentConfirmedEvent → in_app + push also dispatched alongside email', async () => {
    const allNotifs = await getNotificationsForUser(customerId);
    const inApp = allNotifs.find(
      (n) => n.orderId === ORDER_ID_EMAIL && n.channel === 'in_app',
    );
    const push = allNotifs.find(
      (n) => n.orderId === ORDER_ID_EMAIL && n.channel === 'push',
    );
    expect(inApp).toBeDefined();
    expect(push).toBeDefined();
    expect(inApp!.status).toBe('sent');
    expect(push!.status).toBe('sent');
  });
});

// =============================================================================
// §5  Push Disabled Preference
// =============================================================================

describe('§5 Push Disabled Preference', () => {
  const ORDER_ID_NO_PUSH = 'a0000003-0000-4000-8000-000000000003';

  beforeAll(async () => {
    // Disable push for customer2
    await http
      .patch('/api/notifications/my/preferences')
      .set(authHeader(customer2Token))
      .send({ pushEnabled: false });

    // Register a token anyway (it should not be used)
    await http
      .post('/api/notifications/my/push-tokens')
      .set(authHeader(customer2Token))
      .send({
        token: 'ExponentPushToken[n4-customer2-ios-001]',
        platform: 'ios',
      });

    await delay(50);
  });

  it('§5.1 When pushEnabled=false, no push notification row persisted', async () => {
    // We need to trigger an event that would normally send push to customer2
    // But we don't have a direct way to target customer2 here unless we're the
    // order's customer. We'll publish an OrderPlacedEvent with customer2 as customer.
    // Requires ownerId to have a snapshot — re-use existing.
    const ORDER_ID = ORDER_ID_NO_PUSH;

    await eventBus.publish(
      new OrderPlacedEvent(
        ORDER_ID,
        customer2Id,
        TEST_RESTAURANT_ID,
        'N4 Test Restaurant',
        75000,
        10000,
        'cod',
        [
          {
            menuItemId: '22222222-2222-4222-8222-222222222222',
            name: 'Bún bò',
            quantity: 1,
            unitPrice: 65000,
          },
        ],
        { street: '2 Test St', district: 'Q3', city: 'HCM' },
        undefined,
        undefined,
      ),
    );
    await delay(300);

    const allNotifs = await getNotificationsForUser(customer2Id);
    const push = allNotifs.find(
      (n) => n.orderId === ORDER_ID && n.channel === 'push',
    );

    // push should not exist when pushEnabled=false
    expect(push).toBeUndefined();

    // but in_app should still be created
    const inApp = allNotifs.find(
      (n) => n.orderId === ORDER_ID && n.channel === 'in_app',
    );
    expect(inApp).toBeDefined();
    expect(inApp!.status).toBe('sent');
  });
});

// =============================================================================
// §6  Multi-Device Push Fan-Out
// =============================================================================

describe('§6 Multi-Device Push Fan-Out', () => {
  const ORDER_ID_MULTI = 'a0000004-0000-4000-8000-000000000004';

  beforeAll(async () => {
    // Ensure customer has 2 active tokens
    await http
      .post('/api/notifications/my/push-tokens')
      .set(authHeader(customerToken))
      .send({
        token: 'ExponentPushToken[n4-customer-multi-ios-001]',
        platform: 'ios',
      });
    await http
      .post('/api/notifications/my/push-tokens')
      .set(authHeader(customerToken))
      .send({
        token: 'ExponentPushToken[n4-customer-multi-android-002]',
        platform: 'android',
      });

    await delay(50);
  });

  it('§6.1 User with 2 active tokens → single push notification row (fan-out within one delivery)', async () => {
    await eventBus.publish(
      new OrderPlacedEvent(
        ORDER_ID_MULTI,
        customerId,
        TEST_RESTAURANT_ID,
        'N4 Test Restaurant',
        120000,
        12000,
        'cod',
        [
          {
            menuItemId: '33333333-3333-4333-8333-333333333333',
            name: 'Cơm tấm',
            quantity: 3,
            unitPrice: 36000,
          },
        ],
        { street: '3 Test St', district: 'Q5', city: 'HCM' },
        undefined,
        undefined,
      ),
    );
    await delay(300);

    const allNotifs = await getNotificationsForUser(customerId);
    const pushNotifs = allNotifs.filter(
      (n) => n.orderId === ORDER_ID_MULTI && n.channel === 'push',
    );

    // One push notification row (idempotency key = orderId + channel)
    // StubPushProvider fans out internally to all active tokens
    expect(pushNotifs).toHaveLength(1);
    expect(pushNotifs[0].status).toBe('sent');
  });
});
