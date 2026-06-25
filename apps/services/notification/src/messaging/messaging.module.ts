import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { NotificationModule } from '@/notification/notification.module';
import { RabbitMqConsumer } from './rabbitmq/rabbitmq.consumer';
import { InboxConsumer } from './inbox/inbox.consumer';
import { NotificationEventConsumer } from './notification-event.consumer';

@Module({
  imports: [ConfigModule, DatabaseModule, NotificationModule],
  providers: [RabbitMqConsumer, InboxConsumer, NotificationEventConsumer],
})
export class MessagingModule {}
