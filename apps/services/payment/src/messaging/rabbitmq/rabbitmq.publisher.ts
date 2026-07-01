import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import amqp, {
  type AmqpConnectionManager,
  type ChannelWrapper,
} from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import type { DomainEventEnvelope } from '@uitfood/contracts';
import { DOMAIN_EVENTS_EXCHANGE, RABBITMQ_URL } from './rabbitmq.constants';

@Injectable()
export class RabbitMqPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqPublisher.name);
  private connection!: AmqpConnectionManager;
  private channel!: ChannelWrapper;

  onModuleInit(): void {
    this.connection = amqp.connect([RABBITMQ_URL]);
    this.connection.on('connect', () =>
      this.logger.log(`Connected to RabbitMQ (${DOMAIN_EVENTS_EXCHANGE})`),
    );
    this.connection.on('disconnect', ({ err }) =>
      this.logger.warn(`RabbitMQ disconnected: ${err?.message ?? 'unknown'}`),
    );

    this.channel = this.connection.createChannel({
      json: false,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(DOMAIN_EVENTS_EXCHANGE, 'topic', {
          durable: true,
        });
      },
    });
  }

  async publish(envelope: DomainEventEnvelope): Promise<void> {
    await this.channel.publish(
      DOMAIN_EVENTS_EXCHANGE,
      envelope.eventType,
      Buffer.from(JSON.stringify(envelope)),
      {
        contentType: 'application/json',
        persistent: true,
        messageId: envelope.eventId,
        correlationId: envelope.correlationId,
        type: envelope.eventType,
        timestamp: Date.parse(envelope.occurredAt) || Date.now(),
        headers: {
          'x-event-version': envelope.eventVersion,
          'x-aggregate-id': envelope.aggregateId,
          'x-aggregate-version': envelope.aggregateVersion,
          ...(envelope.traceparent
            ? { traceparent: envelope.traceparent }
            : {}),
          ...(envelope.causationId
            ? { 'x-causation-id': envelope.causationId }
            : {}),
        },
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
    } finally {
      await this.connection?.close();
    }
  }
}
