-- Migration: 0013_promotion_checkout.sql
-- Purpose:   Phase PR-3 — Ordering Integration (Checkout)
--
-- Changes:
--   1. orders.discount_amount (integer, NOT NULL, default 0)
--      Records the total promotion discount applied at checkout (VND, integer).
--      Satisfies the invariant: totalAmount = itemsTotal + shippingFee - discountAmount.
--      Used for receipts, refund calculations, and analytics.
--
-- Concurrency notes:
--   The column default of 0 ensures all existing orders (pre-PR-3) remain valid.
--   All amounts are integer VND — no decimal precision changes required.
---------------------------------------------------------------------------

ALTER TABLE "orders" ADD COLUMN "discount_amount" integer NOT NULL DEFAULT 0;
