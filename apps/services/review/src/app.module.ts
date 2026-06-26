import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validate } from '@/config/env.schema';
import { DatabaseModule } from '@/drizzle/database.module';
import { AuthModule } from '@/auth/auth.module';
import { MessagingModule } from '@/messaging/messaging.module';
import { OrderingClientModule } from '@/integration/ordering/ordering-client.module';
import { ReviewModule } from '@/review/review.module';
import { RpcModule } from '@/rpc/rpc.module';
import { ManagementController } from '@/management/management.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    MessagingModule,
    OrderingClientModule,
    ReviewModule,
    RpcModule,
  ],
  controllers: [ManagementController],
})
export class AppModule {}
