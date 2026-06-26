# Promotion service

Private NestJS service that owns the `promotions`, `coupon_codes`, and
`promotion_usages` tables and the checkout discount lifecycle. Runtime traffic
enters through versioned Nest TCP patterns in `@uitfood/contracts`
(`PROMOTION_RPC_PATTERNS`); only `/live` and `/ready` are exposed on the
separate management HTTP port.

TCP surface (Phase 7 — Promotion wave):

- `promotion.discount.preview.v1` — read-only eligibility + discount preview.
- `promotion.discount.reserve.v1` — atomically reserve a discount for a pending
  order (increments usage counters, writes a `reserved` usage row).
- `promotion.reservation.confirm.v1` — transition reservations to `confirmed`.
- `promotion.reservation.rollback.v1` — roll back reservations + decrement
  counters.
- `promotion.list-active.v1` — public active-promotion discovery (anonymous).

Every lifecycle call carries a short-lived internal JWT with `aud=promotion`.
The monolith Ordering BC drives reserve/confirm/rollback over TCP; the gateway
exposes `/api/promotions/*` for the public preview/list.

Local setup:

```powershell
$env:DATABASE_URL = 'postgresql://uitfood_promotion:promotion_secret@localhost:5432/uitfood_promotion'
pnpm --filter promotion run db:migrate
pnpm --filter promotion run dev
```

A stale `reserved` usage older than 15 minutes is released by the in-service
`PromotionReservationCleanupTask` (runs every minute).
