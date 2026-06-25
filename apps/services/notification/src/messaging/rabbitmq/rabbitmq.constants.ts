export const DOMAIN_EVENTS_EXCHANGE =
  process.env.RABBITMQ_EXCHANGE ?? 'uitfood.domain-events';

export const RABBITMQ_URL =
  process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
