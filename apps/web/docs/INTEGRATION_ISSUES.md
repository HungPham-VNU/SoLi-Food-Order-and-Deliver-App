# Web Integration — Unresolvable Issues

Problems discovered during API audit that cannot be fixed in the web frontend alone. Each issue has an owner (backend or design), a severity, and a workaround where possible.

---

## Issue #1 — No "Get My Restaurant" Endpoint

**Severity:** High — blocks Phase 2 (Restaurant Context)
**Owner:** Backend

### Problem
`GET /api/restaurants` returns **all** restaurants in the platform. There is no `GET /api/restaurants/mine` or equivalent that returns only the restaurant owned by the currently authenticated user.

After login, the web app needs to know which restaurant belongs to the logged-in user in order to scope all subsequent queries (menu, orders, delivery zones). Currently the only way to do this is to fetch the full list and filter client-side by `ownerId === session.user.id`.

### Why this is a problem
- Inefficient at scale (fetches every restaurant to find one).
- Pagination makes it worse: if the owner's restaurant is not on the first page, the client would need to paginate through all results.
- Exposes data about other restaurants to the client unnecessarily.

### Required Backend Fix
Add endpoint: `GET /api/restaurants/mine`

```ts
// restaurant.controller.ts
@Get('mine')
@Roles(['restaurant', 'admin'])
getMyRestaurant(@Session() session: UserSession) {
  return this.restaurantService.findByOwnerId(session.user.id);
}
```

### Interim Workaround
Fetch page 1 of restaurants and find the one where `r.ownerId === session.user.id`. This breaks for admins and restaurant owners who aren't on the first page. Acceptable for development only.

---

## Issue #2 — OrderStatus Mismatch (Frontend vs API)

**Severity:** High — blocks Phase 4 (Orders Integration)
**Owner:** Frontend (the web invented its own statuses)

### Problem
The current `features/orders/types/order.types.ts` defines:
```ts
type OrderStatus = "requesting" | "todo" | "in_progress" | "done";
```

The API uses 9 statuses: `pending | confirmed | preparing | ready_for_pickup | picked_up | delivering | delivered | cancelled | refunded`.

The Kanban board has 4 columns. Multiple API statuses map to the same column (e.g., `picked_up`, `delivering`, `delivered`, `cancelled`, `refunded` all map to `done`). This means:
- A **delivered** order and a **cancelled** order appear in the same column with no visual distinction.
- The restaurant can't tell at a glance which "done" orders succeeded vs failed.
- Drag-and-drop transitions (moving a card from one column to another) no longer make semantic sense for most statuses — you cannot drag an order from `done` back to `in_progress`.

### Why this cannot be fully resolved in the frontend
The 4-column Kanban layout was designed for a different status model. Fixing the display requires a **design decision**: either redesign the Kanban columns to match the API's real statuses, or define a strict, intentional mapping and make the status badge carry the semantic weight.

### Recommended Resolution
1. **Design**: Redesign the `done` column to be a read-only "completed/terminal" column with colour-coded badges per real status (`delivered` = green, `cancelled` = red, `refunded` = amber).
2. **Disable drag-to-done**: Remove drag-and-drop for the `done` column entirely; transitions to terminal states happen via the action buttons on the card.
3. **Only 3 drag-enabled columns**: `requesting → todo → in_progress` maps to `confirm → start-preparing`. Dragging is allowed only between these.

### Interim Workaround
Use `STATUS_TO_COLUMN` mapping (defined in the integration plan). Accept the visual ambiguity in `done` until the Kanban is redesigned.

---

## Issue #3 — Restaurant Registration Flow: Role Not Set on Signup

**Severity:** High — blocks Phase 1-C (Register Business)
**Owner:** Backend

### Problem
When a new user registers via `POST /auth/sign-up`, better-auth creates an account with `role = null` (or `'user'` if `defaultRole` is set). The `POST /api/restaurants` endpoint requires `role === 'restaurant'` or `role === 'admin'` to succeed.

This means a newly registered restaurant owner **cannot create their restaurant immediately after signup** — their role is wrong.

### Current Auth Plugin Config (from `src/lib/auth.ts`)
The admin plugin is loaded with `defaultRole: 'user'`. So all new accounts get `role = 'user'`.

### Required Backend Fix
Either:
- **Option A:** Set `defaultRole: 'restaurant'` in the admin plugin config. Every new signup becomes a restaurant owner by default (only suitable if the app is invite-only or exclusively for restaurant owners).
- **Option B:** Add a dedicated sign-up endpoint or hook that sets role to `'restaurant'` after email sign-up when called from the restaurant registration flow.
- **Option C:** Relax the role guard on `POST /api/restaurants` to allow any authenticated user to create their first restaurant (then upgrade their role to `'restaurant'` automatically on first restaurant creation).

**Option C is recommended** — it's the most self-service and avoids a privileged post-signup step.

### Interim Workaround
Manually update the role in the database after signup: `UPDATE "user" SET role = 'restaurant' WHERE email = '...'`. Not viable for production.

---

## Issue #4 — No "Urgent" Orders API Field

**Severity:** Medium — affects Dashboard Phase 5
**Owner:** Backend (or Frontend design)

### Problem
The Dashboard's "Ready for Pickup" card shows "3 urgent". There is no `urgent` flag or `urgencyLevel` field on the API's order response. The API provides only `status`, `createdAt`, and `updatedAt`.

"Urgency" is a derived concept — an order that has been `ready_for_pickup` for more than N minutes could be considered urgent. But the frontend has no way to know what threshold to use, and different restaurants might have different tolerances.

### Required Fix
Either:
- **Backend:** Add an `urgentAt` timestamp or `isUrgent` boolean derived from a configurable threshold.
- **Frontend:** Hardcode a threshold (e.g., >10 minutes in `ready_for_pickup` = urgent) and derive it from `updatedAt`. This is fragile.

### Interim Workaround
Show total ready count without the "urgent" sub-count until this is clarified with the product team.

---

## Issue #5 — No Tax or Service Fee Breakdown in Order Totals

**Severity:** Medium — affects OrderDetailPage
**Owner:** Backend

### Problem
`OrderDetail` in the frontend has:
```ts
type OrderTotals = {
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  tax: number;
  total: number;
};
```

The API's order response only returns:
```json
{
  "totalAmount": number,
  "shippingFee": number
}
```

No `subtotal`, `serviceFee`, or `tax` field exists.

### Required Backend Fix
Either expose a full breakdown in the order response, or document that `subtotal = totalAmount - shippingFee` and that tax and service fee are not separately tracked.

### Interim Workaround
In `OrderDetailPayment.tsx`, only display `totalAmount` and `shippingFee`. Remove `serviceFee` and `tax` line items from the breakdown UI until the backend exposes them.

---

## Issue #6 — `isAvailable` Field Missing from Menu Item API Response

**Severity:** Low — causes a minor type mismatch
**Owner:** Frontend (the field was invented in the mock)

### Problem
The current `MenuItem` frontend type has `isAvailable: boolean`. The API's `MenuItemResponseDto` has `status: 'available' | 'unavailable' | 'out_of_stock'` — no `isAvailable` field.

`MenuItemCard.tsx` likely reads `item.isAvailable` in several places.

### Resolution (Frontend-only)
When mapping API response to component props, derive:
```ts
const isAvailable = item.status === 'available';
```

This is a pure frontend fix. Do this during Phase 3 when replacing the mock types.

---

## Issue #7 — `MenuItemCategory` is a UUID in the API, String Enum on the Frontend

**Severity:** Low — type mismatch, causes form breakage
**Owner:** Frontend (the mock invented a string enum)

### Problem
`features/menu/types/index.ts` defines:
```ts
type MenuItemCategory = 'salads' | 'desserts' | 'breads' | 'mains' | 'drinks' | 'sides';
```

The API uses categories as `{ id: uuid, restaurantId: uuid, name: string, displayOrder: number }`. `MenuItem.categoryId` is a UUID, not a string enum.

The `MenuManagementPage` filter tabs are hardcoded to these string values.

### Resolution (Frontend-only)
Fix during Phase 3: replace the string enum with `string` (UUID), and populate the filter tabs from `useMenuCategories(restaurantId)` instead of the hardcoded list.

---

## Issue #8 — VNPay IPN Endpoint is Public but Needs HTTPS in Production

**Severity:** Low for development, High for production
**Owner:** Infrastructure / Backend

### Problem
`GET /api/payments/vnpay/ipn` is the callback VNPay calls to confirm payments. VNPay requires this URL to be reachable from the internet over HTTPS. In local development (localhost), VNPay cannot reach it.

The web frontend's `/payment/return` page (Phase 8) will work in development, but actual payment confirmation will never fire without a publicly accessible IPN URL.

### Required Fix
For testing VNPay end-to-end:
- Use `ngrok` or similar to expose `localhost:3000` publicly during development.
- In production: ensure the API is deployed with HTTPS.

The web frontend cannot resolve this — it's a deployment/infrastructure concern.

---

## Issue #9 — WebSocket: `socket.io-client` Not Installed on Web

**Severity:** Low — easy to fix, just needs `pnpm add`
**Owner:** Frontend

### Problem
The Notification WebSocket integration (Phase 7) requires `socket.io-client`. The web app's `package.json` does not include it.

### Resolution
```bash
pnpm --filter web add socket.io-client
```

This is a trivial dependency install. Documented here because it will cause an import error if forgotten.

---

## Summary Table

| # | Issue | Severity | Owner | Blocking Phase | Workaround Available? |
|---|-------|----------|-------|---------------|----------------------|
| 1 | No `/restaurants/mine` endpoint | High | Backend | 2 | Yes (inefficient) |
| 2 | OrderStatus mismatch | High | Frontend/Design | 4 | Yes (mapping table) |
| 3 | Role not set on signup | High | Backend | 1-C | Manual DB edit only |
| 4 | No "urgent" orders field | Medium | Backend/Design | 5 | Yes (hide sub-count) |
| 5 | No tax/service fee breakdown | Medium | Backend | 4 | Yes (simplify UI) |
| 6 | `isAvailable` not in API | Low | Frontend | 3 | Yes (derive from status) |
| 7 | Category is UUID not enum | Low | Frontend | 3 | Yes (fix in Phase 3) |
| 8 | VNPay IPN needs HTTPS | High (prod) | Infrastructure | 8 | ngrok for dev |
| 9 | `socket.io-client` missing | Low | Frontend | 7 | Install package |
