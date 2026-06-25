/** DI token for the publisher (eases testing/mocking). */
export const RABBITMQ_PUBLISHER = Symbol('RABBITMQ_PUBLISHER');

/** Durable topic exchange all domain events are published to. */
export const DOMAIN_EVENTS_EXCHANGE =
  process.env.RABBITMQ_EXCHANGE ?? 'uitfood.domain-events';

/** Connection URL (amqp[s]://user:pass@host/vhost). */
export const RABBITMQ_URL =
  process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
