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
import type { Channel, ConsumeMessage } from 'amqplib';
import { type DomainEventEnvelope, envelopeSchema } from '@uitfood/contracts';
import { DOMAIN_EVENTS_EXCHANGE, RABBITMQ_URL } from './rabbitmq.constants';

export interface SubscribeOptions {
  /** Durable, per-consumer queue name, e.g. 'catalog.review-events.v1'. */
  queue: string;
  /** Routing keys to bind, e.g. ['review.submitted.v1']. */
  routingKeys: string[];
  /** Unacked-message window. Default 10. */
  prefetch?: number;
  /** Business handler. Throw to nack (route to DLQ); return to ack. */
  handler: (envelope: DomainEventEnvelope) => Promise<void>;
}

/**
 * RabbitMqConsumer — subscribes durable, per-consumer queues to the domain-event
 * topic exchange (migration plan §5.2).
 *
 * Each subscription declares its own quorum queue bound to the exchange, sets a
 * bounded prefetch, and consumes with MANUAL ack. A message is acked only after
 * its handler succeeds. A malformed (poison) message or a handler failure is
 * nacked with requeue=false so it goes to the configured dead-letter exchange
 * rather than looping forever. (DLX/retry-queue wiring is declared in the broker
 * topology / policies, not here.)
 */
@Injectable()
export class RabbitMqConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConsumer.name);
  private connection!: AmqpConnectionManager;
  private readonly channels: ChannelWrapper[] = [];

  onModuleInit(): void {
    this.connection = amqp.connect([RABBITMQ_URL]);
  }

  subscribe(opts: SubscribeOptions): void {
    const channel = this.connection.createChannel({
      json: false,
      setup: async (ch: Channel) => {
        await ch.assertExchange(DOMAIN_EVENTS_EXCHANGE, 'topic', {
          durable: true,
        });
        await ch.assertQueue(opts.queue, {
          durable: true,
          arguments: { 'x-queue-type': 'quorum' },
        });
        for (const rk of opts.routingKeys) {
          await ch.bindQueue(opts.queue, DOMAIN_EVENTS_EXCHANGE, rk);
        }
        await ch.prefetch(opts.prefetch ?? 10);
        await ch.consume(opts.queue, (msg) =>
          this.handleMessage(channel, opts, msg),
        );
      },
    });
    this.channels.push(channel);
    this.logger.log(
      `Subscribed queue=${opts.queue} keys=[${opts.routingKeys.join(', ')}]`,
    );
  }

  private async handleMessage(
    channel: ChannelWrapper,
    opts: SubscribeOptions,
    msg: ConsumeMessage | null,
  ): Promise<void> {
    if (!msg) return;

    let envelope: DomainEventEnvelope;
    try {
      envelope = envelopeSchema.parse(
        JSON.parse(msg.content.toString()),
      ) as DomainEventEnvelope;
    } catch (err) {
      // Poison message: never parseable. Drop to DLQ; requeue would loop.
      this.logger.error(
        `Rejecting unparseable message on ${opts.queue}: ${(err as Error).message}`,
      );
      channel.nack(msg, false, false);
      return;
    }

    try {
      await opts.handler(envelope);
      channel.ack(msg);
    } catch (err) {
      this.logger.error(
        `Handler failed on ${opts.queue} for eventId=${envelope.eventId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      // requeue=false → dead-letter (retry queues handle backoff in topology).
      channel.nack(msg, false, false);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled(this.channels.map((c) => c.close()));
    await this.connection?.close();
  }
}
