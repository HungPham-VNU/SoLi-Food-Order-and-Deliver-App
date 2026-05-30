import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter(process.env.OTEL_SERVICE_NAME ?? 'uitfood-api');

export const ordersPlacedCount = meter.createCounter(
  'api.domain.orders.placed',
  {
    description: 'Total orders placed successfully',
  },
);

export const paymentFailuresCount = meter.createCounter(
  'api.domain.payment.failures',
  {
    description: 'Total payment failures',
  },
);

export function recordOrderPlaced(
  attributes: Record<string, string | number> = {},
) {
  ordersPlacedCount.add(1, attributes);
}

export function recordPaymentFailure(
  attributes: Record<string, string | number> = {},
) {
  paymentFailuresCount.add(1, attributes);
}
