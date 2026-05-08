# N-6 — Email Delivery: Debug & Fix Report

**Phase**: N-4 / N-6  
**Status**: ✅ RESOLVED — Real email confirmed delivered  
**Fixed by**: Automated deep-dive debug session  
**Date**: 2026-05-08

---

## Executive Summary

Email notifications were not being received at all. A deep audit of the full email delivery stack—from `.env` through `env.schema.ts` through `NodemailerEmailProvider` to `EmailChannelService`—revealed **four distinct root-cause bugs**. All were fixed, SMTP was re-verified, and a real end-to-end email was successfully delivered to a live inbox.

---

## Root Causes Found

### Bug #1 — `SMTP_HOST=smtp.example.com` (Critical)

| | |
|---|---|
| **File** | `apps/api/.env` |
| **Value before** | `smtp.example.com` |
| **Value after** | `smtp.gmail.com` |
| **Impact** | Every SMTP connection attempt → DNS resolution failure → `SMTP_SEND_ERROR` in delivery log. No emails could ever be sent. |

The `.env` file had a placeholder hostname that was never updated to the real Gmail SMTP server. Since `NodemailerEmailProvider` does not call `transporter.verify()` at startup, this was invisible until a real send was attempted — and even then, the error was silently swallowed by `EmailChannelService` and recorded only as a delivery log entry with no alerting.

---

### Bug #2 — `SMTP_FROM=noreply@soli.dev` (Critical)

| | |
|---|---|
| **File** | `apps/api/.env` |
| **Value before** | `noreply@soli.dev` |
| **Value after** | `23520156@gm.uit.edu.vn` |
| **Impact** | Gmail / Google Workspace enforces that the FROM address matches the authenticated sender or a verified "Send as" alias. Sending from `noreply@soli.dev` while authenticating as `23520156@gm.uit.edu.vn` would cause authentication rejection or silent rewrite. |

The FROM address must exactly match the SMTP_USER (the Google Workspace account) unless a verified alias is configured in Gmail settings.

---

### Bug #3 — `SMTP_SECURE` Coercion Bug in `env.schema.ts` (High)

| | |
|---|---|
| **File** | `apps/api/src/config/env.schema.ts` |
| **Before** | `SMTP_SECURE: z.coerce.boolean().default(false)` |
| **After** | Custom string transform: `'true'/'1'` → `true`, anything else → `false` |
| **Impact** | `z.coerce.boolean()` uses `Boolean()` which treats any non-empty string as `true`. So `SMTP_SECURE=false` in `.env` was parsed as `true`, causing Nodemailer to attempt a direct SSL/TLS handshake on port 587. Gmail's port 587 uses STARTTLS (not direct SSL), so the connection would be immediately rejected. |

**Reproduction**:
```js
const { z } = require('zod');
z.coerce.boolean().parse('false'); // → true  ← BUG!
z.coerce.boolean().parse('true');  // → true
```

**Fix applied**:
```typescript
SMTP_SECURE: z
  .string()
  .optional()
  .default('false')
  .transform((s) => s === 'true' || s === '1'),
```

---

### Bug #4 — Missing `transporter.verify()` on Startup (Architecture)

| | |
|---|---|
| **File** | `apps/api/src/module/notification/channels/email/nodemailer-email.provider.ts` |
| **Before** | No startup verification; errors only appeared on first send attempt |
| **After** | Implements `OnModuleInit`; calls `transporter.verify()` and logs result |
| **Impact** | Without a startup check, SMTP misconfiguration was invisible at boot time. Developers had no signal that email was broken until a notification was triggered and its delivery log was manually inspected in the database. |

---

## Fixes Implemented

### 1. `apps/api/.env`

```diff
-SMTP_HOST=smtp.example.com
+SMTP_HOST=smtp.gmail.com
 SMTP_PORT=587
 SMTP_SECURE=false
 SMTP_USER=23520156@gm.uit.edu.vn
-SMTP_PASS=ojdfbcdvbwecfseg  
+SMTP_PASS=ojdfbcdvbwecfseg
-SMTP_FROM=noreply@soli.dev
+SMTP_FROM=23520156@gm.uit.edu.vn
```

Note: SMTP_PASS had 2 trailing spaces in the original file. `dotenv@17` trims these automatically (confirmed), but the file was corrected for clarity.

---

### 2. `apps/api/src/config/env.schema.ts`

Replaced `z.coerce.boolean()` with a safe string transform for `SMTP_SECURE`. Added `.trim()` to `SMTP_PASS` as a defensive measure against whitespace issues.

```typescript
// Before (buggy — 'false' string → true)
SMTP_SECURE: z.coerce.boolean().default(false),
SMTP_PASS: z.string().optional(),

// After (correct)
SMTP_SECURE: z
  .string()
  .optional()
  .default('false')
  .transform((s) => s === 'true' || s === '1'),
SMTP_PASS: z.string().trim().optional(),
```

---

### 3. `apps/api/src/module/notification/channels/email/nodemailer-email.provider.ts`

Major enhancements:

- **Implements `OnModuleInit`** — calls `transporter.verify()` at app startup and logs `✓ SMTP connection verified` or `✗ SMTP connection verification FAILED` with actionable guidance.
- **`requireTLS: true`** — when `SMTP_SECURE=false` (port 587 STARTTLS path), forces TLS upgrade and prevents fallback to plain-text SMTP.
- **`connectionTimeout: 10_000` and `greetingTimeout: 10_000`** — prevents hanging connections from blocking the event loop.
- **`tls.rejectUnauthorized`** — `true` in production (enforces valid cert chain), `false` in development (allows self-signed certs for dev SMTP servers like Mailhog/Mailtrap).
- **Smart `fromAddress` fallback** — if `SMTP_FROM` is the default placeholder `noreply@soli.dev`, automatically uses `SMTP_USER` as the FROM address (Gmail requirement).
- **Password never logged** — only `user` and `from` are logged at construction.

---

### 4. New: `POST /api/notifications/test/email` (Dev-only Endpoint)

Added a development-only endpoint following the same pattern as the existing `POST /api/notifications/test/push`.

- **Service**: `apps/api/src/module/notification/services/test-email.service.ts`
- **DTO**: `apps/api/src/module/notification/dto/test-email.dto.ts`
- **Controller**: `NotificationController` — blocked in `NODE_ENV=production` via `ForbiddenException`

Usage:
```bash
curl -X POST http://localhost:3000/api/notifications/test/email \
  -H "Content-Type: application/json" \
  -d '{"to": "developer@example.com", "subject": "SMTP test", "body": "Hello!"}'
```

---

### 5. New: `nodemailer-email.provider.spec.ts`

Added 13 unit tests for `NodemailerEmailProvider`:

| Test group | Tests |
|---|---|
| `constructor` | Transporter created with correct options; `requireTLS` set correctly for STARTTLS vs. direct SSL; FROM address logic (explicit vs. fallback to SMTP_USER vs. placeholder); timeout options |
| `onModuleInit` | `verify()` called; doesn't throw on success; swallows verify errors; logs ERROR on failure |
| `sendMail` | Correct fields forwarded; resolves on success; propagates SMTP errors |

---

## Verification

### SMTP Connection Check
```
SMTP_HOST: smtp.gmail.com
SMTP_USER: 23520156@gm.uit.edu.vn
SMTP_FROM: 23520156@gm.uit.edu.vn
→ SMTP OK  ✓
```

### Real Email Delivery
```
Sent! MessageId: <650dd24e-6f89-ad93-ec3a-bb7fb8d8c7fb@gm.uit.edu.vn>
```
Email successfully delivered to `luubinh.chuyenlongan@gmail.com`.

### Test Suite Results
```
Test Suites: 7 passed (notification module) — 0 failed
Tests:       139 passed — 0 failed
TypeScript:  0 errors
```

Pre-existing failure: `app.controller.spec.ts` — ESM/CJS interop issue with `@thallesp/nestjs-better-auth`, unrelated to email changes.

---

## Remaining Architectural Note — Email Field Population Gap

The `notification_preferences.email` column is **nullable with no default**. Users who have never called `PATCH /notifications/my/preferences` with an `email` field will have `null` in this column, causing `EmailChannelService` to return `NO_RECIPIENT_EMAIL` on every email dispatch.

**Current mitigation**: Users must call `PATCH /notifications/my/preferences` with their email:
```bash
curl -X PATCH http://localhost:3000/api/notifications/my/preferences \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "emailEnabled": true}'
```

**Recommended future improvement (out of scope for N-6)**:
- On first notification send for the email channel, auto-populate `notification_preferences.email` from the Better Auth user profile if the field is null.
- Or: populate `email` in the preference row when a user first signs up (auth hook).

---

## Files Changed

| File | Change type |
|---|---|
| `apps/api/.env` | Fixed `SMTP_HOST`, `SMTP_FROM`, `SMTP_PASS` (trailing spaces) |
| `apps/api/src/config/env.schema.ts` | Fixed `SMTP_SECURE` coercion; added `SMTP_PASS .trim()` |
| `apps/api/src/module/notification/channels/email/nodemailer-email.provider.ts` | Added `OnModuleInit`, `verify()`, `requireTLS`, TLS options, timeouts, FROM fallback |
| `apps/api/src/module/notification/channels/email/nodemailer-email.provider.spec.ts` | **NEW** — 13 unit tests |
| `apps/api/src/module/notification/services/test-email.service.ts` | **NEW** — TestEmailService |
| `apps/api/src/module/notification/dto/test-email.dto.ts` | **NEW** — TestEmailDto, TestEmailResponseDto |
| `apps/api/src/module/notification/controllers/notification.controller.ts` | Added `POST /test/email` endpoint + `TestEmailService` injection |
| `apps/api/src/module/notification/notification.module.ts` | Registered `TestEmailService` |
