import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/database.module';
import { RabbitMqPublisher } from './rabbitmq/rabbitmq.publisher';
import { OutboxRelayService } from './outbox/outbox-relay.service';

@Module({
  imports: [DatabaseModule],
  providers: [OutboxRelayService, RabbitMqPublisher],
})
export class MessagingModule {}
