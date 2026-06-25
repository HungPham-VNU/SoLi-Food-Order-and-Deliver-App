import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validate } from '@/config/env.schema';
import { DatabaseModule } from '@/drizzle/database.module';
import { ManagementController } from '@/management/management.controller';
import { MessagingModule } from '@/messaging/messaging.module';

/**
 * Catalog service root module.
 *
 * Foundation wired: validated config, Catalog database, management HTTP, and the
 * messaging runtime (outbox relay + RabbitMQ publisher/consumer + inbox).
 *
 * Subsequent steps add the domain modules (restaurant, menu, modifiers, zones,
 * nutrition, dietary-tags, search), their `@MessagePattern` RPC controllers, the
 * Identity/Media TCP client adapters, and the inbound review-rating consumer.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    MessagingModule,
  ],
  controllers: [ManagementController],
})
export class AppModule {}
