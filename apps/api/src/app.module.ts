import { Module, NestModule, MiddlewareConsumer, Logger } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Env } from './config/env.schema';
import { isDevOrTestEnv } from './lib/environment';
import { DatabaseModule } from './drizzle/drizzle.module';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './lib/auth';
import { RestaurantCatalogModule } from './module/restaurant-catalog/restaurant-catalog.module';
import { RedisModule } from './lib/redis/redis.module';
import { OrderingModule } from './module/ordering/ordering.module';
import { DevTestUserMiddleware } from './lib/dev-test-user.middleware';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymentModule } from './module/payment/payment.module';
import { NotificationModule } from './module/notification/notification.module';
import { ImageModule } from './module/image/image.module';
import { PromotionModule } from './module/promotion/promotion.module';
import { AdminAnalyticsModule } from './module/admin-analytics/admin-analytics.module';
import { ReviewModule } from './module/review/review.module';
import { validate } from './config/env.schema';
import { vnpayConfig } from './config/vnpay.config';
import { ObservabilityInterceptor } from './observability/observability.interceptor';
import { MessagingModule } from './messaging/messaging.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [vnpayConfig],
      validate,
    }),
    DatabaseModule,
    RedisModule,
    ScheduleModule.forRoot(),
    MessagingModule,
    RestaurantCatalogModule,
    PromotionModule,
    AdminAnalyticsModule,
    OrderingModule,
    PaymentModule,
    NotificationModule,
    ImageModule,
    ReviewModule,

    AuthModule.forRoot({
      auth,
      bodyParser: {
        json: { limit: '2mb' },
        urlencoded: { limit: '2mb', extended: true },
        rawBody: true,
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ObservabilityInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  private readonly logger = new Logger(AppModule.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  configure(consumer: MiddlewareConsumer) {
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });

    // SECURITY (Phase 0): only register the synthetic-auth middleware in the
    // dev/test allowlist. In production (or any unrecognized env) the
    // middleware is never wired into the request pipeline at all, so the
    // x-test-user-id header has no effect. The middleware additionally
    // self-guards (see DevTestUserMiddleware) as defense-in-depth.
    if (!isDevOrTestEnv(nodeEnv)) {
      this.logger.log(
        `DevTestUserMiddleware not registered (NODE_ENV=${nodeEnv ?? '(unset)'}).`,
      );
      return;
    }

    // DEV / TEST ONLY: populate req.user from x-test-user-id header
    consumer.apply(DevTestUserMiddleware).forRoutes('*');
  }
}
