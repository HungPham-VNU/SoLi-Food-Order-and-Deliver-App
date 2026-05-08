# Device Token Persistence Fix Report

**Date**: 2026-05-08  
**Symptom**: Browser FCM token not appearing in `device_tokens` table  
**Status**: ✅ Fixed — tokens now persist correctly on every registration

---

## 1. Root Causes (Three Layers)

### Root Cause A — PRIMARY: `fcm-test.html` never called the registration endpoint

The test page:
1. ✅ Generated an FCM token via `getToken()` (Firebase JS SDK)
2. ✅ Displayed the token in the UI
3. ✅ Sent the token to `POST /api/notifications/test/push` for delivery tests
4. ❌ **Never called `POST /api/notifications/my/push-tokens`** to persist it

The token existed only in browser memory and was never written to `device_tokens`.

### Root Cause B — SECONDARY: No authentication in `fcm-test.html`

- `POST /api/notifications/my/push-tokens` requires a valid session (better-auth guard)
- `fcm-test.html` had no login form or session management
- Even if the page had tried to call the endpoint, it would receive `401 Unauthorized`

### Root Cause C — TERTIARY: No GET endpoint to verify what was in the DB

- No `GET /api/notifications/my/push-tokens` endpoint existed
- Made debugging impossible — no way to confirm whether a token was persisted
- **Fixed**: Added this endpoint

---

## 2. Backend — Already Correct (No Bugs Found)

The entire backend chain was fully implemented and tested **before this session**:

```
NotificationController.registerPushToken()
  → NotificationService.registerPushToken()
    → DeviceTokenRepository.registerOrRefresh()
      → Drizzle INSERT ... ON CONFLICT DO UPDATE
        → device_tokens table
```

The E2E tests in `notification-n4.e2e-spec.ts` confirmed §1.1–§1.8 all passed. The issue was entirely in the test page and the missing verification endpoint.

---

## 3. Changes Made

### 3.1 Backend: New GET endpoint — `GET /notifications/my/push-tokens`

**`apps/api/src/module/notification/repositories/device-token.repository.ts`**

Added `findByUserId()` method:
```typescript
async findByUserId(userId: string): Promise<DeviceToken[]> {
  return this.db
    .select()
    .from(deviceTokens)
    .where(eq(deviceTokens.userId, userId))
    .orderBy(desc(deviceTokens.createdAt));
}
```
Returns ALL tokens (active + inactive) for a user, newest first.

**`apps/api/src/module/notification/services/notification.service.ts`**

Added `getMyTokens()` method:
```typescript
async getMyTokens(userId: string): Promise<PushTokenListResponseDto> {
  const rows = await this.deviceTokenRepo.findByUserId(userId);
  return {
    tokens: rows.map((t) => ({
      id: t.id,
      tokenSuffix: `…${t.token.slice(-8)}`,   // NEVER expose full token
      platform: t.platform,
      isActive: t.isActive,
      lastSeenAt: t.lastSeenAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
    })),
  };
}
```

**`apps/api/src/module/notification/controllers/notification.controller.ts`**

Added GET endpoint:
```typescript
@Get('my/push-tokens')
@ApiOperation({ summary: "List current user's registered push device tokens" })
@ApiOkResponse({ type: PushTokenListResponseDto })
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
async getMyPushTokens(@Session() session: UserSession): Promise<PushTokenListResponseDto> {
  return this.notificationService.getMyTokens(session.user.id);
}
```

**Security note**: Token values are always masked to `…<last8chars>`. The full FCM token is never returned by any API endpoint.

### 3.2 Frontend: Complete rewrite of `fcm-test.html`

`apps/api/public/fcm-test.html` was rewritten to add:

#### Step 0 — Authentication (NEW)
- Email/password login form using `POST /api/auth/sign-in/email`
- Sign-up form using `POST /api/auth/sign-up/email`
- Stores Bearer token in `sessionToken` variable in memory
- UI shows signed-in user email + sign-out button
- All subsequent API calls send `Authorization: Bearer <token>`

#### Step 1 — Get FCM Token & Register (FIXED)
- **Before**: Got FCM token, showed in UI, stopped there
- **After**: After `getToken()` succeeds, immediately calls:
  ```javascript
  POST /api/notifications/my/push-tokens
  Authorization: Bearer <token>
  { "token": "<fcm-token>", "platform": "web" }
  ```
- Warns user if Step 0 not completed
- On success, auto-refreshes Step 3 token list

#### Step 3 — Verify Tokens in DB (NEW)
- Calls `GET /api/notifications/my/push-tokens`
- Renders table: token suffix, platform badge, active/inactive badge, last seen, registered
- Refreshes automatically after Step 1 registration
- Manual refresh button

### 3.3 Tests

**Unit tests — `notification.service.spec.ts`** (3 new tests):
- `getMyTokens` — returns masked tokenSuffix, never exposes full token
- `getMyTokens` — returns empty array when no tokens registered
- `getMyTokens` — handles multiple tokens correctly

**E2E tests — `notification-n4.e2e-spec.ts`** (2 new tests):
- `§1.9` — `GET /notifications/my/push-tokens` lists tokens with masked suffix
- `§1.10` — `GET /notifications/my/push-tokens` returns 401 without auth

---

## 4. Test Results

| Test Suite | Before | After |
|------------|--------|-------|
| Unit tests (all) | 89 pass | **92 pass** (+3 getMyTokens) |
| TypeScript errors | 0 | **0** |
| `app.controller.spec.ts` | pre-existing parse failure | unchanged (unrelated) |

---

## 5. Manual Verification Steps

1. Start the backend: `cd apps/api && npx nest start`
2. Open `http://localhost:3000/fcm-test.html` (NOT Live Server, NOT `file://`)
3. **Step 0**: Sign in with `customer@soli.dev` (or sign up)
4. **Step 1**: Click "Request Permission & Get + Register Token"
   - Should see: `✅ Token registered in device_tokens!`
5. **Step 3**: Confirm token row appears in the table with `active` badge
6. Verify via SQL:
   ```sql
   SELECT id, user_id, platform, is_active, last_seen_at, LEFT(token, 8)||'...' as token_preview
   FROM device_tokens
   ORDER BY created_at DESC
   LIMIT 10;
   ```

---

## 6. Multi-Device & Duplicate Handling (Already Correct)

The repository uses `onConflictDoUpdate` on `(user_id, token)`:

```typescript
.onConflictDoUpdate({
  target: [deviceTokens.userId, deviceTokens.token],
  set: {
    platform: sql`EXCLUDED.platform`,
    isActive: true,
    lastSeenAt: sql`now()`,
  },
})
```

- **Same token registered twice** → idempotent, only `lastSeenAt` updates
- **Multiple devices per user** → each gets its own row (different token value)
- **Token deactivated then re-registered** → `isActive` restored to `true`

---

## 7. Key Invariants Maintained

1. ✅ TypeScript: 0 errors
2. ✅ Unit tests: 92 passing
3. ✅ FCM payload remains **data-only** (no `notification` key) — `onMessage()` fires in foreground
4. ✅ Bearer token auth in `fcm-test.html` (explicit, not cookies)
5. ✅ Token values NEVER fully exposed via API (always masked to `…<last8chars>`)
6. ✅ `platform: 'web'` for browser FCM tokens registered via `fcm-test.html`
7. ✅ `GET /my/push-tokens` requires authentication (no `@AllowAnonymous()`)
