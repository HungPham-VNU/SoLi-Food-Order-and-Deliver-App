import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { RedisModule } from '@/lib/redis/redis.module';

// ACL
import { NotificationRestaurantAclRepository } from './acl/notification-restaurant-acl.repository';

// Repositories
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationPreferenceRepository } from './repositories/notification-preference.repository';
import { DeviceTokenRepository } from './repositories/device-token.repository';
import { NotificationDeliveryLogRepository } from './repositories/notification-delivery-log.repository';

// Services
import { NotificationTemplateService } from './services/notification-template.service';
import { NotificationService } from './services/notification.service';
import { ChannelDispatcherService } from './services/channel-dispatcher.service';
import { UserPresenceService } from './services/user-presence.service';
import { QuietHoursService } from './services/quiet-hours.service';

// Tasks (Phase N-5)
import { DeviceTokenCleanupTask } from './tasks/device-token-cleanup.task';

// Channel adapters
import { InAppChannelService } from './channels/in-app/in-app.channel.service';
import { EmailTemplateService } from './channels/email/email-template.service';
import { EmailChannelService } from './channels/email/email.channel.service';
import { EMAIL_PROVIDER } from './channels/email/email-provider.interface';
import { NodemailerEmailProvider } from './channels/email/nodemailer-email.provider';
import { NoopEmailProvider } from './channels/email/noop-email.provider';
import { PushChannelService } from './channels/push/push.channel.service';
import { PUSH_PROVIDER } from './channels/push/push-provider.interface';
import { StubPushProvider } from './channels/push/stub-push.provider';
import { FirebasePushProvider } from './channels/push/firebase-push.provider';

// Gateway
import { NotificationGateway } from './gateway/extracted-notification.gateway';

// Services
import { TestPushService } from './services/test-push.service';
import { TestEmailService } from './services/test-email.service';

/**
 * NotificationModule - extracted Notification service
 *
 * Implements the Notification BC as a private service module.
 *  - ChannelDispatcherService: routes persisted notification rows to the
 *    appropriate channel adapter (in_app / email / push) and records
 *    delivery attempts to notification_delivery_logs.
 *  - InAppChannelService: WebSocket emit + unread cache invalidation
 *    (extracted from NotificationService for pluggable architecture).
 *  - EmailChannelService + EmailTemplateService: HTML email via Nodemailer.
 *    Provider binding is dynamic: NodemailerEmailProvider when SMTP_HOST is
 *    set, NoopEmailProvider otherwise (dev/test/CI safe degradation).
 *  - PushChannelService: push notification fan-out through Firebase when
 *    credentials are configured, otherwise a safe stub provider.
 *  - NotificationService: registerPushToken, removePushToken, getPreferences,
 *    updatePreferences.
 *  - NotificationGateway: owns /notifications Socket.IO traffic in the
 *    extracted service; the public gateway proxies WebSocket upgrades here.
 *
 * EMAIL_PROVIDER factory:
 *  Uses ConfigService to check if SMTP_HOST is configured. When set, binds
 *  NodemailerEmailProvider. When absent, binds NoopEmailProvider which logs
 *  a warning and records SMTP_NOT_CONFIGURED delivery failures (observable
 *  via notification_delivery_logs).
 *
 * PUSH_PROVIDER:
 *  Uses FirebasePushProvider when FIREBASE_SERVICE_ACCOUNT_PATH is set.
 *  Otherwise binds StubPushProvider for CI/CD, tests, and local dev.
 *
 * ConfigModule: re-imported to make ConfigService available in factory fns.
 * DatabaseModule: provides DB_CONNECTION to all repositories.
 * RedisModule is imported explicitly for presence and unread-count caching.
 */
@Module({
  imports: [DatabaseModule, ConfigModule, RedisModule],
  controllers: [],
  providers: [
    // --- ACL ---
    NotificationRestaurantAclRepository,

    // --- Repositories ---
    NotificationRepository,
    NotificationPreferenceRepository,
    DeviceTokenRepository,
    NotificationDeliveryLogRepository,

    // --- Email provider (dynamic — SMTP if configured, Noop otherwise) ---
    {
      provide: EMAIL_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const smtpHost = configService.get<string>('SMTP_HOST');
        // In test environments, always use NoopEmailProvider to avoid real SMTP
        // calls and to produce predictable SMTP_NOT_CONFIGURED delivery failures.
        if (smtpHost && process.env.NODE_ENV !== 'test') {
          return new NodemailerEmailProvider(configService);
        }
        return new NoopEmailProvider();
      },
      inject: [ConfigService],
    },

    // --- Push provider (dynamic — FirebasePushProvider when key path is set, Stub otherwise) ---
    //
    // FirebasePushProvider: wraps firebase-admin sendEachForMulticast().
    //   Requires FIREBASE_SERVICE_ACCOUNT_PATH in env.
    // StubPushProvider: no-op logger (safe for CI/CD, unit tests, and local dev
    //   without Firebase credentials).
    // NOTE: StubPushProvider is always used in test environments (NODE_ENV=test)
    //   to avoid real FCM calls in E2E tests.
    {
      provide: PUSH_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const keyPath = configService.get<string>(
          'FIREBASE_SERVICE_ACCOUNT_PATH',
        );
        if (keyPath && process.env.NODE_ENV !== 'test') {
          return new FirebasePushProvider(keyPath);
        }
        return new StubPushProvider();
      },
      inject: [ConfigService],
    },

    // --- Channel adapters ---
    InAppChannelService,
    EmailTemplateService,
    EmailChannelService,
    PushChannelService,

    // --- Services ---
    NotificationTemplateService,
    UserPresenceService,
    QuietHoursService,
    ChannelDispatcherService,
    NotificationService,
    TestPushService,
    TestEmailService,

    // --- Scheduled tasks (Phase N-5) ---
    DeviceTokenCleanupTask,

    // --- Gateway (Phase N-2) ---
    NotificationGateway,
  ],
  exports: [
    NotificationRestaurantAclRepository,
    NotificationPreferenceRepository,
    NotificationRepository,
    DeviceTokenRepository,
    NotificationService,
    TestPushService,
    TestEmailService,
  ],
})
export class NotificationModule {}
