import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './drizzle/drizzle.module';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './lib/auth';
import { RestaurantCatalogModule } from './module/restaurant-catalog/restaurant-catalog.module';
import { RedisModule } from './lib/redis/redis.module';
import { OrderingModule } from './module/ordering/ordering.module';
import { DevTestUserMiddleware } from './lib/dev-test-user.middleware';
import { GeoModule } from './lib/geo/geo.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [vnpayConfig],
      validate,
    }),
    DatabaseModule,
    RedisModule,
    GeoModule,
    ScheduleModule.forRoot(),
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
  configure(consumer: MiddlewareConsumer) {
    // DEV / TEST ONLY: populate req.user from x-test-user-id header
    consumer.apply(DevTestUserMiddleware).forRoutes('*');
  }
}
