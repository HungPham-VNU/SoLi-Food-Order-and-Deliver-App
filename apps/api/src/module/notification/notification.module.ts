import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { IdentityModule } from '@/module/auth/identity.module';
import { RedisModule } from '@/lib/redis/redis.module';

// ACL
import { NotificationRestaurantAclRepository } from './acl/notification-restaurant-acl.repository';
import { NotificationRestaurantSnapshotProjector } from './acl/notification-restaurant-snapshot.projector';

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
import { NotificationGateway } from './gateway/notification.gateway';

// Controller (Phase N-3)
import { NotificationController } from './controllers/notification.controller';

// Services
import { TestPushService } from './services/test-push.service';
import { TestEmailService } from './services/test-email.service';

// Event Handlers
import { OrderPlacedNotificationHandler } from './events/order-placed.handler';
import { OrderStatusChangedNotificationHandler } from './events/order-status-changed.handler';
import { PaymentConfirmedNotificationHandler } from './events/payment-confirmed.handler';
import { PaymentFailedNotificationHandler } from './events/payment-failed.handler';
import { OrderCancelledAfterPaymentNotificationHandler } from './events/order-cancelled-after-payment.handler';
import { ReviewSubmittedNotificationHandler } from './events/review-submitted.handler';

/**
 * NotificationModule — Phase N-4 Multi-Channel Delivery
 *
 * Implements the Notification BC as a non-global NestJS module.
 * Imported explicitly by the application composition root.
 *
 * Phase N-4 additions over N-3:
 *  - ChannelDispatcherService: routes persisted notification rows to the
 *    appropriate channel adapter (in_app / email / push) and records
 *    delivery attempts to notification_delivery_logs.
 *  - InAppChannelService: WebSocket emit + unread cache invalidation
 *    (extracted from NotificationService for pluggable architecture).
 *  - EmailChannelService + EmailTemplateService: HTML email via Nodemailer.
 *    Provider binding is dynamic: NodemailerEmailProvider when SMTP_HOST is
 *    set, NoopEmailProvider otherwise (dev/test/CI safe degradation).
 *  - PushChannelService + StubPushProvider: push notification fan-out.
 *    StubPushProvider logs but does not call FCM (firebase-admin not yet
 *    installed). Swap PUSH_PROVIDER binding to FirebasePushProvider for prod.
 *  - NotificationController: 2 new preference routes + 2 push token routes.
 *    GET  /api/notifications/my/preferences
 *    PATCH /api/notifications/my/preferences
 *    POST  /api/notifications/my/push-tokens
 *    DELETE /api/notifications/my/push-tokens
 *  - NotificationService: registerPushToken, removePushToken, getPreferences,
 *    updatePreferences.
 *  - sendFromEvent() now delegates all channel dispatch to ChannelDispatcherService
 *    (fire-and-forget) instead of handling in-app WebSocket inline.
 *  - Event handlers updated: payment_confirmed, order_delivered, order_cancelled
 *    now include the 'email' channel.
 *
 * EMAIL_PROVIDER factory:
 *  Uses ConfigService to check if SMTP_HOST is configured. When set, binds
 *  NodemailerEmailProvider. When absent, binds NoopEmailProvider which logs
 *  a warning and records SMTP_NOT_CONFIGURED delivery failures (observable
 *  via notification_delivery_logs).
 *
 * PUSH_PROVIDER:
 *  Currently bound to StubPushProvider (no firebase-admin dependency).
 *  Future: bind to FirebasePushProvider in a production environment profile.
 *
 * CqrsModule: required for @EventsHandler-decorated classes.
 * ConfigModule: re-imported to make ConfigService available in factory fns.
 * DatabaseModule: provides DB_CONNECTION to all repositories.
 * RedisModule is imported explicitly for presence and unread-count caching.
 * ScheduleModule: imported in AppModule — @Interval on gateway works here.
 */
@Module({
  imports: [
    CqrsModule,
    DatabaseModule,
    ConfigModule,
    IdentityModule,
    RedisModule,
  ],
  controllers: [NotificationController],
  providers: [
    // --- ACL ---
    NotificationRestaurantAclRepository,
    NotificationRestaurantSnapshotProjector,

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

    // --- Event Handlers ---
    OrderPlacedNotificationHandler,
    OrderStatusChangedNotificationHandler,
    PaymentConfirmedNotificationHandler,
    PaymentFailedNotificationHandler,
    OrderCancelledAfterPaymentNotificationHandler,
    ReviewSubmittedNotificationHandler,
  ],
  exports: [],
})
export class NotificationModule {}
