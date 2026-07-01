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

/**
 * RabbitMqPublisher — durable, confirm-backed publisher for domain events.
 *
 * Design (migration plan §5.2, §5.3):
 *  - amqp-connection-manager maintains the connection and auto-reconnects.
 *  - The channel is a CONFIRM channel: `channel.publish()` resolves only after
 *    the broker acknowledges the message. The outbox relay marks a row published
 *    ONLY after this promise resolves, so a confirm is required before we ever
 *    consider an event delivered.
 *  - The topic exchange is asserted in `setup` so it is re-declared on every
 *    (re)connect; messages are persistent.
 *
 * The publisher does not own retry/backoff — that is the outbox relay's job. A
 * failed publish (no confirm) rejects, and the relay reschedules the row.
 */
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
      // We serialise the envelope ourselves (Buffer) for explicit control.
      json: false,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(DOMAIN_EVENTS_EXCHANGE, 'topic', {
          durable: true,
        });
      },
    });
  }

  /**
   * Publishes one envelope to the topic exchange using its `eventType` as the
   * routing key. Resolves on broker confirm; rejects on failure/timeout so the
   * caller (relay) can reschedule.
   */
  async publish(envelope: DomainEventEnvelope): Promise<void> {
    const body = Buffer.from(JSON.stringify(envelope));

    await this.channel.publish(
      DOMAIN_EVENTS_EXCHANGE,
      envelope.eventType,
      body,
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
    // Graceful shutdown: stop accepting, flush in-flight confirms, then close.
    try {
      await this.channel?.close();
    } finally {
      await this.connection?.close();
    }
  }
}
