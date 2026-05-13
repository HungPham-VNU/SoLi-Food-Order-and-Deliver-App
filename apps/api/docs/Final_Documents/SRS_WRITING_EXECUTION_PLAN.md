# SRS Writing Execution Plan

## SoLi Food Delivery Platform

### *Nền tảng Đặt và Giao Đồ ăn Trực tuyến*

---

**Project:** SoLi — Food Order and Delivery Platform
**Document Type:** SRS Writing Execution Plan
**Version:** 1.0
**Status:** Active
**Date:** May 13, 2026
**Document Owner:** Business Analysis Team
**Classification:** Internal — Project Documentation

---

## Table of Contents

1. [Purpose of This Plan](#1-purpose-of-this-plan)
2. [Reference Architecture](#2-reference-architecture)
3. [Why Phase-Based SRS Writing](#3-why-phase-based-srs-writing)
   - 3.1 [Advantages of Phased Writing](#31-advantages-of-phased-writing)
   - 3.2 [Risks: Writing All 36 UCs in One Phase](#32-risks-writing-all-36-ucs-in-one-phase)
   - 3.3 [Risks: Over-Granular Splitting](#33-risks-over-granular-splitting)
   - 3.4 [Rationale for the 4-Phase Decomposition](#34-rationale-for-the-4-phase-decomposition)
4. [Canonical Reference Registry](#4-canonical-reference-registry)
   - 4.1 [Actor Names](#41-actor-names)
   - 4.2 [Order Lifecycle States](#42-order-lifecycle-states)
   - 4.3 [Business Rule Codes](#43-business-rule-codes)
   - 4.4 [Feature-to-UC Traceability Index](#44-feature-to-uc-traceability-index)
5. [Phase 1 — Foundation & Customer Ordering Core](#5-phase-1--foundation--customer-ordering-core)
6. [Phase 2 — Restaurant & Delivery Operations](#6-phase-2--restaurant--delivery-operations)
7. [Phase 3 — Customer Interaction, Promotion & Notification](#7-phase-3--customer-interaction-promotion--notification)
8. [Phase 4 — Administration & Governance](#8-phase-4--administration--governance)
9. [Consistency & Governance Recommendations](#9-consistency--governance-recommendations)
10. [AI Collaboration Workflow](#10-ai-collaboration-workflow)
11. [Critical Self-Review of the 4-Phase Plan](#11-critical-self-review-of-the-4-phase-plan)

---

## 1. Purpose of This Plan

This document defines the execution plan for writing the Software Requirements Specification (SRS) for the SoLi Food Delivery Platform. It governs:

- **Phase decomposition:** how the 36 finalized Use Cases are organized into writing phases,
- **Dependency ordering:** which UCs must be specified before others can reference them,
- **Terminology governance:** which terms, actor names, and lifecycle states are canonical and frozen,
- **AI collaboration protocol:** how to structure each SRS writing session to ensure consistency across phases and sessions.

This plan is a process document. It does not contain UC specifications. It exists to prevent the most common failure modes in large-scale SRS writing:
inconsistent terminology, contradictory lifecycle states, orphaned business rule references, and drift between diagrams and prose caused by multiple disconnected writing sessions.

**Source documents relied upon:**

| Document | Role |
|---|---|
| `UC_DECOMPOSITION_REVIEW.md` | Authoritative finalized UC list (36 UCs) |
| `Business Rules.md` | Canonical BR definitions (BR-1 through BR-9) |
| `BRD.md` | Business objectives, stakeholders, features (FE-1 through FE-12) |
| `Food_Delivery_Vision_and_Scope.md` | Business objectives (BO-1 through BO-4), success metrics |
| `User-Stories-and-Acceptance-Criteria.md` | US IDs and acceptance criteria |
| `USE_CASE_SPECIFICATION.md` | Existing domain-level UC specification (current baseline) |
| `TechMarket SRS.md` / `TechMarket SRS.docx` | Reference SRS format |

---

## 2. Reference Architecture

### Per-UC SRS Artifact Structure (TechMarket Format)

Every Functional Requirement (FR) in this project maps to exactly one UC, which requires exactly three SRS artifacts:

```
┌──────────────────────────────────────────────────────────────────┐
│  UC Table (6 fields)                                             │
│   Name        | <Finalized name from UC_DECOMPOSITION_REVIEW>    │
│   Description | <One sentence: actor + action + purpose>         │
│   Actor       | <Primary actor — must match Section 4.1>         │
│   Trigger     | <What initiates the interaction>                  │
│   Pre-condition  | <System state required before the UC starts>   │
│   Post-condition | <System state guaranteed after success>        │
├──────────────────────────────────────────────────────────────────┤
│  Activities Flow   (numbered steps; alternatives as A1, A2, ...) │
├──────────────────────────────────────────────────────────────────┤
│  Business Rules Table                                            │
│   Activity Step | BR Code | Description                          │
└──────────────────────────────────────────────────────────────────┘
```

**The 1:1:1:N mapping rule:**

```
1 FR  →  1 UC Table  →  1 Activity Flow  →  N Business Rule entries
```

No FR shares a UC. No UC owns more than one Activity Flow. Business Rules may appear in multiple UCs (cross-UC BRs), but their codes remain identical and descriptions do not contradict.

---

## 3. Why Phase-Based SRS Writing

### 3.1 Advantages of Phased Writing

| Advantage | Explanation |
|---|---|
| **Incremental terminology stabilization** | Early phases define the core vocabulary (actor names, lifecycle states, BR codes). Later phases inherit and apply that vocabulary rather than redefine it. |
| **Dependency-safe writing order** | A UC that references another UC's postcondition (e.g., CUS-FR-08 references the order states established by RES-FR-05 and DEL-FR-03) is written after those states are defined. |
| **Manageable AI context windows** | A single AI session can write 8–12 UCs with full context consistency. Phasing ensures each session begins with a complete, stable reference frame rather than a partial one. |
| **Focused review checkpoints** | After each phase, a consistency sweep can be run before proceeding. Errors caught at phase boundaries are cheaper to fix than errors discovered at document completion. |
| **Parallel review feasibility** | A reviewer can validate Phase 1 artifacts while Phase 2 is being written, which is not possible with a monolithic approach. |
| **Localized scope of change** | If a business rule changes, only the phase(s) that reference it need to be revisited. |

### 3.2 Risks: Writing All 36 UCs in One Phase

- **Terminology drift:** Actor names, lifecycle state labels, and BR code references evolve through the writing session if not anchored from the start. By UC-20, subtle inconsistencies accumulate and are invisible without a complete re-read.
- **AI context overload:** Writing 36 UC specifications in sequence overloads the effective context of any AI assistant. Earlier decisions are forgotten, later UCs contradict earlier ones.
- **Cascading rework:** A name change (e.g., from "Pending" to "PENDING") discovered after 30 UCs are written requires a full-document search-and-replace plus diagram regeneration.
- **No intermediate validation:** There is no natural checkpoint to verify that BR-3 is consistently enforced in CUS-FR-06 and correctly defined in RES-FR-08 before moving forward.
- **Review fatigue:** A single 36-UC draft sent to a reviewer produces diminishing review quality after the first 10–12 UCs.

### 3.3 Risks: Over-Granular Splitting

- **Excessive context re-loading:** If each UC is written in a completely isolated session with no shared context, the writer (or AI) must re-load the full glossary and lifecycle reference on every session, increasing the risk of divergent interpretations.
- **Missing cross-UC BR linkage:** Business Rules that span multiple UCs (e.g., BR-7 spans RES-FR-05, RES-FR-06, DEL-FR-03, and DEL-FR-04) are best specified within a shared writing context to ensure step-number references and descriptions are synchronized.
- **Artificial domain fragmentation:** Some UCs within the same phase form a natural narrative arc (e.g., the restaurant order fulfillment flow: Accept → Prepare → Ready for Pickup). Writing them together in one session produces more coherent activity flows.

### 3.4 Rationale for the 4-Phase Decomposition

The decomposition follows three ordering principles:

1. **Business dependency ordering:** A UC that enforces a constraint defined by another UC is written after the defining UC. Example: CUS-FR-06 (Place Order) enforces BR-3 (Delivery Radius), which is configured by RES-FR-08 (Manage Delivery Zones). RES-FR-08 therefore belongs in Phase 1 alongside CUS-FR-06 despite being a Restaurant Partner UC.

2. **Actor lifecycle ordering:** The customer demand-side flow (browse → cart → pay) is independent of the supply-side response flow (accept → prepare → pick up → deliver). The demand-side is complete enough to specify on its own in Phase 1; the supply-side is specified in Phase 2 once order data structures are established.

3. **BR activation ordering:** Business Rules that apply to the most UCs (BR-2, BR-3, BR-4, BR-6) are activated in Phase 1. Business Rules with narrower scope (BR-5, BR-8) are activated when the relevant domain is written. Phase ordering mirrors this priority.

---

## 4. Canonical Reference Registry

This section defines the frozen reference values that **all phases must use without alteration**. Consult this section at the start of every SRS writing session.

### 4.1 Actor Names

| Canonical Actor Name | Short Form | Role |
|---|---|---|
| **Customer** | — | End user who places and tracks orders |
| **Restaurant Partner** | Partner | Food business registered on the platform |
| **Delivery Personnel** | Shipper | Registered courier fulfilling deliveries |
| **Administrator** | Admin | Platform operator with full oversight |
| **Automated System** | System | Internal system processes (timers, events, automated triggers) |
| **VNPay Gateway** | VNPay | External payment processor |
| **Firebase Cloud Messaging** | FCM | External push notification service |

> **Rule:** Do not use "User", "Staff", "Vendor", "Driver", or "Backend" as actor names in any UC specification. Use only the names above.

### 4.2 Order Lifecycle States

The canonical order state machine is: read the BE codebase for getting more detail



### 4.3 Business Rule Codes

| Code | Rule Name | Defined In | First Referenced In |
|---|---|---|---|
| **BR-1** | Partner Verification | `Business Rules.md` | Phase 2 (RES-FR-01, DEL-FR-01); enforced in Phase 4 (ADM-FR-02, ADM-FR-03) |
| **BR-2** | Single-Restaurant Cart Constraint | `Business Rules.md` | Phase 1 (CUS-FR-03, CUS-FR-04) |
| **BR-3** | Delivery Radius Constraint | `Business Rules.md` | Phase 1 (CUS-FR-06); configured by RES-FR-08 (Phase 1) |
| **BR-4** | Supported Payment Methods | `Business Rules.md` | Phase 1 (CUS-FR-07) |
| **BR-5** | Commission Calculation | `Business Rules.md` | Phase 4 (ADM-FR-08) |
| **BR-6** | Geographical Scope Constraint | `Business Rules.md` | Phase 1 (CUS-FR-01, CUS-FR-06) |
| **BR-7** | Order Lifecycle Integrity | `Business Rules.md` | Phase 2 (RES-FR-05, RES-FR-06, DEL-FR-03, DEL-FR-04) |
| **BR-8** | Real-time Availability Control | `Business Rules.md` | Phase 2 (RES-FR-04) |
| **BR-9** | Enterprise Exclusion | `Business Rules.md` | Phase 1 (CUS-FR-06) |

> **Rule:** BR codes are fixed. Never introduce a new BR without adding it to this table first. When a BR appears in multiple UCs, use the same code and a consistent (not contradictory) description in each Business Rules table.

### 4.4 Feature-to-UC Traceability Index

| Feature ID | Feature Name (Vision & Scope) | Related UCs |
|---|---|---|
| FE-1 | Customer registration, login, and profile management | AUTH-FR-01 |
| FE-2 | Restaurant search and browsing | CUS-FR-01, CUS-FR-02 |
| FE-3 | Shopping cart management and checkout | CUS-FR-03, CUS-FR-04, CUS-FR-05, CUS-FR-06 |
| FE-4 | Online payment via VNPay | CUS-FR-07, PAY-FR-01 |
| FE-5 | Real-time order status tracking | CUS-FR-08, DEL-FR-04 |
| FE-6 | Restaurant management portal | RES-FR-02, RES-FR-03, RES-FR-04, RES-FR-05, RES-FR-06 |
| FE-7 | Delivery personnel portal | DEL-FR-02, DEL-FR-03, DEL-FR-04 |
| FE-8 | Administrator dashboard | ADM-FR-01 through ADM-FR-10 |
| FE-9 | Customer review and rating system | CUS-FR-10 |
| FE-10 | Promotional features | RES-FR-07, ADM-FR-09 |
| FE-11 | Multi-branch / advanced ordering (Release 2) | Out of scope for Release 1 SRS |
| FE-12 | Push notifications | NOTI-FR-01 |

---

## 5. Phase 1 — Foundation & Customer Ordering Core

### 5.1 Purpose

Phase 1 establishes the complete demand-side ordering flow — from identity and discovery through to payment confirmation — and the delivery zone configuration that the ordering flow depends on. This phase produces the highest-value business artifacts because it specifies the primary revenue-generating user journey.

Phase 1 also freezes the foundational vocabulary of the entire SRS: actor names, order lifecycle state labels, and the BR codes that apply most broadly across the system.

### 5.2 UC List (10 UCs)

| # | UC ID | Name | Primary Actor | Key BR(s) | FE | US |
|---|---|---|---|---|---|---|
| 1 | AUTH-FR-01 | User Authentication | Customer / Restaurant Partner / Delivery Personnel / Administrator | — | FE-1 | US-1 |
| 2 | CUS-FR-01 | Discover Restaurants & Food | Customer | BR-6 | FE-2 | US-2 |
| 3 | CUS-FR-02 | View Restaurant Details | Customer | — | FE-2 | US-2 |
| 4 | CUS-FR-03 | Add Item to Cart | Customer | BR-2, BR-8 | FE-3 | US-3 |
| 5 | CUS-FR-04 | Manage Shopping Cart | Customer | BR-2 | FE-3 | US-3 |
| 6 | CUS-FR-05 | Save & Manage Delivery Addresses | Customer | — | FE-3 | US-4 |
| 7 | RES-FR-08 | Manage Delivery Zones | Restaurant Partner | BR-3 | FE-3 | — |
| 8 | CUS-FR-06 | Place Order | Customer | BR-2, BR-3, BR-6, BR-9 | FE-3 | US-5 |
| 9 | CUS-FR-07 | Make Online Payment (VNPay) | Customer / VNPay Gateway | BR-4 | FE-4 | US-6 |
| 10 | CUS-FR-11 | View Order History | Customer | — | FE-3 | US-7 |

> **Writing order within Phase 1:** Write in the sequence shown above (rows 1 → 10). AUTH-FR-01 must be written first as it establishes the authenticated precondition for all subsequent UCs. RES-FR-08 (row 7) must be written before CUS-FR-06 (row 8) so that the BR-3 delivery zone validation in Place Order has a defined reference.

### 5.3 Business Rules Activated in Phase 1

| BR | Activated By | Role in Phase 1 |
|---|---|---|
| BR-2 | CUS-FR-03, CUS-FR-04 | Cart is constrained to items from a single restaurant |
| BR-3 | RES-FR-08 (configuration), CUS-FR-06 (enforcement) | Delivery address must be within the restaurant's zone at checkout |
| BR-4 | CUS-FR-07 | COD and VNPay are the only accepted payment methods in Release 1 |
| BR-6 | CUS-FR-01, CUS-FR-06 | All ordering activity is restricted to the designated service area |
| BR-9 | CUS-FR-06 | No enterprise or subscription orders permitted |

### 5.4 Terminology and Concepts Stabilized in Phase 1

By the end of Phase 1, the following must be fully defined and locked:

- All canonical actor names (Section 4.1)
- Order lifecycle state labels (Section 4.2) — the PENDING and PAYMENT_FAILED states appear first here
- Delivery zone model: zone radius, base fee, per-km rate, estimated delivery time
- Cart semantics: single-restaurant constraint, item quantity, item modifiers (if applicable in Release 1)
- Payment flow: VNPay redirect/callback pattern, COD confirmation model
- Authentication sub-flow labels: Sign Up, Sign In, Forgot Password, Logout, Session Validation

### 5.5 Dependencies Phase 2+ Has on Phase 1

| Phase 1 Artifact | What Depends On It |
|---|---|
| `AUTH-FR-01` postcondition (authenticated session) | Every UC in Phases 2–4 that requires a logged-in actor as a precondition |
| Order data structure (from CUS-FR-06 postcondition) | RES-FR-05 precondition (order in PENDING state), Phase 3 tracking and cancellation UCs |
| VNPay payment flow (from CUS-FR-07) | PAY-FR-01 (Process Payment Refund) in Phase 3 |
| Delivery zone semantics (from RES-FR-08) | RES-FR-04 indirectly (restaurant availability affects zone accessibility) |
| Payment method vocabulary (from CUS-FR-07, BR-4) | ADM-FR-08 (reports include payment method breakdown) |

---

## 6. Phase 2 — Restaurant & Delivery Operations

### 6.1 Purpose

Phase 2 specifies the complete supply-side fulfillment flow: restaurant partner onboarding and menu management, order acceptance and preparation, shipper onboarding, and the full order-to-delivery lifecycle. This phase completes the canonical order state machine from ACCEPTED through DELIVERED.

Phase 2 is where BR-7 (Order Lifecycle Integrity) and BR-8 (Real-time Availability Control) are fully realized, and where BR-1 (Partner Verification) first appears on the supply side. The admin-side enforcement of BR-1 (approving applications) is deferred to Phase 4.

### 6.2 UC List (10 UCs)

| # | UC ID | Name | Primary Actor | Key BR(s) | FE | US |
|---|---|---|---|---|---|---|
| 1 | RES-FR-01 | Restaurant Registration | Restaurant Partner | BR-1 | FE-6 | US-10 |
| 2 | RES-FR-02 | Add Menu Item | Restaurant Partner | BR-8 | FE-6 | US-11 |
| 3 | RES-FR-03 | Update Menu Item | Restaurant Partner | BR-8 | FE-6 | US-11 |
| 4 | RES-FR-04 | Toggle Item & Restaurant Availability | Restaurant Partner | BR-8 | FE-6 | US-12 |
| 5 | RES-FR-05 | Accept or Reject Order | Restaurant Partner | BR-7 | FE-6 | US-13 |
| 6 | RES-FR-06 | Prepare Order for Pickup | Restaurant Partner | BR-7 | FE-6 | US-14 |
| 7 | DEL-FR-01 | Shipper Registration | Delivery Personnel | BR-1 | FE-7 | US-18 |
| 8 | DEL-FR-02 | Toggle Availability Status | Delivery Personnel | — | FE-7 | US-19 |
| 9 | DEL-FR-03 | Accept Delivery Assignment | Delivery Personnel | BR-7 | FE-7 | US-20 |
| 10 | DEL-FR-04 | Deliver Order | Delivery Personnel | BR-7 | FE-7 | US-21 |

> **Writing order within Phase 2:** Write restaurant UCs first (rows 1 → 6) then delivery UCs (rows 7 → 10). RES-FR-05 must be written before DEL-FR-03 because order acceptance (PENDING → ACCEPTED) must be defined before delivery assignment can reference an accepted order.

### 6.3 Order Lifecycle Segments Covered in Phase 2

Read the BE codebase for getting more detail

### 6.4 Business Rules Activated in Phase 2

| BR | Activated By | Role in Phase 2 |
|---|---|---|
| BR-1 | RES-FR-01, DEL-FR-01 | Partner accounts are created in pending-verification state; activation requires admin approval (defined in Phase 4) |
| BR-7 | RES-FR-05, RES-FR-06, DEL-FR-03, DEL-FR-04 | All state transitions must follow the canonical sequence; no step may be skipped |
| BR-8 | RES-FR-04 | Toggling a menu item or restaurant to unavailable immediately blocks new cart additions |

### 6.5 Terminology and Concepts Stabilized in Phase 2

- Full order state machine (all transitions from ACCEPTED → DELIVERED, plus REJECTED)
- Menu structure: item, category, price, availability flag, modifiers (if in scope)
- Dispatch model: assignment trigger, acceptance window, assignment sequence
- Restaurant registration state: PENDING_APPROVAL, ACTIVE, SUSPENDED
- Shipper registration state: PENDING_APPROVAL, AVAILABLE, UNAVAILABLE, SUSPENDED
- BR-1 pending-approval semantics: what a partner can and cannot do before admin approval

### 6.6 Dependencies Phase 3+ Has on Phase 2

| Phase 2 Artifact | What Depends On It |
|---|---|
| DELIVERED state (DEL-FR-04 postcondition) | CUS-FR-10 (Submit Rating & Review) precondition |
| Full order lifecycle definition | CUS-FR-08 (Track Order Status) activity flow; CUS-FR-09 (Cancel Order) pre/postconditions |
| BR-7 lifecycle sequence | CUS-FR-09 cancellation window logic (only PENDING/ACCEPTED orders can be cancelled) |
| REJECTED terminal state | CUS-FR-09, ADM-FR-07 alternative paths |
| BR-1 pending-approval model | ADM-FR-02 (Approve Restaurant), ADM-FR-03 (Approve Shipper) in Phase 4 |

---

## 7. Phase 3 — Customer Interaction, Promotion & Notification

### 7.1 Purpose

Phase 3 specifies the post-order customer experience, promotional mechanics, and the cross-cutting real-time notification system. These UCs depend on the order data model (Phase 1) and the complete lifecycle state machine (Phase 2).

Promotional UCs for both restaurant-level (RES-FR-07) and platform-level (ADM-FR-09) are written together in this phase. This co-location ensures that promotion terminology — discount codes, promotion conditions, applicability rules — is consistent between the two management scopes without requiring cross-phase reconciliation.

### 7.2 UC List (7 UCs)

| # | UC ID | Name | Primary Actor | Key BR(s) | FE | US |
|---|---|---|---|---|---|---|
| 1 | CUS-FR-08 | Track Order Status | Customer | BR-7 | FE-5 | US-8 |
| 2 | CUS-FR-09 | Cancel Order | Customer | BR-7 | FE-3 | US-9 |
| 3 | CUS-FR-10 | Submit Rating & Review | Customer | — | FE-9 | US-15 |
| 4 | RES-FR-07 | Manage Restaurant Promotions | Restaurant Partner | — | FE-10 | US-16 |
| 5 | ADM-FR-09 | Manage Platform Promotions | Administrator | — | FE-10 | US-17 |
| 6 | PAY-FR-01 | Process Payment Refund | Automated System / Administrator | BR-4 | FE-4 | — |
| 7 | NOTI-FR-01 | Manage Real-Time Notifications | Automated System | — | FE-12 | — |

> **Writing order within Phase 3:** Write CUS-FR-08 and CUS-FR-09 first (they reference the lifecycle states established in Phase 2). Then write CUS-FR-10 (requires DELIVERED state). Then write promotion UCs (RES-FR-07 → ADM-FR-09). Then PAY-FR-01 (depends on payment types from Phase 1). Write NOTI-FR-01 last — it is triggered by events from all prior UCs.

### 7.3 Business Rules Referenced in Phase 3

| BR | Referenced By | Role in Phase 3 |
|---|---|---|
| BR-4 | PAY-FR-01 | Refund eligibility is bound to payment method (VNPay refunds are processed differently from COD adjustments) |
| BR-7 | CUS-FR-08, CUS-FR-09 | State machine governs which states allow cancellation and what states are visible in tracking |

### 7.4 Terminology and Concepts Stabilized in Phase 3

- Cancellation window: which order states permit customer-initiated cancellation (PENDING, ACCEPTED only per BR-7)
- Tracking model: states visible to Customer vs. states visible to Delivery Personnel
- Review eligibility: only orders in DELIVERED state can receive a rating/review
- Promotion model: discount code, minimum order value, applicability scope (restaurant vs. platform), active/inactive status
- Refund model: VNPay refund initiation, COD refund handling, refund trigger conditions
- Notification event catalogue: which system events produce which notification types to which actor roles

### 7.5 Dependencies Phase 4 Has on Phase 3

| Phase 3 Artifact | What Depends On It |
|---|---|
| Cancellation semantics (CUS-FR-09) | ADM-FR-07 (Cancel Orders as Administrator) — admin cancellation follows similar lifecycle constraints |
| Promotion model (RES-FR-07, ADM-FR-09) | ADM-FR-08 (reporting includes promotion utilization metrics) |
| Notification event catalogue (NOTI-FR-01) | ADM-FR-05 (platform health monitoring includes notification delivery stats) |

---

## 8. Phase 4 — Administration & Governance

### 8.1 Purpose

Phase 4 specifies the administrative control plane of the platform. These UCs enable platform operators to approve partners, manage accounts, monitor operations, generate reports, and govern access roles. They depend on every preceding phase because they operate on data and entities established in Phases 1–3.

ADM-FR-09 (Manage Platform Promotions) is not in this phase — it is in Phase 3 with RES-FR-07 to ensure promotional terminology is co-specified (see Section 7.1).

### 8.2 UC List (9 UCs)

| # | UC ID | Name | Primary Actor | Key BR(s) | FE | US |
|---|---|---|---|---|---|---|
| 1 | ADM-FR-02 | Approve or Reject Restaurant Applications | Administrator | BR-1 | FE-8 | US-22 |
| 2 | ADM-FR-03 | Approve or Reject Shipper Applications | Administrator | BR-1 | FE-8 | US-23 |
| 3 | ADM-FR-04 | Suspend or Reactivate Partner Accounts | Administrator | — | FE-8 | US-24 |
| 4 | ADM-FR-05 | Monitor Orders and Platform Health | Administrator | — | FE-8 | US-25 |
| 5 | ADM-FR-06 | Search and Manage User Accounts | Administrator | — | FE-8 | US-26 |
| 6 | ADM-FR-07 | Cancel Orders as Administrator | Administrator | BR-7 | FE-8 | US-27 |
| 7 | ADM-FR-08 | View and Export Reports | Administrator | BR-5 | FE-8 | US-28 |
| 8 | ADM-FR-01 | View Dashboard & Platform Overview | Administrator | — | FE-8 | US-29 |
| 9 | ADM-FR-10 | Manage Admin Roles & Permissions | Administrator | — | FE-8 | US-30 |

> **Writing order within Phase 4:** Write approval UCs first (rows 1 → 2, completing BR-1 full cycle), then account management (rows 3 → 6), then operational UCs (row 7 — ADM-FR-07 depends on lifecycle from Phase 2), then reporting (row 8 — ADM-FR-08 depends on promotion data from Phase 3), then dashboard (row 8 as a read-only aggregation of all data), and finally roles (row 9 as a meta-level governance UC).

### 8.3 Business Rules Activated in Phase 4

| BR | Activated By | Role in Phase 4 |
|---|---|---|
| BR-1 | ADM-FR-02, ADM-FR-03 | Administrator action completes the partner verification cycle (partner registered in Phase 2; approved here) |
| BR-5 | ADM-FR-08 | Commission is calculated as a fixed percentage of GMV; reporting surfaces this calculation |
| BR-7 | ADM-FR-07 | Admin cancellation follows the same lifecycle integrity rules as customer cancellation (only cancellable from PENDING, ACCEPTED) |

### 8.4 Terminology and Concepts Stabilized in Phase 4

- Partner account states: PENDING_APPROVAL, ACTIVE, SUSPENDED (first used in Phase 2 vocabulary; enforced actions defined here)
- Admin action verbs (canonical): **approve**, **reject**, **suspend**, **reactivate**, **cancel**, **export**
- Report dimensions: GMV, order count, commission, payment method breakdown, promotion utilization, review scores
- Role hierarchy: platform roles and permission scopes within the Administrator actor
- Dashboard aggregation scope: what KPIs are surface-level (ADM-FR-01) vs. drill-down (ADM-FR-05, ADM-FR-08)

---

## 9. Consistency & Governance Recommendations

### 9.1 Terminology Consistency

**Establish a Terminology Freeze Registry.**
Before writing the first UC in each phase, create or update a short reference block at the top of the writing session containing:
- The actor name table (Section 4.1)
- All new terms introduced in prior phases (accumulated)
- The order lifecycle state table (Section 4.2)

Any new term introduced in a UC specification must be added to the registry immediately and carried forward to all subsequent sessions.

| Risk | Mitigation |
|---|---|
| Actor name synonyms creeping in ("Driver" instead of "Delivery Personnel") | Anchor every UC's Actor field to Section 4.1; do not paraphrase |
| Order state synonyms ("Confirmed" instead of "ACCEPTED") | Reference Section 4.2 before writing every Activity Flow |
| Promotion term divergence between RES-FR-07 and ADM-FR-09 | Write both UCs in the same session (Phase 3) |

### 9.2 Lifecycle Consistency

The order lifecycle state machine (Section 4.2) must be treated as an immutable contract from Phase 1 onward.

- Every precondition and postcondition that references an order state must use the canonical ALL_CAPS_SNAKE_CASE label.
- Every Business Rules table entry that references a state transition must cite the canonical label.
- No UC may introduce an intermediate state not listed in Section 4.2 without a formal change to that section first.

**Cross-phase lifecycle verification:**
After Phase 2 is written, verify that every state label in Phases 1 and 2 is identical. After Phase 3, verify CUS-FR-08 and CUS-FR-09 use the same state labels as RES-FR-05/06 and DEL-FR-03/04.

### 9.3 Business Rule Traceability

Each Business Rules table entry must:

1. Reference the exact canonical BR code (BR-1 through BR-9).
2. Cite the activity step number(s) it applies to.
3. State the rule description concisely — do not restate the full `Business Rules.md` entry verbatim, but ensure there is no contradiction.

When the same BR appears in multiple UCs (common for BR-7 across Phase 2), the description may be abbreviated: `See BR-7 (Order Lifecycle Integrity) — orders must transition sequentially per the canonical state machine.`

**Never introduce a local BR code** (e.g., `BR-CUS-01`) within a UC specification. All rules trace back to `Business Rules.md`. If a validation rule in a UC has no corresponding BR in `Business Rules.md`, it is a validation constraint, not a business rule, and belongs in the Activity Flow step description rather than the Business Rules table.

### 9.4 Activity Diagram Style Consistency

The TechMarket SRS format requires one Activity Diagram per UC. Maintain the following conventions across all phases:

| Convention | Rule |
|---|---|
| **Step numbering** | Steps are numbered sequentially starting at (1). Alternative path steps are labeled (A1.1), (A1.2), etc. |
| **Decision node label** | Use `[condition is true]` and `[condition is false]` guard labels on all decision branches |
| **System vs. actor swimlanes** | Use two swimlanes minimum: one for the primary actor, one for the System. Add a third for external actors (VNPay, FCM) only when they appear |
| **Postcondition placement** | The final activity step always corresponds to the UC's postcondition (a state, not an action) |
| **Alternative path entry** | Every alternative path (A1, A2...) must clearly indicate the step number at which the deviation begins |

### 9.5 Avoiding Duplicate Business Rules

**Problem:** The same business constraint is often discoverable from multiple UCs (e.g., the single-restaurant cart constraint appears in both CUS-FR-03 and CUS-FR-04). Writing each UC in isolation risks restating the rule with slightly different wording, creating ambiguity.

**Solution:**
- Designate one UC as the **primary owner** of each BR (the UC where the rule is enforced most centrally).
- In secondary UCs that reference the same BR, use the format: `[BR-X: see primary definition in UC-ID]`.

| BR | Primary Owner UC | Secondary Reference UCs |
|---|---|---|
| BR-1 | RES-FR-01 (registration trigger) | DEL-FR-01, ADM-FR-02, ADM-FR-03 |
| BR-2 | CUS-FR-03 (add to cart) | CUS-FR-04 |
| BR-3 | CUS-FR-06 (enforcement at checkout) | RES-FR-08 (zone configuration) |
| BR-4 | CUS-FR-07 (payment selection) | PAY-FR-01 |
| BR-5 | ADM-FR-08 (reporting) | — |
| BR-6 | CUS-FR-06 (checkout geographic check) | CUS-FR-01 (search radius) |
| BR-7 | RES-FR-05 (first lifecycle transition) | RES-FR-06, DEL-FR-03, DEL-FR-04, CUS-FR-08, CUS-FR-09, ADM-FR-07 |
| BR-8 | RES-FR-04 (toggle action) | CUS-FR-03 (blocked add to cart) |
| BR-9 | CUS-FR-06 (checkout guard) | — |

### 9.6 Reducing AI-Generated Inconsistency Between Sessions

When using an AI assistant across multiple sessions, the following practices reduce inter-session drift:

1. **Start every session with the Canonical Reference Registry (Section 4).** Paste the actor table, lifecycle table, and BR code table as context before generating any UC content.
2. **Provide the previous phase's UC table summaries** (not full prose) as prior context when starting a new phase.
3. **Write one UC per AI prompt.** Do not ask an AI to write multiple UC specs in a single prompt. Write one, review it, then proceed to the next.
4. **After every UC, verify** the actor name, lifecycle state labels (if applicable), and BR codes against the canonical registry before saving the specification.
5. **Use a fixed UC specification template** so the AI fills in a structured form rather than generating free prose.

---

## 10. AI Collaboration Workflow

### 10.1 Per-UC Writing Protocol

For each UC specification, execute the following steps in order:

```
Step 1 — BRIEF
  Provide to the AI:
  - UC ID and finalized name (from UC_DECOMPOSITION_REVIEW.md)
  - Primary actor (from Section 4.1)
  - Relevant BR codes and their short definitions (from Section 4.3)
  - Linked FE code (from Section 4.4)
  - Linked US ID and key acceptance criteria (from User-Stories-and-Acceptance-Criteria.md)
  - Any postcondition from a preceding UC that this UC depends on

Step 2 — WRITE
  Request the 6-field UC table, Activity Flow, and Business Rules table
  in TechMarket SRS format.

Step 3 — VERIFY (immediately after generation)
  Check:
  □ Actor name matches Section 4.1 exactly
  □ All order state labels match Section 4.2 (if lifecycle is referenced)
  □ All BR codes in the Business Rules table match Section 4.3
  □ No new undefined terms introduced (or if yes, add to Terminology Registry)
  □ Postcondition is consistent with what the next UC expects as a precondition

Step 4 — LOCK
  Record in the session Terminology Registry:
  - Any new entity names or state labels introduced by this UC
  - Cross-UC references (e.g., "this UC's postcondition is the precondition for UC-ID")

Step 5 — ADVANCE
  Proceed to the next UC in the phase writing order.
```

### 10.2 Phase Transition Checklist

Before beginning the next phase, complete all items:

| Item | Action |
|---|---|
| **Lifecycle consistency check** | Verify all state labels in the completed phase match Section 4.2 exactly |
| **BR cross-reference check** | Confirm each BR appears only once as a primary definition; secondary references cite the primary UC |
| **Actor name audit** | Search the completed phase for actor name synonyms; correct any found |
| **Terminology registry update** | Record all new terms introduced in the completed phase in the Terminology Registry |
| **Postcondition chain verification** | Confirm that each UC's postcondition is compatible with the preconditions of any UC in the next phase that depends on it |
| **Diagram style audit** | Confirm all Activity Diagrams follow Section 9.4 conventions |

### 10.3 Master Consistency Sweep (Post Phase 4)

After all four phases are written, perform a final full-document consistency sweep:

1. **Global actor name audit:** Every occurrence of an actor name must match Section 4.1.
2. **Global lifecycle state audit:** Every occurrence of an order state label must match Section 4.2.
3. **Global BR cross-reference audit:** Every BR code in every Business Rules table must match Section 4.3; descriptions must not contradict each other across UCs.
4. **Postcondition completeness check:** Every precondition that references an outcome from another UC must correctly reflect the postcondition of that UC.
5. **Traceability matrix completion:** Every UC must trace to at least one FE code, one BR code (or explicitly note "no BR applies"), and one US ID (or "internal system UC").

---

## 11. Critical Self-Review of the 4-Phase Plan

### 11.1 Phase Decomposition Assessment

| Question | Assessment |
|---|---|
| Is the 4-phase count optimal? | **Yes.** Fewer phases (2–3) would create oversized phases that exceed manageable AI context. More phases (5–6) would fragment cohesive writing units like the restaurant order fulfillment arc (RES-FR-05, RES-FR-06) or the delivery arc (DEL-FR-03, DEL-FR-04). |
| Are any UCs misplaced? | **No.** RES-FR-08 (Manage Delivery Zones) in Phase 1 is the most non-obvious placement, but is correct: CUS-FR-06 (Place Order) enforces BR-3, which requires delivery zone semantics to be defined before the Place Order spec can be written. Placing RES-FR-08 in Phase 2 with the other Restaurant UCs would create a forward reference problem. |
| Is any dependency ordering problematic? | **One cross-phase BR reference to note:** BR-1 is first activated in Phase 2 (registration) but its enforcement mechanism (admin approval) is not specified until Phase 4. The Phase 2 UCs should explicitly state that the partner account enters PENDING_APPROVAL state and that activation is governed by an administrative action (to be specified in Phase 4). This forward reference is acceptable because it is directional (Phase 2 → Phase 4) and does not create a circular dependency. |
| Is ADM-FR-09 correctly placed in Phase 3 instead of Phase 4? | **Yes.** ADM-FR-09 (Manage Platform Promotions) shares vocabulary with RES-FR-07 (Manage Restaurant Promotions). Co-specifying them in Phase 3 ensures consistent promotion terminology. If ADM-FR-09 were moved to Phase 4, a terminology reconciliation step would be required between the two promotion UCs after both phases are written — avoidable overhead. |
| Is CUS-FR-11 correctly in Phase 1? | **Yes.** View Order History is a read-only query on the Order data structure. That structure is established by CUS-FR-06 in Phase 1. Since Phase 1 writes all foundational ordering UCs, CUS-FR-11 logically completes the customer ordering experience set. Moving it to Phase 3 would leave a gap in Phase 1's customer order arc. |
| Are phase sizes balanced? | **Acceptably balanced.** Phase 1: 10 UCs. Phase 2: 10 UCs. Phase 3: 7 UCs. Phase 4: 9 UCs. The slightly lighter Phase 3 reflects that most foundational specifications are complete; Phase 3 UCs are secondary interactions and cross-cutting concerns. |

### 11.2 Lifecycle Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| CUS-FR-09 (Cancel Order) cancellation window conflicts with BR-7 lifecycle | Medium | Write CUS-FR-09 after Phase 2 lifecycle is complete; explicitly define cancellation eligibility as: order must be in PENDING or ACCEPTED state only |
| DEL-FR-04 (Deliver Order) DELIVERED postcondition must be verifiable for CUS-FR-10 precondition | Low | Ensure DEL-FR-04 postcondition explicitly sets order state to DELIVERED; CUS-FR-10 precondition references this state |
| PAY-FR-01 (Process Payment Refund) references both VNPay flow (Phase 1) and admin action (Phase 4 actor context) | Low | PAY-FR-01 is in Phase 3; by that point both the VNPay payment flow and the actor vocabulary are established |

### 11.3 Final Recommendation

The 4-phase plan is coherent and production-ready. Execute phases in strict order (1 → 2 → 3 → 4). Do not begin writing a phase until the preceding phase's transition checklist (Section 10.2) is completed and all terminology from that phase is recorded in the Terminology Registry.

The highest-risk inconsistency in this SRS is the **order lifecycle state machine** (Section 4.2). It is referenced in UCs across all four phases, by multiple actors, in both preconditions and Business Rules tables. Treat the lifecycle state table as immutable from the moment Phase 1 writing begins.
