import { z } from 'zod';

const stringToBoolean = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .default(defaultValue ? 'true' : 'false')
    .transform((value) =>
      ['1', 'true', 'yes'].includes(value.trim().toLowerCase()),
    );

/**
 * Payment service environment schema. Validated at startup (fail-fast).
 *
 * The Payment DB owns `payment_transactions` and its transactional outbox/inbox.
 * Ordering reaches attempt lifecycle operations over TCP; the gateway forwards
 * VNPay callbacks/returns to TCP while preserving the public URLs.
 */
const schema = z.object({
  NODE_ENV: z.string().default('development'),

  // --- Database (Payment owns its own database) ---
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // --- Listeners ---
  PORT: z.coerce.number().int().positive().optional(),
  PAYMENT_TCP_PORT: z.coerce.number().int().positive().default(4051),
  PAYMENT_MANAGEMENT_PORT: z.coerce.number().int().positive().default(4052),

  // --- Internal auth ---
  INTERNAL_AUTH_JWT_SECRET: z
    .string()
    .min(32)
    .default('internal_auth_secret_for_local_dev_only_32_chars'),
  INTERNAL_AUTH_TRUSTED_ISSUERS: z
    .string()
    // uitfood-ordering: the extracted Ordering service signs the checkout-saga
    // create-attempt / mark-failed / cancel service tokens with this issuer.
    .default('uitfood-gateway,uitfood-api,uitfood-ordering'),
  INTERNAL_AUTH_JWT_ISSUER: z.string().min(1).default('uitfood-payment'),
  INTERNAL_AUTH_JWT_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(15)
    .max(300)
    .default(60),

  // --- RabbitMQ domain-event outbox ---
  RABBITMQ_URL: z
    .string()
    .min(1)
    .default('amqp://guest:guest@localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().min(1).default('uitfood.domain-events'),
  RABBITMQ_PREFETCH: z.coerce.number().int().positive().default(10),

  // --- VNPay ---
  VNPAY_TMN_CODE: z.string().trim().min(1).default('STUB_TMN'),
  VNPAY_HASH_SECRET: z.string().trim().min(1).default('STUB_SECRET'),
  VNPAY_URL: z
    .string()
    .url()
    .default('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
  VNPAY_RETURN_URL: z
    .string()
    .url()
    .default('http://localhost:8080/api/payments/vnpay/return'),
  MOBILE_PAYMENT_RETURN_URL: z
    .string()
    .url()
    .default('uitfood://payment/vnpay-return'),
  PAYMENT_SESSION_TIMEOUT_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(1800),
  VNPAY_REFUND_ENABLED: stringToBoolean(false),
  VNPAY_API_URL: z
    .string()
    .url()
    .default('https://sandbox.vnpayment.vn/merchant_webapi/api/transaction'),
  VNPAY_REFUND_MAX_RETRIES: z.coerce.number().int().positive().default(5),
});

export type Env = z.infer<typeof schema>;

export function validate(config: Record<string, unknown>): Env {
  const result = schema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Payment environment is invalid: ${issues}`);
  }
  return result.data;
}
