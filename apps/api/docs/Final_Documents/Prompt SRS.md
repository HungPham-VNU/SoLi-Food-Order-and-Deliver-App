# ROLE

You are a senior Software Architect, Business Analyst, and System Analyst with strong experience writing enterprise-level Software Requirements Specification (SRS) documents for large-scale web systems.

You are also experienced in:

* Use Case Modeling
* UML Activity Diagrams
* Business Rule Mapping
* Functional Requirement decomposition
* Requirement traceability
* Domain-driven system analysis

---

# GOAL

I am designing a Food Delivery Platform system and want to structure my SRS similarly to the format/style used in the file:

`TechMarket SRS.docx`

In this SRS structure:

* each Functional Requirement (FR) corresponds to:

  * exactly 1 Use Case (UC)
  * exactly 1 Activity Diagram / Activity Flow
  * corresponding Business Rules

I currently decomposed my system into 35 Use Cases (listed below), and I want you to evaluate whether this decomposition is:

* reasonable
* enterprise-level
* properly scoped
* neither too granular nor too broad
* suitable for an academic capstone / enterprise-style SRS

---

# CONTEXT

This is a multi-role Food Delivery Platform system with:

* Customers
* Restaurant Partners
* Delivery Personnel (Shippers)
* Administrators

Core features include:

* authentication
* ordering
* VNPay payment
* delivery lifecycle
* notifications
* promotions
* admin governance
* reporting

The system already has:

* Vision & Scope
* Business Rules
* User Stories
* Acceptance Criteria
* Quality Attributes
* Order lifecycle definitions

The detailed implementation logic is determined by the actual codebase and business rules, so you should NOT redesign the detailed business logic of each UC unless the decomposition itself is problematic.

---

# REQUIREMENTS

Please:

1. Analyze whether the following 35 Use Cases are appropriate for structuring the SRS.
2. Evaluate:

   * granularity
   * cohesion
   * separation of concerns
   * completeness
   * scalability
   * maintainability of the SRS structure
3. Point out:

   * any UC that is too large
   * any UC that should be merged
   * any UC that should be split
   * any missing critical UC
   * any naming improvements
4. Briefly explain the purpose of EACH UC in 1–3 short paragraphs or bullet points.
5. Explain whether the decomposition is suitable for:

   * Use Case Specifications
   * Activity Diagrams
   * Sequence Diagrams
   * Traceability Matrix
   * Testing
6. Generate the answer as a well-structured Markdown (.md) document.
7. Organize the Markdown using sections, headings, and tables where appropriate.
8. Keep explanations concise and practical.
9. Do NOT over-engineer the system or introduce unrelated enterprise patterns.
10. Focus on SRS structure quality, not implementation details.

---

# CONSTRAINTS

* Do NOT redesign the entire project architecture.
* Do NOT invent additional major features unless critically necessary.
* Assume detailed flows are already supported by the existing codebase/business rules.
* Treat these Use Cases primarily as SRS Functional Requirement units.
* Keep the analysis grounded in real-world enterprise SRS practices.
* Avoid excessive theoretical discussion.
* Use professional software engineering terminology.

---

# FORMAT PRINCIPLE

Your response MUST:

* be returned as a single Markdown (.md) document
* contain clear sections
* contain concise explanations
* be easy to read for software engineering students and reviewers
* resemble a professional SRS review document

---

# USE CASE LIST

# AUTHENTICATION & ACCOUNT MANAGEMENT

* AUTH-FR-01 — Customer Sign Up
* AUTH-FR-02 — User Sign In
* AUTH-FR-03 — Forgot Password
* AUTH-FR-04 — Update User Profile

---

# CUSTOMER

* CUS-FR-01 — Discover Restaurants & Food
* CUS-FR-02 — View Restaurant Details
* CUS-FR-03 — Add Item to Cart
* CUS-FR-04 — Manage Shopping Cart
* CUS-FR-05 — Manage Delivery Address
* CUS-FR-06 — Place Order
* CUS-FR-07 — Make Online Payment (VNPay)
* CUS-FR-08 — Track Order Status
* CUS-FR-09 — Cancel Order
* CUS-FR-10 — Submit Rating & Review

---

# RESTAURANT PARTNER

* RES-FR-01 — Restaurant Registration

* RES-FR-02 — Add Menu Item

* RES-FR-03 — Update Menu Item

* RES-FR-04 — Mark Item as Sold Out

* RES-FR-05 — Accept or Reject Order

* RES-FR-06 — Prepare Order for Pickup

  * Includes order status transitions:

    * confirmed → preparing
    * preparing → ready_for_pickup

---

# DELIVERY PERSONNEL (SHIPPER)

* DEL-FR-01 — Shipper Registration

* DEL-FR-02 — Toggle Availability Status

* DEL-FR-03 — Accept Delivery Assignment

* DEL-FR-04 — Deliver Order

  * Includes order status transitions:

    * ready_for_pickup → picked_up
    * picked_up → delivering
    * delivering → delivered

---

# PAYMENT & NOTIFICATION

* PAY-FR-01 — Process Refund
* NOTI-FR-01 — Receive Real-Time Notifications

---

# ADMINISTRATION

* ADM-FR-01 — Access Admin Dashboard
* ADM-FR-02 — Approve or Reject Restaurant Applications
* ADM-FR-03 — Approve or Reject Shipper Applications
* ADM-FR-04 — Suspend or Reactivate Partner Accounts
* ADM-FR-05 — Monitor Orders and Platform Health
* ADM-FR-06 — Search and Manage User Accounts
* ADM-FR-07 — Cancel Orders as Administrator
* ADM-FR-08 — View and Export Reports
* ADM-FR-09 — Manage Promotions
