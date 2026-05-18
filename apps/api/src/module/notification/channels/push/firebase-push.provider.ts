import { Injectable, Logger } from '@nestjs/common';
import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import type {
  IPushProvider,
  PushSendOptions,
  PushSendResult,
} from './push-provider.interface';

/**
 * Raw shape of a Firebase service account JSON file (snake_case keys as Google emits them).
 * The firebase-admin `ServiceAccount` interface uses camelCase, but `credential.cert()`
 * accepts both. We keep this internal type so we can read the correct field names in logs.
 */
interface ServiceAccountJson {
  project_id: string;
  client_email: string;
  private_key: string;
  [key: string]: unknown;
}

/**
 * FCM error codes that indicate a token is permanently invalid.
 * These tokens should be deactivated immediately — retrying would waste quota.
 *https://firebase.google.com/docs/cloud-messaging/send-message#admin_sdk_error_codes
 * Reference:
 */
const FCM_INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/**
 * FCM error codes that indicate a GCP-level permission / configuration problem.
 * These are NOT token errors — the tokens are fine but the service account
 * lacks the `cloudmessaging.messages.create` IAM permission, or the Firebase
 * Cloud Messaging API is not enabled for this GCP project.
 */
const FCM_PERMISSION_ERROR_CODES = new Set([
  'messaging/mismatched-credential',
  'messaging/invalid-credential',
]);

/**
 * FirebasePushProvider
 *
 * Production push notification provider backed by Firebase Cloud Messaging (FCM).
 * Implements IPushProvider — drop-in replacement for StubPushProvider.
 *
 * Behaviour:
 *  - Sends a multicast message to all provided tokens via
 *    admin.messaging().sendEachForMulticast().
 *  - Includes a `webpush` section in every message for proper browser
 *    notification rendering (title/body/icon/click URL).
 *  - Classifies FCM error codes to identify permanently invalid tokens,
 *    which are returned in the `invalidTokens` list so PushChannelService
 *    can deactivate them in DeviceTokenRepository immediately.
 *  - MUST NOT throw — all errors are caught and expressed as PushSendResult.
 *  - On startup, runs a validate-only permission check and logs a clear
 *    error (with fix instructions) if the service account lacks FCM permission.
 *
 * Singleton guard:
 *  Firebase Admin SDK only allows one app initialisation per app name.
 *  The constructor checks getApps().length before calling initializeApp().
 *
 * Service account path resolution (monorepo-aware):
 *  `serviceAccountPath` may be absolute or relative.
 *  For relative paths the following locations are tried in order:
 *   1. process.cwd()          — works when `nest start` is invoked from apps/api/
 *   2. apps/api/ root via __dirname — works when invoked from the monorepo root
 *
 * GCP permission requirements:
 *  The service account needs EITHER:
 *   A. Role: Firebase Cloud Messaging Admin (roles/firebasecloudmessaging.admin)
 *   B. Role: Firebase Admin (roles/firebase.admin)
 *  AND the Firebase Cloud Messaging API must be enabled:
 *   https://console.cloud.google.com/apis/library/fcm.googleapis.com
 *
 * Phase: N-5 — Firebase Cloud Messaging
 */
@Injectable()
export class FirebasePushProvider implements IPushProvider {
  private readonly logger = new Logger(FirebasePushProvider.name);
  private readonly app: App;

  /**
   * Resolve the service account key file path with monorepo awareness.
   *
   * Absolute paths are returned as-is.
   * For relative paths the resolution order is:
   *  1. process.cwd()    — correct when running `nest start` from apps/api/
   *  2. apps/api/ root   — correct when running from the monorepo root or via
   *                        `pnpm --filter api start` from the workspace root.
   *
   * __dirname in this file:
   *   dev  → apps/api/src/module/notification/channels/push/
   *   prod → apps/api/dist/module/notification/channels/push/
   * Five levels up from either gives apps/api/.
   */
  private static resolveKeyPath(keyPath: string): string {
    if (path.isAbsolute(keyPath)) {
      return keyPath;
    }

    // Candidate 1: relative to process.cwd()
    const fromCwd = path.resolve(process.cwd(), keyPath);
    if (fs.existsSync(fromCwd)) {
      return fromCwd;
    }

    // Candidate 2: relative to apps/api/ root (5 levels up from __dirname)
    const apiRoot = path.resolve(__dirname, '../../../../..');
    const fromApiRoot = path.resolve(apiRoot, keyPath);
    if (fs.existsSync(fromApiRoot)) {
      return fromApiRoot;
    }

    // Neither candidate exists — return the process.cwd() candidate so the
    // caller's error message shows a meaningful absolute path.
    return fromCwd;
  }

  constructor(serviceAccountPath: string) {
    const resolvedPath =
      FirebasePushProvider.resolveKeyPath(serviceAccountPath);

    // Singleton guard — Firebase Admin throws if you call initializeApp twice
    if (getApps().length === 0) {
      try {
        const raw = fs.readFileSync(resolvedPath, 'utf-8');
        // Parse as the raw snake_case JSON format Google emits.
        // cert() accepts this object directly; no key mapping required.
        const serviceAccount = JSON.parse(raw) as ServiceAccountJson;
        this.app = initializeApp({
          credential: cert(serviceAccount as Parameters<typeof cert>[0]),
        });
        this.logger.log(
          `[FirebasePush] Firebase Admin SDK initialised ` +
            `(project=${serviceAccount.project_id}) from: ${resolvedPath}`,
        );
        // Validate FCM permissions in the background — do not block startup.
        void this.validateFcmPermissions(serviceAccount.project_id);
      } catch (err) {
        // Propagate as a descriptive startup error so the developer sees exactly
        // what went wrong rather than a cryptic module-not-found or JSON parse error.
        throw new Error(
          `FirebasePushProvider: Failed to initialise Firebase Admin SDK from ` +
            `"${resolvedPath}": ${(err as Error).message}. ` +
            `Check the FIREBASE_SERVICE_ACCOUNT_PATH value in your .env file.`,
          { cause: err },
        );
      }
    } else {
      // Another piece of code (unlikely in this monolith) initialised Firebase first.
      // Reuse the existing app to avoid DuplicateApp errors.
      this.app = getApp();
      this.logger.log(
        '[FirebasePush] Reusing existing Firebase Admin app instance',
      );
    }
  }

  /**
   * Validate that the service account can actually send FCM messages.
   *
   * Makes a validate_only=true request to the FCM HTTP v1 API — no message is
   * sent, but the IAM permission check is performed. If it returns 403, we log
   * a clear error with step-by-step fix instructions so the developer knows
   * exactly what to do in GCP Console instead of staring at a cryptic error.
   *
   * Called asynchronously from the constructor so it never blocks startup.
   */
  private async validateFcmPermissions(projectId: string): Promise<void> {
    try {
      const credential = this.app.options.credential!;
      const tokenResult = await credential.getAccessToken();
      const accessToken = tokenResult.access_token;

      const body = JSON.stringify({
        validate_only: true,
        message: {
          token: 'fcm-permission-check-dummy-token',
          notification: {
            title: 'Permission check',
            body: 'validate_only=true',
          },
        },
      });

      const result = await new Promise<{ status: number; body: string }>(
        (resolve, reject) => {
          const req = https.request(
            {
              hostname: 'fcm.googleapis.com',
              path: `/v1/projects/${projectId}/messages:send`,
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
              },
            },
            (res) => {
              let data = '';
              res.on('data', (chunk: Buffer) => (data += chunk.toString()));
              res.on('end', () =>
                resolve({ status: res.statusCode ?? 0, body: data }),
              );
            },
          );
          req.on('error', reject);
          req.write(body);
          req.end();
        },
      );

      if (result.status === 200 || result.status === 400) {
        // 200 = validate_only accepted (permission OK)
        // 400 = bad token format (expected for dummy token) — means permission OK
        this.logger.log(
          `[FirebasePush] FCM permission check PASSED — service account can send messages`,
        );
      } else if (result.status === 403) {
        this.logger.error(
          `[FirebasePush] ====================================================\n` +
            `[FirebasePush] FCM PERMISSION CHECK FAILED — push notifications WILL NOT be delivered!\n` +
            `[FirebasePush]\n` +
            `[FirebasePush] Error: ${(JSON.parse(result.body) as { error?: { message?: string } }).error?.message ?? result.body}\n` +
            `[FirebasePush]\n` +
            `[FirebasePush] The service account lacks the 'cloudmessaging.messages.create' permission.\n` +
            `[FirebasePush] Fix (choose ONE option):\n` +
            `[FirebasePush]\n` +
            `[FirebasePush] OPTION A — Enable FCM API (most common fix):\n` +
            `[FirebasePush]   1. Open: https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=${projectId}\n` +
            `[FirebasePush]   2. Click "ENABLE"\n` +
            `[FirebasePush]\n` +
            `[FirebasePush] OPTION B — Grant IAM role to current service account:\n` +
            `[FirebasePush]   1. Open: https://console.cloud.google.com/iam-admin/iam?project=${projectId}\n` +
            `[FirebasePush]   2. Find '${(this.app.options.credential as unknown as { serviceAccountId?: string }).serviceAccountId ?? 'your-service-account'}'\n` +
            `[FirebasePush]   3. Add role: "Firebase Cloud Messaging Admin"\n` +
            `[FirebasePush]\n` +
            `[FirebasePush] OPTION C — Use the default Firebase Admin SDK service account:\n` +
            `[FirebasePush]   1. Open: https://console.firebase.google.com/project/${projectId}/settings/serviceaccounts/adminsdk\n` +
            `[FirebasePush]   2. Click "Generate new private key"\n` +
            `[FirebasePush]   3. Save as apps/api/soli-food-delivery-FCM-key.json\n` +
            `[FirebasePush] ====================================================`,
        );
      }
    } catch {
      // Network error during validation — not critical, don't block
      this.logger.warn(
        '[FirebasePush] FCM permission pre-check skipped (network error)',
      );
    }
  }

  async send(options: PushSendOptions): Promise<PushSendResult> {
    const { tokens, title, body, data } = options;

    try {
      // ---------------------------------------------------------------------------
      // Payload design — data-only message for cross-platform foreground support
      //
      // FCM has a critical behaviour difference between message types:
      //
      //   notification-only / notification+webpush:
      //     The browser/SW intercepts the push event and shows a system notification
      //     BEFORE the main-thread JS receives the message. In FOREGROUND tabs,
      //     Chrome silently discards the push without calling onMessage().
      //     Result: foreground notification callbacks never fire.
      //
      //   data-only (no top-level `notification` key):
      //     The push event is delivered directly to:
      //       - The main thread's onMessage() when the tab is in the FOREGROUND.
      //       - The SW's onBackgroundMessage() when the tab is in the BACKGROUND.
      //     Both handlers then manually display the notification.
      //     Result: consistent behaviour across foreground and background.
      //
      // Therefore we use a data-only message, embedding title+body in the data
      // payload. Both the web client (onMessage) and the service worker
      // (onBackgroundMessage) extract and display from these keys.
      //
      // FCM data values MUST all be strings — the SDK rejects non-string values.
      // ---------------------------------------------------------------------------
      const fcmData: Record<string, string> = {
        title,
        body,
        // Merge caller-supplied data, ensuring all values are strings
        ...(data
          ? Object.fromEntries(
              Object.entries(data).map(([k, v]) => [k, String(v)]),
            )
          : {}),
        // Click-through URL — defaults to app root
        link: String(data?.link ?? '/'),
        // Default icon path — callers can override via data.icon
        icon: String(data?.icon ?? '/icons/notification-icon.png'),
      };

      const message: MulticastMessage = {
        tokens,
        // NO top-level `notification` key — data-only so onMessage() fires in foreground
        data: fcmData,
        // webpush section controls how the browser subscription is targeted and
        // provides FCM HTTP v1 API web-specific options.
        // NOTE: webpush.notification is intentionally omitted here — if included,
        // the browser would auto-display a system notification AND the SW would
        // receive the message, but onMessage() in the foreground would NOT fire.
        webpush: {
          fcmOptions: {
            // Absolute URL required for notification click deep-links.
            // '/' is a relative path — FCM requires an absolute URL for the link field.
            // In development (localhost) we construct an absolute URL.
            // Callers should pass data.link as an absolute URL in production.
            link: data?.link
              ? String(data.link)
              : (process.env.APP_URL ?? 'http://localhost:3000') + '/',
          },
          headers: {
            // Urgency hint — FCM/browsers may batch low-urgency pushes.
            // 'high' ensures food-delivery notifications arrive promptly.
            Urgency: 'high',
          },
        },
      };

      const batchResponse = await getMessaging(this.app).sendEachForMulticast(
        message,
      );

      // Classify per-token results
      const invalidTokens: string[] = [];
      batchResponse.responses.forEach((r, index) => {
        if (!r.success && r.error) {
          const code = r.error.code;
          if (FCM_INVALID_TOKEN_CODES.has(code)) {
            // Stale or unregistered token — deactivate immediately
            invalidTokens.push(tokens[index]);
          } else if (FCM_PERMISSION_ERROR_CODES.has(code)) {
            // Service account lacks cloudmessaging.messages.create permission.
            // Log once with actionable fix steps — do NOT deactivate tokens.
            this.logger.error(
              `[FirebasePush] FCM PERMISSION ERROR: ${r.error.message}\n` +
                `[FirebasePush] The service account cannot send FCM messages.\n` +
                `[FirebasePush] Fix: See startup log for step-by-step GCP Console instructions.`,
            );
          } else {
            // Transient FCM error (quota, internal) — log but don't deactivate
            this.logger.warn(
              `[FirebasePush] Token delivery failed (token index ${index}) ` +
                `code=${code}: ${r.error.message}`,
            );
          }
        }
      });

      this.logger.log(
        `[FirebasePush] Multicast complete: ` +
          `success=${batchResponse.successCount} ` +
          `failure=${batchResponse.failureCount} ` +
          `invalidTokens=${invalidTokens.length}`,
      );

      return {
        successCount: batchResponse.successCount,
        failureCount: batchResponse.failureCount,
        invalidTokens,
      };
    } catch (err) {
      // Only reaches here for fatal errors (network down, invalid credentials).
      // Report all tokens as failures without marking any as invalid — a transient
      // outage should not permanently deactivate user devices.
      this.logger.error(
        `[FirebasePush] sendEachForMulticast threw unexpectedly: ${(err as Error).message}`,
      );
      return {
        successCount: 0,
        failureCount: tokens.length,
        invalidTokens: [],
      };
    }
  }
}
