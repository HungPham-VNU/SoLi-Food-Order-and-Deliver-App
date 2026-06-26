import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { validate } from '@/config/env.schema';
import { DatabaseModule } from '@/drizzle/database.module';
import { RedisModule } from '@/lib/redis/redis.module';
import { AuthModule } from '@/auth/auth.module';
import { OrderingModule } from '@/ordering/ordering.module';
import { MessagingModule } from '@/messaging/messaging.module';
import { OrderingRpcModule } from '@/ordering/rpc/ordering-rpc.module';
import { ManagementController } from '@/management/management.controller';

/**
 * Ordering root module.
 *
 * Validated config + CQRS + scheduling + owned Postgres/Redis + internal-auth,
 * the full Ordering bounded context (cart, order, lifecycle, history, analytics,
 * ACL snapshots), the durable messaging module (Catalog snapshot consumers +
 * outbox relay), the TCP RPC surface, and management endpoints.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    CqrsModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    AuthModule,
    OrderingModule,
    MessagingModule,
    OrderingRpcModule,
  ],
  controllers: [ManagementController],
})
export class AppModule {}
