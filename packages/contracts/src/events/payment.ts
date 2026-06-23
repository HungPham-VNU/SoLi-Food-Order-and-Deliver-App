import { z } from 'zod';
import { EVENT_NAMES } from '../event-names';

/** payment.confirmed.v1 */
export const paymentConfirmedV1Payload = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  provider: z.literal('vnpay'),
  amount: z.number().int().nonnegative(),
  providerTxnId: z.string(),
  confirmedAt: z.string(),
});
export type PaymentConfirmedV1Payload = z.infer<
  typeof paymentConfirmedV1Payload
>;

export const PAYMENT_CONFIRMED_V1 = {
  eventType: EVENT_NAMES.PaymentConfirmed,
  eventVersion: 1,
  schema: paymentConfirmedV1Payload,
} as const;

/** payment.failed.v1 */
export const paymentFailedV1Payload = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  provider: z.literal('vnpay'),
  reason: z.string().min(1),
  failedAt: z.string(),
});
export type PaymentFailedV1Payload = z.infer<typeof paymentFailedV1Payload>;

export const PAYMENT_FAILED_V1 = {
  eventType: EVENT_NAMES.PaymentFailed,
  eventVersion: 1,
  schema: paymentFailedV1Payload,
} as const;
