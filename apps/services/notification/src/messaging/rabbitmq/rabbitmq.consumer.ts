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
  queue: string;
  routingKeys: string[];
  prefetch?: number;
  handler: (envelope: DomainEventEnvelope) => Promise<void>;
}

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
        for (const routingKey of opts.routingKeys) {
          await ch.bindQueue(opts.queue, DOMAIN_EVENTS_EXCHANGE, routingKey);
        }
        await ch.prefetch(opts.prefetch ?? 10);
        await ch.consume(opts.queue, (msg) => {
          void this.handleMessage(channel, opts, msg);
        });
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
      envelope = envelopeSchema.parse(JSON.parse(msg.content.toString()));
    } catch (error) {
      this.logger.error(
        `Rejecting unparseable message on ${opts.queue}: ${(error as Error).message}`,
      );
      channel.nack(msg, false, false);
      return;
    }

    try {
      await opts.handler(envelope);
      channel.ack(msg);
    } catch (error) {
      this.logger.error(
        `Handler failed on ${opts.queue} for eventId=${envelope.eventId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      channel.nack(msg, false, false);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled(this.channels.map((channel) => channel.close()));
    await this.connection?.close();
  }
}
