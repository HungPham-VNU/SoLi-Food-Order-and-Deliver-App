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

## Added mappings

- Added UC-18 to QA-R-03, QA-R-05, QA-SUP-01, QA-CI-01, and QA-CI-02 because T-09 self-assignment is implemented through the shared transition handler.
- Added UC-19 as Implemented and mapped it to QA-R-03, QA-P-02, QA-FL-02, QA-S-03, QA-SUP-01, QA-CI-01, and QA-CI-02.
- Added UC-14 to QA-R-08 because paid restaurant cancellation/rejection paths publish `OrderCancelledAfterPaymentEvent`.
- Added UC-7 to QA-SUP-02 and QA-CI-02 because delivery-zone snapshot updates are in-process events with projector logging.
- Added UC-30 to QA-SUP-03 as the planned admin diagnostic surface.

## Rejected relationships

- Rejected “same domain implies trace” mappings. Restaurant/catalog UCs were mapped to QA scenarios only when they exercise a runtime pressure such as search latency, ACL propagation, authorization, or image integration.
- Rejected “planned SRS text implies implemented evidence.” Planned shipper approval, review moderation, operational reports, and admin role management remain planned unless code exists.
- Rejected “presence in Redis implies WebSocket scale-out.” Presence tracking is implemented, but Socket.IO rooms remain process-local without a Redis adapter.
- Rejected “DI token implies provider-neutral payment strategy.” Ordering is decoupled from `PaymentService`, but the port method is VNPay-specific.
- Rejected “approval is an audited state machine.” Restaurant approval is currently `isApproved` boolean approve/unapprove without persisted reason/actor audit rows.

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

## Driver fixes

- AD-8 now reflects actual restaurant boolean approval and explicitly marks shipper application approval as absent/planned.
- AD-9 now applies to optional notification providers, not Cloudinary.
- AD-4 and QA-SC-01 now distinguish Redis presence from full multi-instance WebSocket delivery.
- AD-5 remains the driver for lifecycle integrity, assignment atomicity, timeout cancellation, and admin overrides.

## Evidence fixes

- QA-P-01 evidence now points to `restaurant-catalog/search/search.repository.ts`, not a non-existent Ordering search repository.
- QA-R-05 evidence now points to `transition-order.handler.ts` and `order.schema.ts`.
- QA-A-03 evidence now points to `notification.module.ts` and `channel-dispatcher.service.ts` only.
- QA-I-03 evidence now notes Cloudinary fail-fast credentials through `cloudinary.provider.ts`.
- QA-SUP-02 evidence now distinguishes notification/refund handlers that swallow exceptions from ACL projectors that log and rethrow.
- QA-SUP-03 evidence now states no direct diagnostic implementation exists; `order-timeout.task.ts` is only auto-cancellation evidence.

## Other ASR corrections

- Updated ASR version to 2.5 and status to full audited rebuild.
- Corrected public browse/search to read Restaurant Catalog source tables directly; Ordering ACL snapshots are used by checkout/lifecycle paths.
- Corrected UC-11 and UC-27 to Partial because restaurant approval lacks persisted admin actor/reason audit and reject-state workflow.
- Corrected UC-18 to Partial because T-09 claim is implemented but online/proximity dispatch offer filtering is not.
- Corrected UC-19 to Implemented because T-10/T-11 delivery transitions and assigned-shipper checks exist.
- Corrected UC-24 audit wording to service logging only, not persistent actor UUID audit.
- Corrected §6 invalid QA labels (`QA-CAT-02 / QA-NOTE-05`) to valid QA taxonomy references.
- Updated Appendix A counts to 20 Implemented, 7 Partial, 6 Planned, and 1 open security gap.