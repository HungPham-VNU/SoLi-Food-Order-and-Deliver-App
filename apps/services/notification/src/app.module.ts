import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validate } from '@/config/env.schema';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { RedisModule } from '@/lib/redis/redis.module';
import { IdentityClientModule } from '@/identity/identity-client.module';
import { MessagingModule } from '@/messaging/messaging.module';
import { ManagementController } from '@/management/management.controller';
import { NotificationModule } from '@/notification/notification.module';
import { NotificationRpcController } from '@/rpc/notification-rpc.controller';
import { InternalAuthService } from '@/auth/internal-auth.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    IdentityClientModule,
    NotificationModule,
    MessagingModule,
  ],
  controllers: [ManagementController, NotificationRpcController],
  providers: [InternalAuthService],
})
export class AppModule {}
