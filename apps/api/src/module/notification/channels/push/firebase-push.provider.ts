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
 *
 * Reference: https://firebase.google.com/docs/cloud-messaging/send-message#admin_sdk_error_codes
 */
const FCM_INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
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
 *  - Classifies FCM error codes to identify permanently invalid tokens,
 *    which are returned in the `invalidTokens` list so PushChannelService
 *    can deactivate them in DeviceTokenRepository immediately.
 *  - MUST NOT throw — all errors are caught and expressed as PushSendResult.
 *
 * Singleton guard:
 *  Firebase Admin SDK only allows one app initialisation per app name.
 *  The constructor checks admin.apps.length before calling initializeApp().
 *  In the unlikely event another module has already initialised Firebase,
 *  the existing app is reused.
 *
 * Service account path resolution (monorepo-aware):
 *  `serviceAccountPath` may be absolute or relative.
 *  For relative paths the following locations are tried in order:
 *   1. process.cwd()          — works when `nest start` is invoked from apps/api/
 *   2. apps/api/ root via __dirname — works when invoked from the monorepo root
 *  This makes the path robust regardless of which directory the developer runs
 *  the start command from.
 *
 * Migration from StubPushProvider:
 *  Change the PUSH_PROVIDER factory in NotificationModule to detect
 *  FIREBASE_SERVICE_ACCOUNT_PATH and return this class. No changes needed
 *  in PushChannelService or anywhere else.
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
    const resolvedPath = FirebasePushProvider.resolveKeyPath(serviceAccountPath);

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
      } catch (err) {
        // Propagate as a descriptive startup error so the developer sees exactly
        // what went wrong rather than a cryptic module-not-found or JSON parse error.
        throw new Error(
          `FirebasePushProvider: Failed to initialise Firebase Admin SDK from ` +
            `"${resolvedPath}": ${(err as Error).message}. ` +
            `Check the FIREBASE_SERVICE_ACCOUNT_PATH value in your .env file.`,
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

  async send(options: PushSendOptions): Promise<PushSendResult> {
    const { tokens, title, body, data } = options;

    try {
      // sendEachForMulticast sends one FCM request per token but batches the HTTP
      // round-trips. It returns a BatchResponse with per-token SendResponse objects,
      // giving us granular error codes for invalid-token classification.
      const message: MulticastMessage = {
        tokens,
        notification: { title, body },
      };
      // Attach structured data only when present (FCM rejects empty data object)
      if (data && Object.keys(data).length > 0) {
        message.data = data;
      }

      const batchResponse = await getMessaging(this.app).sendEachForMulticast(message);

      // Classify per-token results
      const invalidTokens: string[] = [];
      batchResponse.responses.forEach((r, index) => {
        if (!r.success && r.error) {
          const code = r.error.code;
          if (FCM_INVALID_TOKEN_CODES.has(code)) {
            // Stale or unregistered token — deactivate immediately
            invalidTokens.push(tokens[index]);
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
