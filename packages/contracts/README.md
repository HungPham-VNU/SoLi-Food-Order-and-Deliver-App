# @uitfood/contracts

Versioned **wire contracts** shared across the gateway and services: the domain-
event envelope, per-event payload schemas, and the event-name registry.

**This package contains NO domain logic and NO persistence.** It must never
import a Drizzle table, a repository, a NestJS provider, or a database client.
It holds only: TypeScript types, zod schemas, and constants. A shared *domain*
library would recreate the monolith at compile time (migration plan §6).

## Structure

```
src/
├── envelope.ts        # DomainEventEnvelope<T> + zod schema + createEnvelope()
├── event-names.ts     # EVENT_NAMES — versioned routing keys (the eventType values)
├── events/            # per-event payload schemas + types (one file per context)
│   ├── review.ts
│   ├── ordering.ts
│   └── payment.ts
└── index.ts           # re-exports + EVENT_PAYLOAD_SCHEMAS registry
```

## Envelope

Every message on the bus uses the same envelope; only `payload` differs:

```jsonc
{
  "eventId": "uuid",            // idempotency key for consumers
  "eventType": "review.submitted.v1",  // routing key + payload selector
  "eventVersion": 1,
  "aggregateId": "uuid",
  "aggregateVersion": 12,       // per-aggregate ordering/staleness
  "occurredAt": "2026-06-23T10:00:00.000Z",
  "producer": "monolith",
  "correlationId": "uuid",
  "causationId": "uuid-or-null",
  "traceparent": "W3C-trace-context-or-null",
  "payload": { /* event-specific, self-contained */ }
}
```

## Versioning rules

- Never change a payload incompatibly. Add `…​.v2` and publish both during the
  migration window; retire `v1` once all consumers have moved.
- Payloads must be self-contained — a consumer must never need to call back into
  the producer's database to act on an event.
- `EVENT_PAYLOAD_SCHEMAS` maps every event name to a schema; the CI contract gate
  asserts the map is total.

## Usage

```ts
import { createEnvelope, EVENT_NAMES, REVIEW_SUBMITTED_V1 } from '@uitfood/contracts';

const envelope = createEnvelope({
  ...REVIEW_SUBMITTED_V1,                 // eventType + eventVersion
  aggregateId: review.id,
  aggregateVersion: 0,
  producer: 'monolith',
  payload: { reviewId, orderId, customerId, restaurantId, stars, submittedAt },
});
```
