# ASR FoodDelivery Review Notes

## Removed mappings

- Removed UC-30 from QA-P-01 because restaurant search performance is implemented in `restaurant-catalog/search`, while admin order monitoring uses the order-history query layer.
- Removed UC-13 from QA-CI-01 because restaurant/menu availability is not the order-status vocabulary.
- Removed Review BC and `RestaurantRatingChangedEvent` mappings from UC-3 and UC-22; no review/rating backend exists.
- Removed shipper-application state-machine mappings from UC-16 and UC-28; no `shipper_applications` table, controller, service, or event exists.
- Removed Cloudinary from QA-A-03 optional degradation; image configuration fails fast when credentials are absent.
- Removed generic non-VNPay provider claims from QA-FL-01; the existing port is a boundary but still exposes `initiateVNPayPayment`.
- Removed broad WebSocket horizontal-scaling claims; Redis presence does not provide Socket.IO cross-instance room fan-out.
- Removed `OrderTimeoutTask` as evidence for stuck-order diagnostics; it auto-cancels expired orders but does not surface diagnostic flags.
- Removed UC-3 mappings to QA-P-04 / QA-MA-01. Restaurant detail is a Catalog-owned read; checkout snapshot propagation belongs to UC-7, UC-12, and UC-13.
- Removed the mobile unread-count polling overclaim. `useUnreadCount()` defines a 60-second poll but is not wired to any component; mobile currently has Socket.IO notifications plus on-demand inbox fetch.

## Added mappings

- Added UC-18 to QA-R-03, QA-R-05, QA-SUP-01, QA-CI-01, and QA-CI-02 because T-09 self-assignment is implemented through the shared transition handler.
- Added UC-19 as Implemented and mapped it to QA-R-03, QA-P-02, QA-FL-02, QA-S-03, QA-SUP-01, QA-CI-01, and QA-CI-02.
- Added UC-14 to QA-R-08 because paid restaurant cancellation/rejection paths publish `OrderCancelledAfterPaymentEvent`.
- Added UC-7 to QA-SUP-02 and QA-CI-02 because delivery-zone snapshot updates are in-process events with projector logging.
- Added UC-30 to QA-SUP-03 as the planned admin diagnostic surface.
- Added UC-23 to QA-R-08 after expanding QA-R-08 to cover implemented promotion reservation compensation: confirm after order persistence, rollback after failed placement or cancellation through `PROMOTION_APPLICATION_PORT`.
- Added AD-7 to QA-P-03 so the implemented delivery-radius / Haversine checkout constraint is no longer an orphan driver.

## Rejected relationships

- Rejected “same domain implies trace” mappings. Restaurant/catalog UCs were mapped to QA scenarios only when they exercise a runtime pressure such as search latency, ACL propagation, authorization, or image integration.
- Rejected “planned SRS text implies implemented evidence.” Planned shipper approval, review moderation, operational reports, and admin role management remain planned unless code exists.
- Rejected “presence in Redis implies WebSocket scale-out.” Presence tracking is implemented, but Socket.IO rooms remain process-local without a Redis adapter.
- Rejected “DI token implies provider-neutral payment strategy.” Ordering is decoupled from `PaymentService`, but the port method is VNPay-specific.
- Rejected “approval is an audited state machine.” Restaurant approval is currently `isApproved` boolean approve/unapprove without persisted reason/actor audit rows.
- Rejected UC-24 → QA-CI-01 because QA-CI-01 is specifically the order-status vocabulary, not promotion status. UC-24 remains traced to QA-S-03; its shared Promotion schema/state consistency is documented in the UC row.
- Rejected UC-24 → QA-MA-01 because admin promotion CRUD stays inside Promotion BC and does not exercise an Ordering/Payment/Notification cross-BC boundary.

## Orphan UC found

- UC-16 had no valid implemented evidence after removing fake shipper application mappings; it is retained as Planned and mapped only to QA-S-03.
- UC-22 had no valid implementation evidence after removing Review BC claims; it is retained as Planned and mapped to QA-S-02, QA-S-05, and QA-CI-01 as future constraints.
- UC-28, UC-29, UC-33, and UC-35 are retained as Planned with security/authorization trace only.
- Final §7 state: every §4 ASR UC row has at least one QA mapping.

## Orphan QA found

- QA-SUP-03 had weak evidence; it is now explicitly Planned and mapped to UC-30 only.
- QA-R-05 was previously Planned against a missing delivery-assignment module; source evidence shows T-09 optimistic-lock self-assignment, so it is now Implemented and mapped to UC-18.
- QA-FL-01 was over-implemented; it is now Partial and still mapped to UC-8/UC-9 because the boundary exists but is VNPay-specific.
- Final §7 state: every §3 QA scenario has at least one UC and one architectural driver mapping.
- Final second-pass state: AD-7 is now referenced by QA-P-03; no orphan architectural driver remains in the implemented driver set.

## Driver fixes

- AD-8 now reflects actual restaurant boolean approval and explicitly marks shipper application approval as absent/planned.
- AD-9 now applies to optional notification providers, not Cloudinary.
- AD-4 and QA-SC-01 now distinguish Redis presence from full multi-instance WebSocket delivery.
- AD-5 remains the driver for lifecycle integrity, assignment atomicity, timeout cancellation, and admin overrides.
- QA-SC-01 now maps to AD-4 because the main scale-out risk is real-time WebSocket fan-out; stateless HTTP scaling remains described as a supporting tactic.
- QA-T-01 now maps to AD-1 instead of AD-9 because deterministic checkout/order-placement testing supports exactly-once order creation, not optional notification-provider degradation.
- QA-S-06 now maps to AD-11 instead of AD-9 because rate limiting protects public endpoints and is unrelated to optional notification-channel degradation.

## Evidence fixes

- QA-P-01 evidence now points to `restaurant-catalog/search/search.repository.ts`, not a non-existent Ordering search repository.
- QA-R-05 evidence now points to `transition-order.handler.ts` and `order.schema.ts`.
- QA-A-03 evidence now points to `notification.module.ts` and `channel-dispatcher.service.ts` only.
- QA-I-03 evidence now notes Cloudinary fail-fast credentials through `cloudinary.provider.ts`.
- QA-SUP-02 evidence now distinguishes notification/refund handlers that swallow exceptions from ACL projectors that log and rethrow.
- QA-SUP-03 evidence now states no direct diagnostic implementation exists; `order-timeout.task.ts` is only auto-cancellation evidence.
- QA-R-08 evidence now includes `promotion-rollback-on-cancellation.handler.ts`, `promotion.service.ts`, and `place-order.handler.ts` for implemented promotion compensation.
- QA-T-01 evidence is marked representative rather than exhaustive and points to order, lifecycle, cart, ACL, promotion-checkout, payment, and notification-inbox tests.

## Other ASR corrections

- Earlier ASR rebuild established version 2.5; current official ASR is version 2.6 after second-pass fixes.
- Corrected public browse/search to read Restaurant Catalog source tables directly; Ordering ACL snapshots are used by checkout/lifecycle paths.
- Corrected UC-11 and UC-27 to Partial because restaurant approval lacks persisted admin actor/reason audit and reject-state workflow.
- Corrected UC-18 to Partial because T-09 claim is implemented but online/proximity dispatch offer filtering is not.
- Corrected UC-19 to Implemented because T-10/T-11 delivery transitions and assigned-shipper checks exist.
- Corrected UC-24 audit wording to service logging only, not persistent actor UUID audit.
- Corrected §6 invalid QA labels (`QA-CAT-02 / QA-NOTE-05`) to valid QA taxonomy references.
- Earlier Appendix A mixed UC counts with the QA-S-04 open gap; current Appendix A separates them.
- Final pre-lock audit downgraded remaining overclaims: Redis cluster wording, automatic client polling fallback, stored-XSS scope, multi-pod timeout guarantees, zero-stuck-order diagnostics, fake load/contract/coverage evidence, and unmeasured operational latency/success-rate targets.
- Updated ASR version to 2.6 after second READ → ANALYZE → FIX → CHECK pass.
- Appendix A now counts only §4 functional rows: 20 Implemented + 7 Partial + 6 Planned = 33. QA-S-04 is listed separately as an open QA scenario gap, not as a UC row.
- Added explicit frontend reality note: mobile has notification socket / FCM token / on-demand inbox fetch; mobile order detail has no automatic polling; web order board is mock/local and has no notification socket or live order API integration.

## Final verdict

READY