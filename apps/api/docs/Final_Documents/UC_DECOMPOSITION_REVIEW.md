# SRS Use Case Decomposition — Review & Analysis

**Project:** SoLi — Food Order and Delivery Platform
**Document Type:** Use Case Decomposition Review
**Version:** 1.0
**Date:** May 13, 2026
**Reference SRS:** TechMarket SRS v1.0
**Reviewer:** Senior Software / Business Analyst

---

## Table of Contents

1. [Purpose of This Document](#1-purpose-of-this-document)
2. [Reference Standard — TechMarket SRS Format](#2-reference-standard--techmarket-srs-format)
3. [Overall Decomposition Quality Assessment](#3-overall-decomposition-quality-assessment)
4. [Detailed Analysis by Domain](#4-detailed-analysis-by-domain)
   - 4.1 Authentication & Account Management
   - 4.2 Customer
   - 4.3 Restaurant Partner
   - 4.4 Delivery Personnel (Shipper)
   - 4.5 Payment & Notification
   - 4.6 Administration
5. [Identified Gaps — Missing Use Cases](#5-identified-gaps--missing-use-cases)
6. [Naming Convention Review](#6-naming-convention-review)
7. [Suitability for SRS Artifacts](#7-suitability-for-srs-artifacts)
8. [Finalized UC List (36 UCs)](#8-finalized-uc-list-36-ucs)
9. [Final Assessment Summary](#9-final-assessment-summary)

---

## 1. Purpose of This Document

This document reviews the proposed Use Case decomposition for the SoLi Food
Delivery Platform SRS and records the finalized architectural decisions. It uses the
TechMarket SRS v1.0 as a structural and stylistic reference and evaluates the
decomposition across six dimensions:

- **Granularity** — each UC must be implementable and testable in a reasonable scope
- **Cohesion** — each UC must represent one coherent actor goal
- **Separation of concerns** — overlapping responsibilities between UCs must be eliminated
- **Completeness** — no significant functional area should be left unaddressed
- **Traceability** — each UC must map to a Business Rule (BR), Feature (FE), and User Story (US)
- **Artifact suitability** — each UC must support exactly one Activity Diagram, one Activity Flow, and one Use Case Specification in the TechMarket format

This review does not redesign the underlying business logic. It evaluates only the
structural quality of the UC decomposition as a foundation for writing the SRS.

---

## 2. Reference Standard — TechMarket SRS Format

The TechMarket SRS defines the following per-UC structure, which the SoLi SRS must adopt:

```
┌─────────────────────────────────────────────────────────────┐
│ UC-XX: <Name>                                               │
│  Name         | <Name>                                      │
│  Description  | <One sentence describing the interaction>   │
│  Actor        | <Primary actor>                             │
│  Trigger      | <What causes the UC to begin>               │
│  Pre-condition| <System state required before the UC>       │
│  Post-condition| <System state guaranteed after the UC>     │
├─────────────────────────────────────────────────────────────┤
│ Activities Flow  (UML Activity Diagram)                     │
├─────────────────────────────────────────────────────────────┤
│ Business Rules                                              │
│  Activity Step | BR Code | Description                      │
└─────────────────────────────────────────────────────────────┘
```

Key conventions drawn from the reference:

| Convention | Rule |
|---|---|
| **1:1:1 mapping** | Each FR → exactly 1 UC → exactly 1 Activity Diagram → N Business Rules |
| **Identifier format** | Domain-prefixed sequential identifier (e.g., `AUTH-FR-01`) |
| **Actor requirement** | Every UC must have an explicitly named primary actor; system-only flows require a "System" or "Automated System" actor |
| **Activity Flow** | Numbered steps; alternative paths explicitly labeled as `(A1)`, `(A2)`, etc. |
| **BR table** | Each BR entry references the activity step number and a BR code |
| **Verb in UC name** | UC names use action verbs: "Sign In", "Place Order", "Approve" — not nouns like "Access" or "Management" |

---

## 3. Overall Decomposition Quality Assessment

| Criterion | Rating | Notes |
|---|---|---|
| **Total UC Count (36)** | ✅ Appropriate | 36 UCs for a 4-role, multi-domain platform. AUTH consolidated to 1 infrastructure UC; 2 UCs added (CUS-FR-11, RES-FR-08); Update Restaurant Profile excluded from scope. |
| **Domain Grouping** | ✅ Strong | Clean role-based partitioning. Each domain maps to a distinct actor group. |
| **Granularity** | ✅ Good | All UCs are appropriately scoped — no UC is architecturally overloaded or trivially narrow. |
| **Cohesion** | ✅ Good | Each UC represents one clearly identifiable actor goal with one start trigger. |
| **Naming Consistency** | ✅ Applied | All 6 naming decisions applied: AUTH consolidated, RES-FR-04 renamed, PAY-FR-01 renamed, NOTI-FR-01 renamed, ADM-FR-01 renamed, CUS-FR-05 renamed. |
| **Completeness** | ✅ Complete | CUS-FR-11 (View Order History) and RES-FR-08 (Manage Delivery Zones) added; all BRs have owning UCs. |
| **Business Rule Coverage** | ✅ Good | BR-1 through BR-9 are fully addressable from the finalized UC set. |
| **Traceability Readiness** | ✅ Good | FR identifiers are clean and map directly to BRD Features (FE-1 through FE-11) and User Stories. |

**Verdict:** The decomposition is **finalized and suitable for enterprise/academic SRS**. All naming decisions, scope decisions, and gap additions have been applied.

---

## 4. Detailed Analysis by Domain

### 4.1 Authentication & Account Management (1 UC)

| UC ID | Name | Status |
|---|---|---|
| AUTH-FR-01 | User Authentication | ✅ |

---

#### AUTH-FR-01 — User Authentication

**Purpose:**
Consolidates all credential lifecycle interactions into a single infrastructure UC.
Authentication is a shared concern across all four roles (Customer, Restaurant Partner,
Shipper, Administrator). Role-specific onboarding (restaurant profile creation, shipper
profile creation) occurs in subsequent domain UCs after account creation.

**Decision:** The four original AUTH UCs are merged into one infrastructure-level UC.
Sub-flows are expressed as alternative paths within one Activity Diagram.

**Sub-flows:**

| Label | Sub-flow | Description |
|---|---|---|
| Main | Sign Up | Actor submits email, password, display name. System validates format/uniqueness, creates account, assigns default role. |
| (A1) | Sign In | Actor submits credentials. System validates, issues session token, redirects to role-appropriate home screen. |
| (A2) | Forgot Password | Actor requests reset link. System sends email. Actor submits new password via token URL. System validates token and updates credential. |
| (A3) | Logout | Actor triggers logout. System invalidates session token. |
| (A4) | Session Validation | System verifies session token on each protected request. Returns 401 on expiry or invalidity. |

**Traceability:** FE-1, US-1

---

### 4.2 Customer (11 UCs)

| UC ID | Name | Status |
|---|---|---|
| CUS-FR-01 | Discover Restaurants & Food | ✅ |
| CUS-FR-02 | View Restaurant Details | ✅ |
| CUS-FR-03 | Add Item to Cart | ✅ |
| CUS-FR-04 | Manage Shopping Cart | ✅ |
| CUS-FR-05 | Save & Manage Delivery Addresses | ✅ |
| CUS-FR-06 | Place Order | ✅ |
| CUS-FR-07 | Make Online Payment (VNPay) | ✅ |
| CUS-FR-08 | Track Order Status | ✅ |
| CUS-FR-09 | Cancel Order | ✅ |
| CUS-FR-10 | Submit Rating & Review | ✅ |
| CUS-FR-11 | View Order History | ✅ New |

---

#### CUS-FR-01 — Discover Restaurants & Food

**Purpose:**
Covers the unified search and browse flow: keyword, cuisine type, category, tag, and
optional radius-based location filtering. Returns both restaurant results and menu item
results in a single response. Accent-insensitive text matching applies.

**Assessment:** ✅ Well-scoped. Correctly excludes delivery zone enforcement (BR-3
fires at checkout, not at search time, per the User Stories).

**Traceability:** FE-2, US-2, BR-3 (enforced at checkout)

---

#### CUS-FR-02 — View Restaurant Details

**Purpose:**
Covers navigation to a specific restaurant's profile page: name, description, operating
hours, menu categories, menu items, ratings summary, and available promotions.

**Assessment:** ✅ Defensibly separate from CUS-FR-01. Discovery returns a result list;
viewing details is a distinct navigation interaction with its own data fetch and UI state.
This is the conventional entry point for CUS-FR-03.

**Traceability:** FE-2, US-2

---

#### CUS-FR-03 — Add Item to Cart

**Purpose:**
Covers selecting a menu item (with optional modifier choices), setting quantity, and adding
it to the active cart. The system enforces the single-restaurant constraint (BR-2) at this
step.

**Assessment:** ✅ BR-2 gives this UC its own specific validation logic that distinguishes
it from general cart management. Keeping it separate is correct and necessary for the
Business Rules table.

**Traceability:** FE-3, US-3, **BR-2** (single-restaurant cart constraint)

---

#### CUS-FR-04 — Manage Shopping Cart

**Purpose:**
Covers post-add cart operations: view cart contents and totals, update item quantity,
remove item, and clear cart. Displays the running subtotal before checkout.

**Assessment:** ✅ Clean separation from CUS-FR-03 (add) and CUS-FR-06 (checkout).
The CRUD operations on an existing cart are a distinct interaction group.

**Traceability:** FE-3, US-3

---

#### CUS-FR-05 — Save & Manage Delivery Addresses

**Purpose:**
Covers the full address book CRUD lifecycle: add new address (street, city, district,
optional label), edit existing address fields, set a default address, and delete an address.
Saved addresses are selectable at checkout (CUS-FR-06) to pre-fill the delivery address field.

**Assessment:** ✅ Retained as a standalone UC with persistent address book scope.
The CRUD activity flow is distinct from the checkout flow (CUS-FR-06).

**Traceability:** FE-3

---

#### CUS-FR-06 — Place Order

**Purpose:**
Core checkout UC. Validates the cart, enforces delivery zone eligibility (BR-3), applies
any active promotion or coupon code, calculates the final total
(`items + shipping − discount`), creates the order record, and routes to payment.
For COD: order is confirmed immediately. For VNPay: order is created pending payment
(triggers CUS-FR-07).

**Assessment:** ✅ Critical path UC. The promotion application (PR-3) is correctly treated
as an internal step in this flow rather than a separate UC.

**Traceability:** FE-3, US-3, BR-2, **BR-3** (delivery zone check), BR-4 (payment routing)

---

#### CUS-FR-07 — Make Online Payment (VNPay)

**Purpose:**
Covers the VNPay asynchronous payment flow: redirect customer to VNPay gateway →
customer completes payment → VNPay sends IPN callback → system validates callback
signature → updates order status to confirmed or failed.

**Assessment:** ✅ Justifiably separate from CUS-FR-06. The external actor (VNPay
Gateway) and the asynchronous IPN callback constitute a distinct interaction that would
clutter the Place Order activity flow. This is standard practice in enterprise SRS for
payment gateway integration.

**Traceability:** FE-4, BR-4

---

#### CUS-FR-08 — Track Order Status

**Purpose:**
Covers the customer viewing the current order state (pending → accepted → preparing
→ ready_for_pickup → picked_up → delivering → delivered) with real-time WebSocket
push updates and, where available, the shipper's map location.

**Assessment:** ✅ Well-scoped. Maps to the full order lifecycle (BR-7) from the
customer's perspective.

**Traceability:** FE-5, US-4 (tracking), BR-7

---

#### CUS-FR-09 — Cancel Order

**Purpose:**
Covers customer-initiated order cancellation. The system validates that the order is in
a cancellable state, transitions the order to `cancelled`, triggers promotion usage
rollback (PR-4), and initiates a refund if applicable.

**Assessment:** ✅ Correct as a standalone UC. The promotion rollback and refund
triggers differentiate this from a simple status update.

**Traceability:** FE-3, BR-7

---

#### CUS-FR-10 — Submit Rating & Review

**Purpose:**
Covers the customer submitting a 1–5 star rating and optional text review for a
restaurant after the order reaches `delivered` status.

**Assessment:** ✅ Well-scoped. Standard post-delivery interaction with its own
precondition (delivered order), UI flow, and data persistence.

**Traceability:** FE-9, US-9 (review), SM-3

---

#### CUS-FR-11 — View Order History

**Purpose:**
Covers the customer navigating to the order history screen, viewing a paginated and
filterable list of past and active orders, and opening individual order details.

**Assessment:** ✅ Added. Serves as the mandatory entry point for CUS-FR-10 (Submit
Rating & Review): the customer must locate a `delivered` order here before a review
can be submitted. Supports filtering by order status and date range.

**Traceability:** FE-3, FE-5

---

### 4.3 Restaurant Partner (8 UCs)

| UC ID | Name | Status |
|---|---|---|
| RES-FR-01 | Restaurant Registration | ✅ |
| RES-FR-02 | Add Menu Item | ✅ |
| RES-FR-03 | Update Menu Item | ✅ |
| RES-FR-04 | Toggle Item & Restaurant Availability | ✅ |
| RES-FR-05 | Accept or Reject Order | ✅ |
| RES-FR-06 | Prepare Order for Pickup | ✅ |
| RES-FR-07 | Manage Restaurant Promotions | ✅ |
| RES-FR-08 | Manage Delivery Zones | ✅ New |

---

#### RES-FR-01 — Restaurant Registration

**Purpose:**
Covers the restaurant partner submitting a new business profile (name, address, phone,
description, location coordinates) for platform onboarding. The submission moves the
restaurant into a pending-approval state awaiting admin review (BR-1).

**Assessment:** ✅ Distinct from AUTH-FR-01 (user account creation) and from any
restaurant profile updates made after approval. The approval gate (BR-1) is the
distinguishing business event.

**Traceability:** FE-6, US-10, **BR-1**

---

#### RES-FR-02 — Add Menu Item

**Purpose:**
Covers the restaurant partner creating a new menu item with: name, description, price
(VND integer), category, image URL, tags, and optional modifier groups. The system
validates ownership and price format before persisting.

**Assessment:** ✅ Appropriate granularity. Distinct preconditions (restaurant must exist
and be approved), distinct validation rules, and an identifiable primary actor goal.

**Traceability:** FE-6, US-11, BR-8 (availability defaults to available on creation)

---

#### RES-FR-03 — Update Menu Item

**Purpose:**
Covers the restaurant partner editing an existing menu item's fields. The system validates
ownership and applies the changes. Distinct from Add (different precondition: item must
already exist; different flow: search → select → edit → save).

**Assessment:** ✅ Acceptable at this SRS level. While some SRS styles merge Add and
Update into "Manage Menu Item", keeping them separate maintains a 1:1 UC→Activity
Diagram mapping and produces cleaner Business Rules tables.

**Traceability:** FE-6, US-11

---

#### RES-FR-04 — Toggle Item & Restaurant Availability

**Purpose:**
Covers two parallel availability operations sharing the same trigger, actor, and business
rule (BR-8): (1) marking a specific menu item as `sold_out` (blocks Add to Cart) or
restoring it to `available`; (2) marking the entire restaurant as `closed` (blocks all new
order placement for this restaurant) or reopening it. Both operations propagate to the
customer-facing catalog immediately upon save.

**Assessment:** ✅ Both scenarios share the same trigger, actor, activity flow structure,
and business rule. Consolidated into one UC.

**Traceability:** FE-6, US-11, **BR-8**

---

#### RES-FR-05 — Accept or Reject Order

**Purpose:**
Covers the restaurant partner receiving an incoming order notification and responding
with accept or reject. On acceptance: order transitions to `accepted`. On rejection: order
is cancelled and the customer is notified. This is the first decision point in the restaurant
order workflow.

**Assessment:** ✅ Well-scoped critical business event. The two-path decision (accept/
reject) maps cleanly to a single Activity Diagram with one decision node.

**Traceability:** FE-6, US-12, BR-7

---

#### RES-FR-06 — Prepare Order for Pickup

**Purpose:**
Covers the sequential preparation workflow: `accepted → preparing → ready_for_pickup`.
The restaurant partner updates status at each transition (kitchen started; food is ready).

**Assessment:** ✅ Appropriate grouping. These two sequential transitions represent a
continuous, uninterrupted workflow within the restaurant kitchen. A single Activity
Diagram with two sequential status-update steps captures this clearly without creating
two trivial UCs.

**Traceability:** FE-6, US-12, BR-7

---

#### RES-FR-07 — Manage Restaurant Promotions

**Purpose:**
Covers creating, configuring, pausing, and deleting restaurant-scoped promotions.
Includes configuring promotion type (percentage/fixed), discount value, validity period,
usage limits, and managing coupon code batches for `coupon_code`-triggered promotions.

**Assessment:** ✅ Acceptable at this SRS level. "Manage" is broad but defensible here
because all operations share the same actor goal (operating the restaurant's promotional
calendar) and the activity flow can document the main path (create + activate) with
alternative paths (edit, pause, delete). If the SRS requires maximum granularity, this could
be split into "Create Promotion" and "Manage Coupon Codes" — but that is not necessary
at the current scope.

**Traceability:** FE-10, BR-1 (promotions require restaurant approval first)

---

#### RES-FR-08 — Manage Delivery Zones

**Purpose:**
Covers configuring the restaurant's geographic delivery coverage: creating zones with
name, radius (km), base delivery fee (VND), per-km rate, and estimated delivery time;
editing existing zones; and deleting inactive zones.

**Assessment:** ✅ Added. Zone configuration is the prerequisite for BR-3 enforcement at
checkout. CUS-FR-06 uses zone data to validate delivery eligibility and calculate the
shipping fee presented to the customer.

**Traceability:** FE-3, FE-6, **BR-3**

---

### 4.4 Delivery Personnel / Shipper (4 UCs)

| UC ID | Name | Status |
|---|---|---|
| DEL-FR-01 | Shipper Registration | ✅ |
| DEL-FR-02 | Toggle Availability Status | ✅ |
| DEL-FR-03 | Accept Delivery Assignment | ✅ |
| DEL-FR-04 | Deliver Order | ✅ |

---

#### DEL-FR-01 — Shipper Registration

**Purpose:**
Covers the delivery personnel submitting their profile (personal details, vehicle info,
identification documents) for platform approval. The submission moves the account to
pending state (BR-1).

**Assessment:** ✅ Distinct from AUTH-FR-01. Creates the shipper entity and its
associated profile data, separate from the shared auth account. No changes needed.

**Traceability:** FE-7, US-15, **BR-1**

---

#### DEL-FR-02 — Toggle Availability Status

**Purpose:**
Covers the shipper going online (available to receive dispatch assignments) or offline
(unavailable). This is a necessary precondition for DEL-FR-03 and has a distinct
single-step interaction.

**Assessment:** ✅ Correct as a standalone UC. While simple, the online/offline toggle
has its own precondition (shipper is approved), business significance (affects dispatch
routing), and is a recurring daily interaction. The TechMarket SRS precedent supports
keeping simple but distinct actor actions as separate UCs.

**Traceability:** FE-7, US-15

---

#### DEL-FR-03 — Accept Delivery Assignment

**Purpose:**
Covers the shipper receiving a dispatch notification for an assigned order and responding
accept or decline. On acceptance: shipper is assigned to the order. On decline: the system
re-dispatches to another available shipper.

**Assessment:** ✅ Well-scoped. The accept/decline decision and re-dispatch logic map
cleanly to a single Activity Diagram with a decision node.

**Traceability:** FE-7, US-15, BR-7

---

#### DEL-FR-04 — Deliver Order

**Purpose:**
Covers the delivery lifecycle from pickup to completion: `ready_for_pickup → picked_up
→ delivering → delivered`. The shipper confirms each milestone. On delivery confirmation,
the system records COD collection or marks the VNPay order as settled.

**Assessment:** ✅ Appropriate grouping. These three sequential transitions represent
the continuous active-delivery workflow. A single Activity Diagram with sequential steps
is clean and readable. The UC could optionally be split into "Pick Up Order" and
"Complete Delivery" for finer Activity Diagrams, but this is not required at the current
scope level.

**Traceability:** FE-7, US-15, BR-7, BR-4 (COD settlement at delivery)

---

### 4.5 Payment & Notification (2 UCs)

| UC ID | Name | Status |
|---|---|---|
| PAY-FR-01 | Process Payment Refund | ✅ |
| NOTI-FR-01 | Manage Real-Time Notifications | ✅ |

---

#### PAY-FR-01 — Process Payment Refund

**Purpose:**
Covers reversing the financial transaction when a VNPay-paid order is cancelled or when
a VNPay payment fails and the order is voided. Documents both trigger paths in one UC:
system-triggered (VNPay IPN failure → automatic void + refund) as the main flow, and
admin-triggered (manual dispute resolution) as an alternative flow `(A1)`.

**Decision:** Single UC with dual-actor pattern. Primary actor: Automated System (main
flow) / Administrator (A1). Both paths share the same post-condition (refund initiated,
customer notified) and the same external system interaction (VNPay Gateway).

**Traceability:** FE-4, BR-4

---

#### NOTI-FR-01 — Manage Real-Time Notifications

**Purpose:**
Covers delivering real-time push notifications to all platform roles when order-related
events occur. Customers receive order status updates; restaurant partners receive new
order alerts; shippers receive dispatch notifications; administrators receive escalation
alerts. Primary actor: Automated System.

**Assessment:** ✅ Cross-role UC with primary actor listed as Automated System. Each
recipient role is documented as a specialized notification variant in the activity flow.

**Traceability:** FE-5, US-16

---

### 4.6 Administration (10 UCs)

| UC ID | Name | Status |
|---|---|---|
| ADM-FR-01 | View Dashboard & Platform Overview | ✅ |
| ADM-FR-02 | Approve or Reject Restaurant Applications | ✅ |
| ADM-FR-03 | Approve or Reject Shipper Applications | ✅ |
| ADM-FR-04 | Suspend or Reactivate Partner Accounts | ✅ |
| ADM-FR-05 | Monitor Orders and Platform Health | ✅ |
| ADM-FR-06 | Search and Manage User Accounts | ✅ |
| ADM-FR-07 | Cancel Orders as Administrator | ✅ |
| ADM-FR-08 | View and Export Reports | ✅ |
| ADM-FR-09 | Manage Platform Promotions | ✅ |
| ADM-FR-10 | Manage Admin Roles & Permissions | ✅ |

---

#### ADM-FR-01 — View Dashboard & Platform Overview

**Purpose:**
Covers the administrator's landing view displaying platform KPIs: daily active orders,
revenue summary, new partner applications pending review, active shipper count, and
system health indicators. Displays trend widgets (day-over-day, week-over-week).

**Assessment:** ✅ Distinct from ADM-FR-05 by data mode: this UC shows aggregated
summary figures; ADM-FR-05 shows real-time operational state (live order queue, active
incidents).

**Traceability:** FE-8

---

#### ADM-FR-02 — Approve or Reject Restaurant Applications

**Purpose:**
Covers the admin reviewing a pending restaurant registration: viewing the submitted
business profile, making an approval or rejection decision, and notifying the applicant.
Approval activates the restaurant on the platform; rejection records the reason.

**Assessment:** ✅ Well-scoped. Although similar to ADM-FR-03, the two UCs are
justifiably separate: restaurant applications include business profile fields (address,
cuisine type, operating hours) while shipper applications involve personal identification
data. Distinct data models produce distinct Activity Flows and Business Rules tables.

**Traceability:** FE-8, **BR-1**

---

#### ADM-FR-03 — Approve or Reject Shipper Applications

**Purpose:**
Covers the admin reviewing a pending shipper registration: personal identification,
vehicle information, and background verification. Approval activates the shipper's
ability to receive assignments.

**Assessment:** ✅ Correctly separate from ADM-FR-02 per the justification above.
Maps to BR-1.

**Traceability:** FE-8, **BR-1**

---

#### ADM-FR-04 — Suspend or Reactivate Partner Accounts

**Purpose:**
Covers admin-initiated suspension of an already-approved restaurant partner or shipper
account due to a policy violation, complaint escalation, or manual review. Includes
optional reactivation after remediation.

**Assessment:** ✅ Distinct from ADM-FR-02/03 (which cover initial approval) and from
ADM-FR-06 (which covers user-level account management). The suspend/reactivate
cycle has its own precondition (account is currently approved and active) and business
significance.

**Traceability:** FE-8

---

#### ADM-FR-05 — Monitor Orders and Platform Health

**Purpose:**
Covers the admin's real-time operational view: live order queue with status breakdown,
active shipper GPS positions, delayed-order alerts, and system performance indicators.

**Assessment:** ✅ Correctly distinct from ADM-FR-08 (historical reports) and from
ADM-FR-01 (summary KPI dashboard). Real-time monitoring is a distinct interaction
mode with different data freshness requirements.

**Traceability:** FE-8, SM-4 (delivery time target)

---

#### ADM-FR-06 — Search and Manage User Accounts

**Purpose:**
Covers the admin searching across all registered users (all roles) by name, email, or
role filter; viewing a user's profile and order history; and performing account-level
actions (deactivate, reset password, change role assignment).

**Assessment:** ✅ Acceptable scope. The TechMarket SRS precedent (UC25: Ban account)
supports combining search and account-level actions into one UC since the typical admin
workflow is: search → select user → take action. The activity flow documents this
sequential path clearly.

**Traceability:** FE-8

---

#### ADM-FR-07 — Cancel Orders as Administrator

**Purpose:**
Covers the admin overriding the normal order lifecycle to force-cancel an order regardless
of its current state. Triggered by escalated disputes or platform operations. Triggers
promotion rollback and, if applicable, refund initiation.

**Assessment:** ✅ Correctly separate from CUS-FR-09 (customer self-cancel) because
the actor and authorization level differ. Admin cancellation can override states that are
not customer-cancellable.

**Traceability:** FE-8, BR-7

---

#### ADM-FR-08 — View and Export Reports

**Purpose:**
Covers generating historical performance reports: revenue by period, order volume by
restaurant, partner performance rankings, and platform GMV summary. Supports data
export (CSV / Excel). Maps to BR-5 (commission calculation based on completed order GMV).

**Assessment:** ✅ Well-scoped. Distinct from real-time monitoring (ADM-FR-05):
this UC produces aggregated historical data on demand.

**Traceability:** FE-8, **BR-5** (GMV and commission), SM-2, SM-3

---

#### ADM-FR-09 — Manage Platform Promotions

**Purpose:**
Covers creating, configuring, activating, pausing, and deleting platform-scoped
promotions (scope = "platform", applicable across all restaurants). Distinct from
RES-FR-07 (restaurant-scoped promotions, scope = "restaurant").

**Assessment:** ✅ Correctly separate from RES-FR-07. The actor (Administrator vs.
Restaurant Partner), the promotion scope, and the authorization rules differ. The
activity flows and Business Rules tables are independent.

**Traceability:** FE-10

---

#### ADM-FR-10 — Manage Admin Roles & Permissions

**Purpose:**
Covers the RBAC governance layer: creating and editing admin role definitions, assigning
permissions to roles, and assigning roles to admin users. Ensures the principle of least
privilege is enforceable at the platform management level.

**Assessment:** ✅ Correctly present. A multi-role platform with an admin domain must
explicitly document permission management as a UC for audit and compliance traceability.

**Traceability:** FE-8, US-18 (admin governance)

---

## 5. Identified Gaps — Missing Use Cases

The following UCs were identified as absent from the original proposed list and have
been added to the finalized decomposition:

| ID | Name | Resolution |
|---|---|---|
| **CUS-FR-11** | **View Order History** | ✅ Added. Entry point for CUS-FR-10 (post-delivery review). Activity flow: navigate to order history → apply filters (status, date) → view order details. |
| **RES-FR-08** | **Manage Delivery Zones** | ✅ Added. Underpins BR-3 enforcement at checkout (CUS-FR-06). Zone configuration covers radius, base fee, per-km rate, and estimated delivery time. |

Note: **Update Restaurant Profile** was considered but excluded from scope — it is not
required by the current implementation.

---

## 6. Naming Convention Review

All naming decisions have been applied. The following finalized names are in effect:

| UC ID | Finalized Name | Change Applied |
|---|---|---|
| AUTH-FR-01 | User Authentication | Consolidated (4 UCs → 1 infrastructure UC with sub-flows) |
| CUS-FR-05 | Save & Manage Delivery Addresses | Renamed — persistent address book scope confirmed |
| RES-FR-04 | Toggle Item & Restaurant Availability | Renamed — expanded to cover item-level and restaurant-level |
| PAY-FR-01 | Process Payment Refund | Renamed — dual-actor pattern with system + admin flows |
| NOTI-FR-01 | Manage Real-Time Notifications | Renamed — cross-role scope with Automated System as primary actor |
| ADM-FR-01 | View Dashboard & Platform Overview | Renamed — replaced weak navigation verb |

---

## 7. Suitability for SRS Artifacts

### 7.1 Use Case Specifications (TechMarket Format)

✅ **Well-suited.** Each of the 36 finalized UCs has:
- An identifiable primary actor
- A clear precondition and postcondition
- A start trigger (user action or system event)

The TechMarket UC table (Name / Description / Actor / Trigger / Pre-condition /
Post-condition) is completable for every UC in the list.

---

### 7.2 Activity Diagrams

✅ **Well-suited.** Every UC maps to at least one of these activity structures:

| Structure | Example UCs |
|---|---|
| Linear flow (single path) | AUTH-FR-01 (sub-flows), DEL-FR-02, ADM-FR-01 |
| Decision node (two paths) | RES-FR-05 (accept/reject), DEL-FR-03 (accept/decline), ADM-FR-02 (approve/reject) |
| Sequential multi-step | RES-FR-06 (2 transitions), DEL-FR-04 (3 transitions) |
| External actor interaction | CUS-FR-07 (VNPay async IPN), NOTI-FR-01 (FCM push) |

No UC requires a complex parallel activity flow or swim-lane structure that would be
impractical at this scope level.

---

### 7.3 Sequence Diagrams

✅ **Well-suited** for UCs involving external systems or multi-role coordination:

| UC | Participants in Sequence Diagram |
|---|---|
| CUS-FR-07 | Customer → App → VNPay Gateway → App (IPN) |
| NOTI-FR-01 | System → FCM → Device |
| DEL-FR-03 | System → Shipper → System |
| RES-FR-05 | System → Restaurant Partner → System → Customer (notification) |
| CUS-FR-06 | Customer → App → Promotion Engine → Order Service |

⚠️ ADM-FR-01 (View Dashboard) has limited sequence diagram value if it is purely
a read-only data render with no system state change.

---

### 7.4 Traceability Matrix

✅ **Well-suited.** The domain-prefixed FR identifiers produce clean traceability chains:

```
BR-1 → ADM-FR-02, ADM-FR-03, RES-FR-01, DEL-FR-01
BR-2 → CUS-FR-03
BR-3 → CUS-FR-06, RES-FR-08
BR-4 → CUS-FR-07, PAY-FR-01
BR-5 → ADM-FR-08
BR-7 → CUS-FR-08, RES-FR-05, RES-FR-06, DEL-FR-04
BR-8 → RES-FR-04
BR-9 → (platform exclusion — no FR required; documented as constraint in SRS)
```

Each FR also traces upward to:
- **Vision & Scope Features (FE-1 through FE-11)**
- **Business Objectives (BO-1 through BO-4)**
- **User Stories (US-1 and beyond)**

---

### 7.5 Testing

✅ **Well-suited.** The decomposition granularity aligns with practical E2E test suite design:

| UC Group | Maps to E2E Test Scope |
|---|---|
| AUTH-FR-01 | auth.e2e-spec.ts, acl.e2e-spec.ts |
| CUS-FR-03/04 | cart.e2e-spec.ts |
| CUS-FR-06/07 | order.e2e-spec.ts, payment-phase8.e2e-spec.ts |
| RES-FR-02/03/04 | menu.e2e-spec.ts |
| CUS-FR-06 (promotion) | promotion-checkout.e2e-spec.ts |
| ADM-FR-09, RES-FR-07 | promotion-pr1-pr2.e2e-spec.ts |

No UC is so broad that its test suite would be unmanageable, and no UC is so narrow
that test setup overhead would dominate test execution.

---

## 8. Finalized UC List (36 UCs)

All decisions from Sections 4–6 applied:
- **AUTH consolidated:** 4 UCs → 1 (AUTH-FR-01 — User Authentication with sub-flows)
- **6 renames applied** (AUTH-FR-01, CUS-FR-05, RES-FR-04, PAY-FR-01, NOTI-FR-01, ADM-FR-01)
- **2 UCs added** (CUS-FR-11, RES-FR-08 Manage Delivery Zones)
- **1 UC excluded** (Update Restaurant Profile — out of scope)

### Authentication & Account Management (1 UC)

| UC ID | Name | Change |
|---|---|---|
| AUTH-FR-01 | User Authentication | Consolidated (Sign Up / Sign In / Forgot Password / Logout / Session Validation as sub-flows) |

### Customer (11 UCs)

| UC ID | Name | Change |
|---|---|---|
| CUS-FR-01 | Discover Restaurants & Food | — |
| CUS-FR-02 | View Restaurant Details | — |
| CUS-FR-03 | Add Item to Cart | — |
| CUS-FR-04 | Manage Shopping Cart | — |
| CUS-FR-05 | Save & Manage Delivery Addresses | Renamed |
| CUS-FR-06 | Place Order | — |
| CUS-FR-07 | Make Online Payment (VNPay) | — |
| CUS-FR-08 | Track Order Status | — |
| CUS-FR-09 | Cancel Order | — |
| CUS-FR-10 | Submit Rating & Review | — |
| CUS-FR-11 | View Order History | New |

### Restaurant Partner (8 UCs)

| UC ID | Name | Change |
|---|---|---|
| RES-FR-01 | Restaurant Registration | — |
| RES-FR-02 | Add Menu Item | — |
| RES-FR-03 | Update Menu Item | — |
| RES-FR-04 | Toggle Item & Restaurant Availability | Renamed |
| RES-FR-05 | Accept or Reject Order | — |
| RES-FR-06 | Prepare Order for Pickup | — |
| RES-FR-07 | Manage Restaurant Promotions | — |
| RES-FR-08 | Manage Delivery Zones | New |

### Delivery Personnel (Shipper) (4 UCs)

| UC ID | Name | Change |
|---|---|---|
| DEL-FR-01 | Shipper Registration | — |
| DEL-FR-02 | Toggle Availability Status | — |
| DEL-FR-03 | Accept Delivery Assignment | — |
| DEL-FR-04 | Deliver Order | — |

### Payment & Notification (2 UCs)

| UC ID | Name | Change |
|---|---|---|
| PAY-FR-01 | Process Payment Refund | Renamed |
| NOTI-FR-01 | Manage Real-Time Notifications | Renamed |

### Administration (10 UCs)

| UC ID | Name | Change |
|---|---|---|
| ADM-FR-01 | View Dashboard & Platform Overview | Renamed |
| ADM-FR-02 | Approve or Reject Restaurant Applications | — |
| ADM-FR-03 | Approve or Reject Shipper Applications | — |
| ADM-FR-04 | Suspend or Reactivate Partner Accounts | — |
| ADM-FR-05 | Monitor Orders and Platform Health | — |
| ADM-FR-06 | Search and Manage User Accounts | — |
| ADM-FR-07 | Cancel Orders as Administrator | — |
| ADM-FR-08 | View and Export Reports | — |
| ADM-FR-09 | Manage Platform Promotions | — |
| ADM-FR-10 | Manage Admin Roles & Permissions | — |

---

## 9. Final Assessment Summary

### Decomposition Verdict

| Dimension | Result |
|---|---|
| **Enterprise readiness** | ✅ Suitable for academic capstone / enterprise SRS |
| **Granularity** | ✅ Well-calibrated — no UC is trivially narrow; none is architecturally overloaded |
| **Cohesion** | ✅ Each UC represents one identifiable actor goal with one start trigger |
| **Naming quality** | ✅ All 6 naming decisions applied |
| **Completeness** | ✅ All gaps resolved — CUS-FR-11 and RES-FR-08 added; all BRs have owning UCs |
| **Traceability** | ✅ Clean FR → BR → Feature → User Story chain achievable |
| **Artifact suitability** | ✅ Every UC supports a complete TechMarket-format specification |
| **Action needed** | None — all decisions applied; document is finalized |

### Finalized Decisions

All decomposition decisions have been applied. The following changes are reflected in
this document:

1. ✅ AUTH consolidated into **AUTH-FR-01 — User Authentication** (sub-flows: Sign Up, Sign In, Forgot Password, Logout, Session Validation).
2. ✅ **CUS-FR-05** renamed to **Save & Manage Delivery Addresses** — persistent address book scope.
3. ✅ **RES-FR-04** renamed to **Toggle Item & Restaurant Availability** — covers item-level and restaurant-level.
4. ✅ **CUS-FR-11 — View Order History** added.
5. ✅ **RES-FR-08 — Manage Delivery Zones** added (BR-3 owning UC).
6. ✅ **PAY-FR-01** renamed to **Process Payment Refund** — dual-actor pattern applied.
7. ✅ **NOTI-FR-01** renamed to **Manage Real-Time Notifications** — cross-role scope.
8. ✅ **ADM-FR-01** renamed to **View Dashboard & Platform Overview**.
9. ✅ **Update Restaurant Profile** excluded from scope.

### Notes on TechMarket SRS Style Alignment

When writing the UC specifications, adopt the TechMarket format exactly:
- Use the 6-field UC header table (Name, Description, Actor, Trigger, Pre-condition, Post-condition)
- Number every activity step in the Activity Flow
- Label alternative paths as `(A1)`, `(A2)`, etc.
- For each activity step that has a business rule, add a row to the Business Rules table referencing the step number and a `BR-xx` code
- Keep descriptions to 1–2 sentences per step; keep the flow diagram simple and printable

This structure supports a clean 1:1:1 mapping (FR → UC Specification → Activity Diagram)
and produces a Traceability Matrix that is straightforward to maintain throughout the
project lifecycle.
