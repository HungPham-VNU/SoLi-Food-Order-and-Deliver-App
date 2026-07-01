/**
 * UITFood — Realistic Customer Load Test
 *
 * Simulates a real customer journey end-to-end:
 *   1. Sign in (Better Auth email/password → bearer token)
 *   2. Browse restaurants
 *   3. Browse menu items for a restaurant + view item detail
 *   4. Clear any stale cart, then add a menu item
 *   5. Optionally update item quantity (30 % of users)
 *   6. View cart
 *   7. Checkout (COD — synchronous, no VNPay redirect needed)
 *   8. Track order via the customer order-detail endpoint
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Prerequisites
 * ─────────────────────────────────────────────────────────────────────────────
 * The API must have at least ONE restaurant that satisfies all three conditions:
 *   • isApproved = true
 *   • isOpen     = true
 *   • has at least one non-sold-out menu item
 *   • has a delivery zone that covers Ho Chi Minh City (lat 10.7769, lon 106.7009)
 *
 * If no eligible restaurant is found the Sign-in + Browse steps still run but
 * the cart / checkout / order-tracking steps are skipped with a console warning.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Quick start
 * ─────────────────────────────────────────────────────────────────────────────
 *   # Install k6: https://grafana.com/docs/k6/latest/get-started/installation/
 *
 *   # Smoke test (1 VU, 1 min) — default
 *   k6 run tools/k6/realistic-user.js
 *
 *   # Load test (ramp to 20 VUs)
 *   k6 run -e SCENARIO=load tools/k6/realistic-user.js
 *
 *   # Stress test (ramp to 80 VUs)
 *   k6 run -e SCENARIO=stress tools/k6/realistic-user.js
 *
 *   # Soak test (15 VUs × 30 min)
 *   k6 run -e SCENARIO=soak tools/k6/realistic-user.js
 *
 *   # Point at a different host
 *   k6 run -e BASE_URL=https://api.uitfood.io tools/k6/realistic-user.js
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Environment variables
 * ─────────────────────────────────────────────────────────────────────────────
 *   BASE_URL    API base URL (default: http://localhost:3000)
 *   SCENARIO    smoke | load | stress | soak  (default: smoke)
 *   SEED_USERS  Number of test accounts to register in setup() (default: 100).
 *               Should be ≥ the peak VU count of the chosen scenario.
 *   USER_PASS   Password shared across all seeded test accounts (default: K6Test@1234)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Cleanup
 * ─────────────────────────────────────────────────────────────────────────────
 * Test orders and users persist in the DB after the run. To remove test orders:
 *   DELETE FROM "order" WHERE note = 'k6 load test — please ignore';
 */

import http from 'k6/http';
import { check, group, sleep, fail } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL   = (__ENV.BASE_URL   || 'http://localhost:3000').replace(/\/$/, '');
const SCENARIO   = __ENV.SCENARIO    || 'smoke';
const SEED_USERS = parseInt(__ENV.SEED_USERS || '100', 10);
const USER_PASS  = __ENV.USER_PASS   || 'K6Test@1234';

// Delivery address used at checkout — must be within range of the test restaurant.
const DELIVERY_ADDRESS = {
  street:    '123 Nguyen Hue Blvd',
  district:  'District 1',
  city:      'Ho Chi Minh City',
  latitude:  10.8928,
  longitude: 106.7915,
};

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const SCENARIOS = {
  /** Verify the script works and the happy path returns 2xx. */
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '1m',
  },
  /** Normal expected traffic — ramp up, hold, ramp down. */
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 20 },
      { duration: '5m', target: 20 },
      { duration: '2m', target: 0 },
    ],
  },
  /** Push beyond normal capacity to find performance limits. */
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 20 },
      { duration: '3m', target: 50 },
      { duration: '3m', target: 80 },
      { duration: '2m', target: 0 },
    ],
  },
  /** Extended run to surface memory leaks and connection pool exhaustion. */
  soak: {
    executor: 'constant-vus',
    vus: 15,
    duration: '30m',
  },
};

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

/** Total orders successfully placed. */
const ordersPlaced     = new Counter('orders_placed_total');
/** Rate of checkout failures (network errors, 4xx/5xx). */
const checkoutFailRate = new Rate('checkout_fail_rate');
/** Rate of sign-in failures. */
const authFailRate     = new Rate('auth_fail_rate');
/** End-to-end duration from POST /checkout to receiving the response. */
const orderE2eDuration = new Trend('order_e2e_duration_ms', true);

// ---------------------------------------------------------------------------
// Options & thresholds
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    [SCENARIO]: SCENARIOS[SCENARIO] || SCENARIOS.smoke,
  },
  thresholds: {
    // Global
    http_req_duration: ['p(95)<1000'],
    http_req_failed:   ['rate<0.02'],

    // Per-endpoint (tagged with `name`)
    'http_req_duration{name:GET /restaurants}':   ['p(95)<500'],
    'http_req_duration{name:GET /menu-items}':    ['p(95)<500'],
    'http_req_duration{name:GET /menu-items/:id}':['p(95)<500'],
    'http_req_duration{name:GET /carts/my}':      ['p(95)<300'],
    'http_req_duration{name:POST /checkout}':     ['p(95)<2000'],

    // Business KPIs
    checkout_fail_rate: ['rate<0.05'],
    auth_fail_rate:     ['rate<0.05'],
  },
};

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function apiUrl(path) {
  return `${BASE_URL}${path}`;
}

/** Parse response body as JSON; returns null on any error. */
function parseBody(res) {
  try { return JSON.parse(res.body); } catch { return null; }
}

/**
 * Minimal UUID v4 generator — avoids external jslib dependency.
 * Output is 36-char hex+hyphen string accepted by the idempotency key validator.
 */
function uuidv4() {
  const h = '0123456789abcdef';
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return h[c === 'x' ? r : (r & 0x3) | 0x8];
  });
}

/** Uniform random integer in [min, max] inclusive. */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Register a user. 200 = success; 422/409 = already exists (idempotent).
 * Returns the bearer token when the server returns one, otherwise null.
 */
function signUp(email, password, name) {
  const res = http.post(
    apiUrl('/api/auth/sign-up/email'),
    JSON.stringify({ email, password, name }),
    { headers: JSON_HEADERS },
  );
  if (res.status !== 200) return null;
  return parseBody(res)?.token ?? null;
}

/**
 * Sign in with email + password.
 * Returns the bearer token string, or null on failure.
 */
function signIn(email, password) {
  const res = http.post(
    apiUrl('/api/auth/sign-in/email'),
    JSON.stringify({ email, password }),
    { headers: JSON_HEADERS },
  );
  if (res.status !== 200) return null;
  return parseBody(res)?.token ?? null;
}

// ---------------------------------------------------------------------------
// Setup — runs once before all VUs start
// ---------------------------------------------------------------------------

export function setup() {
  // ── Seed test users ─────────────────────────────────────────────────────
  console.log(`[setup] Registering ${SEED_USERS} test users (skips existing)…`);
  const users = [];
  for (let i = 0; i < SEED_USERS; i++) {
    const email = `k6test+${i}@uitfood.test`;
    signUp(email, USER_PASS, `K6 Tester ${i}`);
    users.push({ email, password: USER_PASS });
  }

  // ── Discover eligible restaurants ───────────────────────────────────────
  console.log('[setup] Discovering eligible restaurants…');
  const restaurantRes = http.get(apiUrl('/api/restaurants?limit=20'), {
    headers: JSON_HEADERS,
  });

  let allRestaurants = [];
  if (restaurantRes.status === 200) {
    // Response shape: { data: RestaurantResponseDto[], total: number }
    allRestaurants = parseBody(restaurantRes)?.data ?? [];
  }

  // Only keep restaurants that are open AND approved (checkout will reject others).
  const eligible = allRestaurants.filter((r) => r.isOpen && r.isApproved);

  // ── Discover menu items per eligible restaurant ──────────────────────────
  const menuByRestaurant = {};
  for (const r of eligible.slice(0, 5)) {
    const menuRes = http.get(
      apiUrl(`/api/menu-items?restaurantId=${r.id}&limit=20`),
      { headers: JSON_HEADERS },
    );
    if (menuRes.status !== 200) continue;

    const body = parseBody(menuRes);
    // Response shape: array OR { data: [...] }
    const items = Array.isArray(body) ? body : (body?.data ?? []);
    const available = items.filter(
      (item) => item.status !== 'sold_out' && item.status !== 'unavailable',
    );
    if (available.length > 0) menuByRestaurant[r.id] = available;
  }

  const eligibleWithMenu = eligible.filter((r) => menuByRestaurant[r.id]?.length > 0);

  if (eligibleWithMenu.length === 0) {
    console.warn(
      '[setup] ⚠  No eligible restaurants with available menu items found.\n' +
      '         Cart / checkout / order-tracking steps will be skipped.\n' +
      '         Ensure the DB has at least one isApproved+isOpen restaurant\n' +
      '         with non-sold-out menu items and a delivery zone covering\n' +
      `         lat ${DELIVERY_ADDRESS.latitude}, lon ${DELIVERY_ADDRESS.longitude}.`,
    );
  } else {
    const totalItems = Object.values(menuByRestaurant).reduce((s, a) => s + a.length, 0);
    console.log(
      `[setup] Found ${eligibleWithMenu.length} eligible restaurants, ` +
      `${totalItems} menu items.`,
    );
  }

  return { users, eligibleRestaurants: eligibleWithMenu, menuByRestaurant };
}

// ---------------------------------------------------------------------------
// Default function — executes for every VU iteration
// ---------------------------------------------------------------------------

export default function (data) {
  const { users, eligibleRestaurants, menuByRestaurant } = data;

  // Stable user per VU: each VU always uses the same account so concurrent
  // VUs never share a cart (avoids false BR-2 cross-restaurant conflicts).
  const user = users[(__VU - 1) % users.length];

  // ── 1. Sign in ───────────────────────────────────────────────────────────
  let token = null;
  group('Sign in', () => {
    token = signIn(user.email, user.password);
    const ok = check(token, {
      'sign-in: received bearer token': (t) => t !== null,
    });
    authFailRate.add(ok ? 0 : 1);
    if (!ok) fail('sign-in failed — aborting iteration');
  });

  sleep(randInt(1, 2));

  // ── 2. Browse restaurants ────────────────────────────────────────────────
  // Pick a random eligible restaurant from the setup catalogue.
  let restaurant = eligibleRestaurants.length > 0
    ? eligibleRestaurants[randInt(0, eligibleRestaurants.length - 1)]
    : null;

  group('Browse restaurants', () => {
    const res = http.get(apiUrl('/api/restaurants?offset=0&limit=10'), {
      headers: authHeaders(token),
      tags: { name: 'GET /restaurants' },
    });
    check(res, { 'restaurants: status 200': (r) => r.status === 200 });
  });

  sleep(randInt(2, 5));

  if (!restaurant) {
    // No eligible data — skip purchase flow and exit early.
    sleep(2);
    return;
  }

  // ── 3. Browse menu ───────────────────────────────────────────────────────
  let menuItem = null;

  group('Browse menu', () => {
    const res = http.get(
      apiUrl(`/api/menu-items?restaurantId=${restaurant.id}&limit=10`),
      { headers: authHeaders(token), tags: { name: 'GET /menu-items' } },
    );
    check(res, { 'menu: status 200': (r) => r.status === 200 });

    // Pick a random available item from the pre-loaded catalogue.
    const items = menuByRestaurant[restaurant.id] || [];
    if (items.length > 0) {
      menuItem = items[randInt(0, items.length - 1)];

      // Simulate tapping on a specific dish.
      const detailRes = http.get(
        apiUrl(`/api/menu-items/${menuItem.id}`),
        { headers: authHeaders(token), tags: { name: 'GET /menu-items/:id' } },
      );
      check(detailRes, { 'item detail: status 200': (r) => r.status === 200 });
    }
  });

  sleep(randInt(2, 4));

  if (!menuItem) {
    sleep(2);
    return;
  }

  // ── 4. Add to cart ───────────────────────────────────────────────────────
  let cartItemId = null;

  group('Add to cart', () => {
    // Clear any leftover cart from a previous iteration to avoid BR-2
    // (single-restaurant constraint) and stale-price errors.
    http.del(apiUrl('/api/carts/my'), null, { headers: authHeaders(token) });

    const payload = JSON.stringify({
      menuItemId:     menuItem.id,
      restaurantId:   restaurant.id,
      restaurantName: restaurant.name,
      itemName:       menuItem.name,
      unitPrice:      menuItem.price,
      quantity:       randInt(1, 3),
      ...(menuItem.imageUrl ? { imageUrl: menuItem.imageUrl } : {}),
    });

    const res = http.post(apiUrl('/api/carts/my/items'), payload, {
      headers: authHeaders(token),
      tags: { name: 'POST /carts/my/items' },
    });

    const ok = check(res, {
      'add to cart: status 201': (r) => r.status === 201,
      'add to cart: cart returned': (r) => parseBody(r)?.items?.length > 0,
    });

    if (ok) {
      cartItemId = parseBody(res)?.items?.[0]?.cartItemId ?? null;
    } else {
      console.warn(`[VU ${__VU}] Add-to-cart failed: ${res.status} — ${res.body}`);
    }
  });

  sleep(randInt(1, 3));

  // ── 5. Update quantity (30 % of users) ──────────────────────────────────
  if (cartItemId && Math.random() < 0.3) {
    group('Update cart quantity', () => {
      const res = http.patch(
        apiUrl(`/api/carts/my/items/${cartItemId}`),
        JSON.stringify({ quantity: randInt(1, 4) }),
        { headers: authHeaders(token), tags: { name: 'PATCH /carts/my/items/:id' } },
      );
      check(res, { 'update qty: status 200': (r) => r.status === 200 });
    });
    sleep(1);
  }

  // ── 6. View cart ─────────────────────────────────────────────────────────
  group('View cart', () => {
    const res = http.get(apiUrl('/api/carts/my'), {
      headers: authHeaders(token),
      tags: { name: 'GET /carts/my' },
    });
    check(res, {
      'cart: status 200': (r) => r.status === 200,
      'cart: has items':  (r) => parseBody(r)?.items?.length > 0,
    });
  });

  sleep(randInt(1, 2));

  // ── 7. Checkout (COD) ────────────────────────────────────────────────────
  const t0 = Date.now();
  let orderId = null;

  group('Checkout', () => {
    const payload = JSON.stringify({
      deliveryAddress: DELIVERY_ADDRESS,
      paymentMethod: 'cod',
      note: 'k6 load test — please ignore',
    });

    const res = http.post(apiUrl('/api/carts/my/checkout'), payload, {
      headers: {
        ...authHeaders(token),
        // UUID v4 — satisfies the ^[0-9a-fA-F-]{8,64}$ validator in cart.controller.ts
        'X-Idempotency-Key': uuidv4(),
      },
      tags: { name: 'POST /checkout' },
    });

    const ok = check(res, {
      'checkout: status 201':    (r) => r.status === 201,
      'checkout: has orderId':   (r) => !!parseBody(r)?.orderId,
      'checkout: status is pending': (r) => parseBody(r)?.status === 'pending',
    });

    checkoutFailRate.add(ok ? 0 : 1);

    if (ok) {
      ordersPlaced.add(1);
      orderE2eDuration.add(Date.now() - t0);
      orderId = parseBody(res)?.orderId ?? null;
    } else {
      console.warn(`[VU ${__VU}] Checkout failed: ${res.status} — ${res.body}`);
    }
  });

  sleep(randInt(1, 3));

  // ── 8. Track order ───────────────────────────────────────────────────────
  if (orderId) {
    group('Track order', () => {
      // Customer-scoped endpoint (mirrors what the mobile app polls).
      const res = http.get(apiUrl(`/api/orders/my/${orderId}`), {
        headers: authHeaders(token),
        tags: { name: 'GET /orders/my/:id' },
      });
      check(res, {
        'order detail: status 200': (r) => r.status === 200,
        'order detail: has status': (r) => !!parseBody(r)?.status,
      });

      // Also fetch order list to simulate the "My Orders" screen.
      const listRes = http.get(apiUrl('/api/orders/my?limit=5'), {
        headers: authHeaders(token),
        tags: { name: 'GET /orders/my' },
      });
      check(listRes, { 'order list: status 200': (r) => r.status === 200 });
    });
  }

  // Think time before the next iteration (simulates closing the app / idle).
  sleep(randInt(3, 8));
}

// ---------------------------------------------------------------------------
// Teardown — runs once after all VUs finish
// ---------------------------------------------------------------------------

export function teardown() {
  console.log(
    '[teardown] Run complete.\n' +
    '[teardown] Test orders remain in DB. Clean up with:\n' +
    `[teardown]   DELETE FROM "order" WHERE note = 'k6 load test — please ignore';`,
  );
}
