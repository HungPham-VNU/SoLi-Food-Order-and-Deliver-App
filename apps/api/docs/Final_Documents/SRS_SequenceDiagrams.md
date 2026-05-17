# SRS Sequence Diagrams — Appendix SD
## SoLi Food Delivery Application

**Document Version:** 2.0
**Status:** Final
**Scope:** UC-1 through UC-26 — Enterprise-Style PlantUML Sequence Diagrams
**Traceability:** Root message numbers correspond **directly** to Activity Diagram step numbers in `SRS_FoodDelivery.md`.

---

## Table of Contents

- [SD-1: UC-1 — User Authentication](#sd-1-uc-1--user-authentication)
- [SD-2: UC-2 — Discover Restaurants & Food](#sd-2-uc-2--discover-restaurants--food)
- [SD-3: UC-3 — View Restaurant Details](#sd-3-uc-3--view-restaurant-details)
- [SD-4: UC-4 — Add Item to Cart](#sd-4-uc-4--add-item-to-cart)
- [SD-5: UC-5 — Manage Shopping Cart](#sd-5-uc-5--manage-shopping-cart)
- [SD-6: UC-6 — Save & Manage Delivery Addresses](#sd-6-uc-6--save--manage-delivery-addresses)
- [SD-7: UC-7 — Manage Delivery Zones](#sd-7-uc-7--manage-delivery-zones)
- [SD-8: UC-8 — Place Order](#sd-8-uc-8--place-order)
- [SD-9: UC-9 — Make Online Payment (VNPay)](#sd-9-uc-9--make-online-payment-vnpay)
- [SD-10: UC-10 — View Order History](#sd-10-uc-10--view-order-history)
- [SD-11: UC-11 — Restaurant Registration & Profile Management](#sd-11-uc-11--restaurant-registration--profile-management)
- [SD-12: UC-12 — Manage Menu Catalog](#sd-12-uc-12--manage-menu-catalog)
- [SD-13: UC-13 — Toggle Item & Restaurant Availability](#sd-13-uc-13--toggle-item--restaurant-availability)
- [SD-14: UC-14 — Accept or Reject Order](#sd-14-uc-14--accept-or-reject-order)
- [SD-15: UC-15 — Prepare Order for Pickup](#sd-15-uc-15--prepare-order-for-pickup)
- [SD-16: UC-16 — Shipper Registration](#sd-16-uc-16--shipper-registration)
- [SD-17: UC-17 — Manage Shipper Availability](#sd-17-uc-17--manage-shipper-availability)
- [SD-18: UC-18 — Accept Delivery Assignment](#sd-18-uc-18--accept-delivery-assignment)
- [SD-19: UC-19 — Deliver Order](#sd-19-uc-19--deliver-order)
- [SD-20: UC-20 — Track Order Status](#sd-20-uc-20--track-order-status)
- [SD-21: UC-21 — Cancel Order](#sd-21-uc-21--cancel-order)
- [SD-22: UC-22 — Submit Rating & Review](#sd-22-uc-22--submit-rating--review)
- [SD-23: UC-23 — Manage Restaurant Promotions](#sd-23-uc-23--manage-restaurant-promotions)
- [SD-24: UC-24 — Manage Platform Promotions](#sd-24-uc-24--manage-platform-promotions)
- [SD-25: UC-25 — Process Payment Refund](#sd-25-uc-25--process-payment-refund)
- [SD-26: UC-26 — Manage Real-Time Notifications](#sd-26-uc-26--manage-real-time-notifications)

---

## SD-1: UC-1 — User Authentication

```plantuml
@startuml SD-1_UserAuthentication

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-1: UC-1 — User Authentication\n

actor "Guest / User" as Actor
boundary "Authentication Page" as UI
control "Authentication Service" as AuthSvc
control "OTP Service" as OTPSvc

autonumber stop

== Sign In ==

Actor -> UI : (1) Select "Sign In"
UI -> AuthSvc : (3) Submit sign-in credentials\n(email, password)
activate AuthSvc

AuthSvc -> AuthSvc : (4) Validate and authenticate credentials

alt Credentials invalid or account banned
    AuthSvc --> UI : Reject — MSG-AUTH-01
    deactivate AuthSvc
    UI --> Actor : (7) Show MSG-AUTH-01
else Credentials valid
    AuthSvc -> AuthSvc : (5) Create authenticated session (TTL = 7 days)
    AuthSvc --> UI : Success — session token
    deactivate AuthSvc
    UI --> Actor : (6) Redirect to home page
end

== Sign Up ==

Actor -> UI : (1) Select "Sign Up"
UI -> AuthSvc : (8) Submit registration form\n(name, email, password)
activate AuthSvc

AuthSvc -> AuthSvc : (9) Validate form and check email uniqueness

alt Input invalid
    AuthSvc --> UI : Reject — MSG-AUTH-03
    deactivate AuthSvc
    UI --> Actor : (12) Show MSG-AUTH-03
else Email already registered
    AuthSvc --> UI : Reject — MSG-AUTH-02
    deactivate AuthSvc
    UI --> Actor : (12) Show MSG-AUTH-02
else Valid and unique
    AuthSvc -> AuthSvc : (10) Create account (role = 'user') and issue session
    AuthSvc --> UI : Success — session token
    deactivate AuthSvc
    UI --> Actor : (11) Redirect to home page
end

== Forgot Password ==

Actor -> UI : (1) Select "Forgot Password"
UI -> AuthSvc : (13) Submit email for password reset
activate AuthSvc

AuthSvc -> AuthSvc : (14) Dispatch reset code\n(always succeeds — anti-enumeration)

opt Account exists
    AuthSvc -> OTPSvc : Send single-use OTP (valid 60 min)
    activate OTPSvc
    OTPSvc --> AuthSvc : dispatched
    deactivate OTPSvc
end

AuthSvc --> UI : MSG-AUTH-04
deactivate AuthSvc
UI --> Actor : (15) Show MSG-AUTH-04

== Logout ==

Actor -> UI : (16) Click Logout
UI -> AuthSvc : Submit logout request
activate AuthSvc
AuthSvc -> AuthSvc : (17) Invalidate session
AuthSvc --> UI : Success
deactivate AuthSvc
UI --> Actor : (18) Redirect to sign-in page

@enduml
```

---

## SD-2: UC-2 — Discover Restaurants & Food

```plantuml
@startuml SD-2_DiscoverRestaurants

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-2: UC-2 — Discover Restaurants & Food

actor "User / Guest" as Actor
boundary "Discovery Page" as UI
control "Search Service" as SearchSvc
database "Restaurant & Menu Catalog" as Catalog

autonumber stop

Actor -> UI : (1) Navigate to discovery page\nor enter search criteria
UI -> SearchSvc : (2) Submit search request\n(keyword, category, cuisine, coordinates?)
activate SearchSvc

SearchSvc -> SearchSvc : (3) Validate search parameters

alt Parameters invalid
    SearchSvc --> UI : Reject — MSG-DISC-01
    deactivate SearchSvc
    UI --> Actor : (6) Show MSG-DISC-01
else Parameters valid
    SearchSvc -> Catalog : (4) Query matching restaurants and menu items\n(approved & open restaurants; available items; relevance scoring)
    activate Catalog
    Catalog --> SearchSvc : matching results
    deactivate Catalog
    SearchSvc --> UI : Paginated results with totals
    deactivate SearchSvc
    UI --> Actor : (5) Display results\n(restaurants and menu items)
end

@enduml
```

---

## SD-3: UC-3 — View Restaurant Details

```plantuml
@startuml SD-3_ViewRestaurantDetails

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-3: UC-3 — View Restaurant Details

actor "User / Guest" as Actor
boundary "Restaurant Detail Page" as UI
control "Restaurant Service" as RestSvc

autonumber stop

Actor -> UI : (1) Select a restaurant
UI -> RestSvc : (2) Request restaurant profile (restaurantId)
activate RestSvc

alt Restaurant not found
    RestSvc --> UI : Reject — MSG-REST-01
    deactivate RestSvc
    UI --> Actor : (5) Show MSG-REST-01
else Restaurant found
    RestSvc -> RestSvc : (3) Load full menu structure\n(categories, items, modifier groups)
    RestSvc --> UI : Restaurant profile and menu
    deactivate RestSvc
    UI --> Actor : (4) Display restaurant details and menu
end

@enduml
```

---

## SD-4: UC-4 — Add Item to Cart

```plantuml
@startuml SD-4_AddItemToCart

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-4: UC-4 — Add Item to Cart

actor "Customer" as Actor
boundary "Cart Page" as UI
control "Cart Service" as CartSvc

autonumber stop

Actor -> UI : (1) Select menu item and configure modifiers
Actor -> UI : (2) Tap "Add to Cart"
UI -> CartSvc : Submit add-item request
activate CartSvc

CartSvc -> CartSvc : (3) Validate item, modifiers and quantity

alt Item unavailable or modifiers invalid
    CartSvc --> UI : Reject — MSG-CART-01 to MSG-CART-07
    deactivate CartSvc
    UI --> Actor : (9) Show validation error
else Validation passed
    CartSvc -> CartSvc : (4) Check restaurant consistency

    alt Cart belongs to a different restaurant
        CartSvc --> UI : Reject — MSG-CART-08 or MSG-CART-09
        deactivate CartSvc
        UI --> Actor : (8) Show different-restaurant error
    else Same restaurant or empty cart
        CartSvc -> CartSvc : (5) Merge with existing cart line or add new item\n(same modifiers → merge; max quantity = 99)

        alt Line quantity would exceed 99
            CartSvc --> UI : Reject — MSG-CART-10
            deactivate CartSvc
            UI --> Actor : (7) Show quantity ceiling error
        else Quantity valid
            CartSvc -> CartSvc : Save cart and reset TTL
            CartSvc --> UI : Updated cart
            deactivate CartSvc
            UI --> Actor : (6) Confirm item added to cart
        end
    end
end

@enduml
```

---

## SD-5: UC-5 — Manage Shopping Cart

```plantuml
@startuml SD-5_ManageCart

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-5: UC-5 — Manage Shopping Cart

actor "Customer" as Actor
boundary "Cart Page" as UI
control "Cart Service" as CartSvc
database "Cart Store" as CartStore

autonumber stop

Actor -> UI : (1) Open cart

== View Cart ==

UI -> CartSvc : (3) Load and return cart contents
activate CartSvc
CartSvc -> CartStore : Retrieve customer cart
activate CartStore
CartStore --> CartSvc : cart | null
deactivate CartStore
CartSvc --> UI : Cart contents (or null)
deactivate CartSvc
UI --> Actor : Display cart

== Update Item Quantity ==

Actor -> UI : (2) Select "Update Quantity"
UI -> CartSvc : (4) Submit quantity update
activate CartSvc

CartSvc -> CartSvc : Validate quantity and find line

alt Line not found
    CartSvc --> UI : Reject — MSG-CART-11
    deactivate CartSvc
    UI --> Actor : (6) Show MSG-CART-11
else Line found
    CartSvc -> CartStore : (5) Save updated cart (reset TTL)
    activate CartStore
    CartStore --> CartSvc : saved
    deactivate CartStore
    CartSvc --> UI : Updated cart
    deactivate CartSvc
    UI --> Actor : Display updated cart
end

== Update Item Modifiers ==

Actor -> UI : (2) Select "Update Modifiers"
UI -> CartSvc : (7) Submit modifier update
activate CartSvc

CartSvc -> CartSvc : Validate modifier set and re-fingerprint line

alt Modifiers invalid
    CartSvc --> UI : Reject — MSG-CART-03 to MSG-CART-07
    deactivate CartSvc
    UI --> Actor : (9) Show modifier validation error
else Merged quantity would exceed 99
    CartSvc --> UI : Reject — MSG-CART-10
    deactivate CartSvc
    UI --> Actor : (9) Show quantity overflow error
else Valid
    CartSvc -> CartStore : Save updated cart
    activate CartStore
    CartStore --> CartSvc : saved
    deactivate CartStore
    CartSvc --> UI : Updated cart
    deactivate CartSvc
    UI --> Actor : (8) Display updated cart with new modifiers
end

== Remove Item ==

Actor -> UI : (2) Select "Remove Item"
UI -> CartSvc : (10) Remove line item (cartItemId)
activate CartSvc

alt Line not found
    CartSvc --> UI : Reject — MSG-CART-11
    deactivate CartSvc
    UI --> Actor : (11) Show MSG-CART-11
else Line found
    CartSvc -> CartStore : Remove line and save cart
    activate CartStore
    CartStore --> CartSvc : saved | deleted
    deactivate CartStore
    CartSvc --> UI : Cart (or null)
    deactivate CartSvc
    UI --> Actor : Display updated cart
end

== Clear Cart ==

Actor -> UI : (2) Select "Clear Cart"
UI -> CartSvc : (12) Delete entire cart (idempotent)
activate CartSvc
CartSvc -> CartStore : Delete customer cart
activate CartStore
CartStore --> CartSvc : deleted
deactivate CartStore
CartSvc --> UI : Confirmed
deactivate CartSvc
UI --> Actor : (13) Confirm cart cleared

@enduml
```

---

## SD-6: UC-6 — Save & Manage Delivery Addresses

```plantuml
@startuml SD-6_DeliveryAddresses

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-6: UC-6 — Save & Manage Delivery Addresses

actor "Customer" as Actor
boundary "Checkout Page" as UI
control "Order Service" as OrderSvc

autonumber stop

Actor -> UI : (1) Enter delivery address\n(street, district, city, coordinates?)
UI -> OrderSvc : Submit delivery address for validation
activate OrderSvc

OrderSvc -> OrderSvc : (2) Validate address structure

alt Address structure invalid
    OrderSvc --> UI : Reject — MSG-ADDR-01
    deactivate OrderSvc
    UI --> Actor : (9) Show MSG-ADDR-01
else Structure valid
    OrderSvc -> OrderSvc : (3) Validate coordinate pairing\n(both lat/lon required, or neither)

    alt Coordinate pairing invalid
        OrderSvc --> UI : Reject — MSG-ADDR-02
        deactivate OrderSvc
        UI --> Actor : (8) Show MSG-ADDR-02
    else Coordinates valid or absent
        note over OrderSvc : (4) Address accepted — checkout continues (UC-8)

        OrderSvc -> OrderSvc : (5) Verify delivery zone eligibility\n(Haversine distance vs zone radii)

        alt Address outside all delivery zones
            OrderSvc --> UI : Reject — MSG-ADDR-03
            deactivate OrderSvc
            UI --> Actor : (7) Show MSG-ADDR-03
        else In delivery range
            OrderSvc -> OrderSvc : Accept address — store immutably with order
            OrderSvc --> UI : Address confirmed
            deactivate OrderSvc
            UI --> Actor : (6) Proceed to order confirmation
        end
    end
end

@enduml
```

---

## SD-7: UC-7 — Manage Delivery Zones

```plantuml
@startuml SD-7_ManageDeliveryZones

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-7: UC-7 — Manage Delivery Zones

actor "Restaurant Partner / Admin" as Partner
actor "Customer" as Customer
boundary "Zone Management UI" as ZoneUI
boundary "Restaurant Page" as RestUI
control "Delivery Zone Service" as ZoneSvc
control "Geo Service" as GeoSvc
control "Event Bus" as EventBus

autonumber stop

== Zone Management: Create or Update ==

Partner -> ZoneUI : (1) Initiate zone management request
ZoneUI -> ZoneSvc : (2) Authorize Restaurant Partner / Admin
activate ZoneSvc

alt Not authorized
    ZoneSvc --> ZoneUI : Reject — MSG-ZONE-01
    deactivate ZoneSvc
    ZoneUI --> Partner : (12) Show MSG-ZONE-01
else Authorized
    ZoneSvc -> ZoneSvc : (4) Validate zone configuration

    alt Configuration invalid
        ZoneSvc --> ZoneUI : Reject — MSG-ZONE-02
        deactivate ZoneSvc
        ZoneUI --> Partner : (8) Show MSG-ZONE-02
    else Configuration valid
        ZoneSvc -> ZoneSvc : (5) Execute Create or Update
        ZoneSvc -> EventBus : (6) Synchronise zone data with ordering system
        activate EventBus
        EventBus --> ZoneSvc : snapshot upserted
        deactivate EventBus
        ZoneSvc --> ZoneUI : Success
        deactivate ZoneSvc
        ZoneUI --> Partner : (7) Confirm operation
    end
end

== Zone Management: Delete ==

Partner -> ZoneUI : (1) Initiate delete zone request
ZoneUI -> ZoneSvc : (2) Authorize actor
activate ZoneSvc

alt Not authorized
    ZoneSvc --> ZoneUI : Reject — MSG-ZONE-01
    deactivate ZoneSvc
    ZoneUI --> Partner : (12) Show MSG-ZONE-01
else Authorized
    ZoneSvc -> ZoneSvc : Look up zone by ID

    alt Zone not found
        ZoneSvc --> ZoneUI : Reject — MSG-ZONE-03
        deactivate ZoneSvc
        ZoneUI --> Partner : (11) Show MSG-ZONE-03
    else Zone found
        ZoneSvc -> ZoneSvc : (9) Execute Delete
        ZoneSvc -> EventBus : Synchronise deletion with ordering system
        activate EventBus
        EventBus --> ZoneSvc : snapshot removed
        deactivate EventBus
        ZoneSvc --> ZoneUI : Success
        deactivate ZoneSvc
        ZoneUI --> Partner : (10) Confirm deletion
    end
end

== Delivery Estimate ==

Customer -> RestUI : (1) Request delivery fee estimate
RestUI -> ZoneSvc : (13) Validate restaurant location and active zones
activate ZoneSvc

alt No location or no active zones
    ZoneSvc --> RestUI : Reject — MSG-ZONE-04
    deactivate ZoneSvc
    RestUI --> Customer : (17) Show MSG-ZONE-04
else Configuration available
    ZoneSvc -> GeoSvc : (14) Compute Haversine distance and select innermost eligible zone
    activate GeoSvc
    GeoSvc --> ZoneSvc : distance in km + selected zone | null
    deactivate GeoSvc

    alt No eligible zone
        ZoneSvc --> RestUI : Reject — MSG-ZONE-05
        deactivate ZoneSvc
        RestUI --> Customer : (16) Show MSG-ZONE-05
    else Eligible zone found
        ZoneSvc -> ZoneSvc : Compute delivery fee and ETA
        ZoneSvc --> RestUI : Delivery fee and estimated time
        deactivate ZoneSvc
        RestUI --> Customer : (15) Display fee and delivery time
    end
end

@enduml
```

---

## SD-8: UC-8 — Place Order

```plantuml
@startuml SD-8_PlaceOrder

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-8: UC-8 — Place Order

actor "Customer" as Actor
boundary "Checkout Page" as UI
control "Order Service" as OrderSvc
control "Promotion Service" as PromSvc
control "Event Bus" as EventBus
control "Payment Service" as PaySvc

autonumber stop

Actor -> UI : (1) Confirm checkout\n(address, payment method, coupon?)
UI -> OrderSvc : Submit checkout request [X-Idempotency-Key?]
activate OrderSvc

OrderSvc -> OrderSvc : (2) Validate checkout request

alt Checkout data invalid
    OrderSvc --> UI : Reject — MSG-ORD-01 or MSG-ORD-02
    deactivate OrderSvc
    UI --> Actor : (18) Show validation error
else Data valid

    OrderSvc -> OrderSvc : (3) Check idempotency record

    alt Duplicate request — order already placed
        OrderSvc --> UI : Return existing order
        deactivate OrderSvc
        UI --> Actor : (17) Return existing order (idempotent)
    else New request

        OrderSvc -> OrderSvc : (4) Acquire checkout lock

        alt Concurrent checkout in progress
            OrderSvc --> UI : Reject — MSG-ORD-03
            deactivate OrderSvc
            UI --> Actor : (16) Show MSG-ORD-03
        else Lock acquired

            OrderSvc -> OrderSvc : (5) Validate cart, restaurant, items and modifiers

            alt Cart or catalog validation fails
                OrderSvc --> UI : Reject — MSG-ORD-04 to MSG-ORD-10
                deactivate OrderSvc
                UI --> Actor : (15) Show validation error
            else Validation passed

                OrderSvc -> OrderSvc : (6) Compute delivery fee and check zone eligibility

                alt Address outside delivery range
                    OrderSvc --> UI : Reject — MSG-ORD-11
                    deactivate OrderSvc
                    UI --> Actor : (14) Show MSG-ORD-11
                else In delivery range

                    opt Coupon code provided
                        OrderSvc -> PromSvc : (7) Reserve promotion 
                        activate PromSvc
                        PromSvc --> OrderSvc : discount amount | no discount
                        deactivate PromSvc
                    end

                    OrderSvc -> OrderSvc : (8) Save order with server-authoritative pricing

                    alt Persistence failure
                        OrderSvc --> UI : Reject — MSG-ORD-13 or MSG-ORD-14
                        deactivate OrderSvc
                        UI --> Actor : (13) Show error
                    else Order saved

                        opt Payment method: VNPay
                            OrderSvc -> PaySvc : (10) Initiate payment session
                            activate PaySvc
                            PaySvc --> OrderSvc : payment URL
                            deactivate PaySvc
                        end

                        OrderSvc -> EventBus : (11) Publish order event; clear cart
                        activate EventBus
                        EventBus --> OrderSvc : published
                        deactivate EventBus

                        OrderSvc --> UI : Order confirmation (orderId, status, paymentUrl?)
                        deactivate OrderSvc
                        UI --> Actor : (12) Return order confirmation
                    end
                end
            end
        end
    end
end

@enduml
```

---

## SD-9: UC-9 — Make Online Payment (VNPay)

```plantuml
@startuml SD-9_VNPayPayment

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-9: UC-9 — Make Online Payment (VNPay)

actor "Customer" as Actor
boundary "VNPay Gateway" as VNPay
control "Payment Service" as PaySvc
control "Order Service" as OrderSvc

autonumber stop

== VNPay IPN Callback ==

Actor -> VNPay : (2) Open VNPay payment URL
Actor -> VNPay : (3) Complete payment on VNPay hosted page
VNPay --> Actor : Payment result page displayed

VNPay -> PaySvc : (4) Send IPN notification
activate PaySvc

PaySvc -> PaySvc : (5) Verify payment callback authenticity\n(HMAC-SHA512 signature)

alt Signature invalid
    PaySvc --> VNPay : (15) MSG-PAY-01 — invalid signature (RspCode 97)
    deactivate PaySvc
else Signature valid

    PaySvc -> PaySvc : (6) Locate payment transaction

    alt Transaction not found
        PaySvc --> VNPay : (14) MSG-PAY-02 — transaction not found (RspCode 01)
        deactivate PaySvc
    else Transaction found

        PaySvc -> PaySvc : (7) Check transaction state

        alt Already in terminal state
            PaySvc --> VNPay : (13) MSG-PAY-06 — already processed (RspCode 00)
            deactivate PaySvc
        else Non-terminal state

            PaySvc -> PaySvc : (8) Verify payment amount

            alt Amount mismatch
                PaySvc -> OrderSvc : Cancel associated order
                activate OrderSvc
                OrderSvc --> PaySvc : order cancelled
                deactivate OrderSvc
                PaySvc --> VNPay : (12) MSG-PAY-03 — amount mismatch (RspCode 04)
                deactivate PaySvc
            else Amount valid

                alt VNPay reports success
                    PaySvc -> OrderSvc : Advance order to paid status
                    activate OrderSvc
                    OrderSvc --> PaySvc : order updated
                    deactivate OrderSvc
                    PaySvc --> VNPay : (10) MSG-PAY-04 — success (RspCode 00)
                    deactivate PaySvc
                else VNPay reports failure
                    PaySvc -> OrderSvc : Cancel associated order
                    activate OrderSvc
                    OrderSvc --> PaySvc : order cancelled
                    deactivate OrderSvc
                    PaySvc --> VNPay : (11) MSG-PAY-05 — acknowledged (RspCode 00)
                    deactivate PaySvc
                end
            end
        end
    end
end

== Scheduled Timeout ==

control "Payment Timeout Scheduler" as Scheduler

Scheduler -> Scheduler : (16) Detect expired payment sessions\n(status: pending or awaiting IPN, past expiry time)
activate Scheduler

loop For each expired transaction
    Scheduler -> OrderSvc : (17) Mark payment failed; cancel associated order
    activate OrderSvc
    OrderSvc --> Scheduler : cancelled
    deactivate OrderSvc
end

deactivate Scheduler

@enduml
```

---

## SD-10: UC-10 — View Order History

```plantuml
@startuml SD-10_ViewOrderHistory

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-10: UC-10 — View Order History

actor "Customer" as Actor
boundary "Orders Screen" as UI
control "Order History Service" as HistSvc
database "Order Repository" as OrderRepo

autonumber stop

Actor -> UI : (1) Navigate to order history
Actor -> UI : (2) Select operation

== List Orders ==

UI -> HistSvc : (3) Load order list and validate filters
activate HistSvc

alt Filters invalid
    HistSvc --> UI : Reject — MSG-HIST-02
    deactivate HistSvc
    UI --> Actor : (6) Show MSG-HIST-02
else Filters valid
    HistSvc -> OrderRepo : (4) Query orders scoped to current customer
    activate OrderRepo
    OrderRepo --> HistSvc : paginated order rows + total count
    deactivate OrderRepo
    HistSvc --> UI : Order list with total
    deactivate HistSvc
    UI --> Actor : (5) Display paginated order list
end

== View Order Detail ==

Actor -> UI : (7) Select a specific order
UI -> HistSvc : (8) Load order, items and status audit log (orderId)
activate HistSvc

HistSvc -> OrderRepo : Retrieve order with items and status log\n(404 if not found or not owned; chronological status log)
activate OrderRepo
OrderRepo --> HistSvc : order + items + status log | null
deactivate OrderRepo

alt Order not found or belongs to different customer
    HistSvc --> UI : Reject — MSG-HIST-01
    deactivate HistSvc
    UI --> Actor : (10) Show MSG-HIST-01
else Order found and owned
    HistSvc --> UI : Full order detail (order + items + timeline)
    deactivate HistSvc
    UI --> Actor : (9) Display order detail with status timeline
end

== Reorder ==

Actor -> UI : (11) Select "Reorder" on a past order
UI -> HistSvc : (12) Build reorder proposal (orderId)
activate HistSvc

HistSvc -> OrderRepo : Load historical order and items
activate OrderRepo
OrderRepo --> HistSvc : order + items
deactivate OrderRepo

HistSvc -> HistSvc : Build cart-shaped reorder payload

note over HistSvc : No cart mutation occurs.\nReturns a read-only proposal.\nUC-4 re-validates all items\nwhen customer re-adds them.

HistSvc --> UI : Reorder payload
deactivate HistSvc
UI --> Actor : (13) Display reorder proposal\n(customer selects items to re-add via UC-4)

@enduml
```

---

## SD-11: UC-11 — Restaurant Registration & Profile Management

```plantuml
@startuml SD-11_RestaurantRegistrationProfileManagement

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-11: UC-11 — Restaurant Registration & Profile Management

actor "Restaurant Partner" as Partner
boundary "Restaurant Profile Screen" as UI
control "Restaurant Service" as RestSvc
database "Restaurant Store" as RestDB
control "Ordering ACL Service" as ACLSvc

autonumber stop

== Register New Restaurant ==

Partner -> UI : (1) Open Registration screen
Partner -> UI : (2) Fill in restaurant details
UI -> RestSvc : (3) Submit registration request
activate RestSvc

RestSvc -> RestSvc : (4) Authenticate session and verify role

alt Role not permitted or input invalid
    RestSvc --> UI : (18) Reject — MSG-RES-01 or MSG-RES-02
    deactivate RestSvc
    UI --> Partner : Show error
else Role permitted and input valid
    RestSvc -> RestDB : (7) Create restaurant record
note right of RestDB : isApproved=false, isOpen=false
    RestDB --> RestSvc : Restaurant created
    RestSvc -> ACLSvc : (8) Synchronise restaurant data with ordering system
    RestSvc --> UI : (9) Confirm submission — MSG-RES-03
    deactivate RestSvc
    UI --> Partner : Show confirmation
end

== Update Restaurant Profile ==

Partner -> UI : (1) Open Profile Management screen
Partner -> UI : (2) Edit restaurant details
UI -> RestSvc : (3) Submit profile-update request
activate RestSvc

RestSvc -> RestSvc : (4) Authenticate session and verify role
RestSvc -> RestDB : (10) Load restaurant by id
RestDB --> RestSvc : Restaurant or not found

alt Restaurant not found
    RestSvc --> UI : (17) Return not found — MSG-REST-01
    deactivate RestSvc
    UI --> Partner : Show error
else Restaurant exists
    RestSvc -> RestSvc : (12) Admin OR ownerId = session.user.id?
    alt Access denied
        RestSvc --> UI : (16) Return access denied — MSG-RES-02
        deactivate RestSvc
        UI --> Partner : Show error
    else Authorised
        RestSvc -> RestDB : (13) Apply and save profile updates
        RestDB --> RestSvc : Updated restaurant
        RestSvc -> ACLSvc : (14) Synchronise updated profile with ordering system
        RestSvc --> UI : (15) Return updated profile — MSG-RES-04
        deactivate RestSvc
        UI --> Partner : Show updated profile
    end
end

== Admin Approval ==

actor "Administrator" as Admin
boundary "Pending Restaurants Queue" as AdminUI

Admin -> AdminUI : (19) Open Pending Restaurants queue
Admin -> AdminUI : (20) Review application and choose Approve or Unapprove
AdminUI -> RestSvc : (21) Verify administrator role and submit decision
activate RestSvc

RestSvc -> RestDB : (22) Update restaurant approval status
RestDB --> RestSvc : Updated restaurant
RestSvc -> ACLSvc : (23) Synchronise approval change with ordering system
RestSvc --> AdminUI : (24) Return approval decision — MSG-RES-05
deactivate RestSvc
AdminUI --> Admin : Show decision result

@enduml
```

---

## SD-12: UC-12 — Manage Menu Catalog

```plantuml
@startuml SD-12_ManageMenuCatalog

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-12: UC-12 — Manage Menu Catalog

actor "Restaurant Partner" as Partner
boundary "Menu Management Screen" as UI
control "Menu Catalog Service" as MenuSvc
database "Menu Store" as MenuDB
control "Ordering ACL Service" as ACLSvc

autonumber stop

== Create / Update / Delete Catalog Resource ==

Partner -> UI : (1) Open Menu Management screen for own restaurant
Partner -> UI : (2) Select target resource
Partner -> UI : (3) Provide create/update payload or pick row to delete
UI -> MenuSvc : (4) Submit the request
activate MenuSvc

MenuSvc -> MenuSvc : (5) Verify session and authorized role

alt Input fails validation
    MenuSvc --> UI : (17) Return validation error — MSG-MENU-01 or MSG-MENU-06
    deactivate MenuSvc
    UI --> Partner : Show validation error
else Input valid
    MenuSvc -> MenuDB : (7) Resolve owning restaurant of the target resource
    MenuDB --> MenuSvc : Owner restaurant id

    alt Caller does not own the restaurant
        MenuSvc --> UI : (16) Return access denied — MSG-MENU-05
        deactivate MenuSvc
        UI --> Partner : Show access denied
    else Caller is admin or owns the restaurant
        alt Resource not found (update/delete)
            MenuSvc --> UI : (15) Return not found — MSG-MENU-04 or MSG-MENU-07
            deactivate MenuSvc
            UI --> Partner : Show not found
        else Resource exists or create operation
            MenuSvc -> MenuDB : (10) Save catalog change
            MenuDB --> MenuSvc : Saved resource
            MenuSvc -> MenuDB : (11) Update modifier data for affected catalog items
            MenuSvc -> ACLSvc : (12) Synchronise catalog changes with ordering system
            ACLSvc --> MenuSvc : (13) Ordering system catalog view is refreshed
            MenuSvc --> UI : (14) Return updated resource
            deactivate MenuSvc
            UI --> Partner : Show updated catalog
        end
    end
end

@enduml
```

---

## SD-13: UC-13 — Toggle Item & Restaurant Availability

```plantuml
@startuml SD-13_ToggleItemRestaurantAvailability

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-13: UC-13 — Toggle Item & Restaurant Availability

actor "Restaurant Partner" as Partner
boundary "Availability Screen" as UI
control "Availability Service" as AvailSvc
database "Catalog Store" as CatalogDB
control "Ordering ACL Service" as ACLSvc

autonumber stop

== Toggle Availability ==

Partner -> UI : (1) Open Menu/Restaurant Availability screen
Partner -> UI : (2) Choose target: menu item OR restaurant itself
UI -> AvailSvc : (3) Submit toggle/open-close request
activate AvailSvc

AvailSvc -> AvailSvc : (4) Verify session and authorized role
AvailSvc -> CatalogDB : (5) Load target resource by id
CatalogDB --> AvailSvc : Resource or not found

alt Resource not found
    AvailSvc --> UI : (19) Return not found — MSG-MENU-04 or MSG-REST-01
    deactivate AvailSvc
    UI --> Partner : Show not found
else Resource exists
    AvailSvc -> CatalogDB : (7) Resolve owning restaurant and verify ownership
    CatalogDB --> AvailSvc : Ownership result

    alt Ownership check fails
        AvailSvc --> UI : (18) Return access denied — MSG-RES-02 or MSG-MENU-05
        deactivate AvailSvc
        UI --> Partner : Show access denied
    else Ownership OK
        alt Target is a menu item
            alt Item status is unavailable
                AvailSvc --> UI : (14) Return conflict — MSG-AVAIL-01
                deactivate AvailSvc
                UI --> Partner : Show conflict (must use UC-12 to re-publish)
            else Item is available or out_of_stock
                AvailSvc -> CatalogDB : (11) Toggle item availability (available ↔ out_of_stock)
                AvailSvc -> ACLSvc : (12) Save new availability and propagate change
                AvailSvc --> UI : (13) Confirm toggle — MSG-AVAIL-03
                deactivate AvailSvc
                UI --> Partner : Show updated item availability
            end
        else Target is the restaurant
            AvailSvc -> CatalogDB : (15) Update restaurant open/closed status
            AvailSvc -> ACLSvc : (16) Propagate availability change to customer surfaces
            AvailSvc --> UI : (17) Confirm status change — MSG-AVAIL-02
            deactivate AvailSvc
            UI --> Partner : Show updated restaurant status
        end
    end
end

@enduml
```

---

## SD-14: UC-14 — Accept or Reject Order

```plantuml
@startuml SD-14_AcceptOrRejectOrder

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-14: UC-14 — Accept or Reject Order

actor "Restaurant Partner" as Partner
boundary "Restaurant Order Inbox" as UI
control "Order Lifecycle Service" as LifecycleSvc
database "Order Store" as OrderDB
control "Notification Service" as NotifSvc
control "Payment Service" as PaySvc

autonumber stop

== Accept or Reject Order ==

Partner -> UI : (1) Open Restaurant Order Inbox
Partner -> UI : (2) Select a new order in pending or paid state
Partner -> UI : (3) Choose Accept or Reject (Reject requires a reason note)
UI -> LifecycleSvc : (4) Submit decision
activate LifecycleSvc

LifecycleSvc -> LifecycleSvc : (5) Verify session and resolve actor role
LifecycleSvc -> OrderDB : (6) Load order by id
OrderDB --> LifecycleSvc : Order or not found

alt Order not found
    LifecycleSvc --> UI : (28) Return not found — MSG-HIST-01
    deactivate LifecycleSvc
    UI --> Partner : Show not found
else Order found
    LifecycleSvc -> LifecycleSvc : (8) Validate that the requested status transition is permitted

    alt Transition not permitted or role not allowed
        LifecycleSvc --> UI : (27) Return role or state error — MSG-LCYC-02 or MSG-LCYC-01
        deactivate LifecycleSvc
        UI --> Partner : Show error
    else Transition permitted
        LifecycleSvc -> LifecycleSvc : (10) Verify restaurant ownership of the order

        alt Ownership check fails
            LifecycleSvc --> UI : (26) Return access denied — MSG-LCYC-03
            deactivate LifecycleSvc
            UI --> Partner : Show access denied
        else Ownership OK
            alt Action is Accept AND order has unpaid VNPay payment
                LifecycleSvc --> UI : (15) Return state error — MSG-LCYC-04
                deactivate LifecycleSvc
                UI --> Partner : Show state error
            else
                alt requireNote=true AND reason is blank
                    LifecycleSvc --> UI : (17) Return validation error — MSG-LCYC-05
                    deactivate LifecycleSvc
                    UI --> Partner : Show validation error
                else
                    LifecycleSvc -> OrderDB : (19) Update order status
                    LifecycleSvc -> OrderDB : (20) Append status change to audit log
                    OrderDB --> LifecycleSvc : Updated order
                    LifecycleSvc -> NotifSvc : (22) Notify downstream services of status change
                    opt Cancellation of a VNPay-paid order
                        LifecycleSvc -> PaySvc : (24) Initiate payment refund pipeline
                    end
                    LifecycleSvc --> UI : (25) Return updated order — MSG-LCYC-07 or MSG-LCYC-08
                    deactivate LifecycleSvc
                    UI --> Partner : Show updated order
                end
            end
        end
    end
end

@enduml
```

---

## SD-15: UC-15 — Prepare Order for Pickup

```plantuml
@startuml SD-15_PrepareOrderForPickup

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-15: UC-15 — Prepare Order for Pickup

actor "Restaurant Partner" as Partner
boundary "Restaurant Order Inbox" as UI
control "Order Lifecycle Service" as LifecycleSvc
database "Order Store" as OrderDB
control "Notification Service" as NotifSvc
control "Dispatch Service" as DispatchSvc

autonumber stop

== Start Preparing ==

Partner -> UI : (1) Open Restaurant Order Inbox
Partner -> UI : (2) Select a confirmed order to start preparing
UI -> LifecycleSvc : (3) Submit Start Preparing
activate LifecycleSvc

LifecycleSvc -> LifecycleSvc : (4) Verify session and resolve actor role
LifecycleSvc -> OrderDB : (5) Load order and verify restaurant ownership
OrderDB --> LifecycleSvc : Order and ownership result

alt Ownership fails or status is not confirmed
    LifecycleSvc --> UI : (21) Return role or state error — MSG-LCYC-02 or MSG-LCYC-01
    deactivate LifecycleSvc
    UI --> Partner : Show error
else Ownership OK and status = confirmed
    LifecycleSvc -> OrderDB : (7) Advance order to Preparing and append status change to audit log
    OrderDB --> LifecycleSvc : Updated order
    LifecycleSvc -> NotifSvc : (8) Notify downstream services of status change
    LifecycleSvc --> UI : (9) Confirm order is now Preparing — MSG-LCYC-09
    deactivate LifecycleSvc
    UI --> Partner : Show Preparing status
end

== Mark Ready for Pickup ==

Partner -> UI : (10) Cook and pack the order
Partner -> UI : (11) Submit Mark Ready for Pickup
UI -> LifecycleSvc : Submit Ready for Pickup transition
activate LifecycleSvc

LifecycleSvc -> OrderDB : (12) Re-verify ownership and order is still Preparing
OrderDB --> LifecycleSvc : Order and ownership result

alt Pre-conditions not met
    LifecycleSvc --> UI : (22) Return role or state error — MSG-LCYC-02 or MSG-LCYC-01
    deactivate LifecycleSvc
    UI --> Partner : Show error
else Pre-conditions OK
    LifecycleSvc -> OrderDB : (14) Advance order to Ready for Pickup and append status change to audit log
    OrderDB --> LifecycleSvc : Updated order
    LifecycleSvc -> NotifSvc : (15) Notify downstream services of status change
    LifecycleSvc -> OrderDB : (16) Load restaurant data for dispatch notification
    OrderDB --> LifecycleSvc : Restaurant snapshot or missing

    alt Snapshot present
        LifecycleSvc -> DispatchSvc : (18) Notify dispatch service — order is ready for pickup
    else Snapshot missing
        LifecycleSvc -> LifecycleSvc : (19) Log warning and proceed
note right : Dispatch notification may be delayed
    end

    LifecycleSvc --> UI : (20) Confirm order is Ready for Pickup — MSG-LCYC-10
    deactivate LifecycleSvc
    UI --> Partner : Show Ready for Pickup status
end

@enduml
```

---

## SD-16: UC-16 — Shipper Registration

```plantuml
@startuml SD-16_ShipperRegistration

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-16: UC-16 — Shipper Registration

actor "Applicant" as Applicant
boundary "Become a Shipper Screen" as UI
control "Shipper Service" as ShipperSvc
database "Shipper Store" as ShipperDB
actor "Administrator" as Admin
boundary "Shipper Approval Queue" as AdminUI
control "Notification Service" as NotifSvc

autonumber stop

== Submit Application ==

Applicant -> UI : (1) Open Become a Shipper screen
Applicant -> UI : (2) Provide personal info, vehicle type, licence plate, ID and licence images
UI -> ShipperSvc : (3) Submit application
activate ShipperSvc

ShipperSvc -> ShipperSvc : (4) Authenticate session and validate input

alt Input invalid or existing application found
    ShipperSvc --> UI : (17) Return validation or duplicate error — MSG-SHIP-01 or MSG-SHIP-02
    deactivate ShipperSvc
    UI --> Applicant : Show error
else Input valid and no existing application
    ShipperSvc -> ShipperDB : (6) Submit application for admin review
    ShipperDB --> ShipperSvc : Application created
    ShipperSvc --> UI : (7) Return application receipt — MSG-SHIP-03
    deactivate ShipperSvc
    UI --> Applicant : Show receipt
end

== Admin Review ==

Admin -> AdminUI : (8) Open Shipper Approval Queue
Admin -> AdminUI : (9) Review documents and decide
AdminUI -> ShipperSvc : (10) Submit decision (Approve or Reject)
activate ShipperSvc

alt Decision is Approve
    ShipperSvc -> ShipperDB : (11) Approve the application
    ShipperSvc -> ShipperDB : (12) Activate shipper account (elevate role)
    ShipperDB --> ShipperSvc : Application approved
    ShipperSvc -> NotifSvc : (13) Notify downstream services of shipper activation
    ShipperSvc --> AdminUI : (14) Return approved status — MSG-SHIP-04
    deactivate ShipperSvc
    AdminUI --> Admin : Show approved status
else Decision is Reject
    ShipperSvc -> ShipperDB : (15) Mark application rejected with reason note
    ShipperDB --> ShipperSvc : Application rejected
    ShipperSvc --> AdminUI : (16) Return rejected status — MSG-SHIP-05
    deactivate ShipperSvc
    AdminUI --> Admin : Show rejected status
end

@enduml
```

---

## SD-17: UC-17 — Manage Shipper Availability

```plantuml
@startuml SD-17_ManageShipperAvailability

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-17: UC-17 — Manage Shipper Availability

actor "Shipper" as Shipper
boundary "Shipper Console" as UI
control "Shipper Service" as ShipperSvc
database "Shipper Store" as ShipperDB
control "Dispatch Service" as DispatchSvc

autonumber stop

== Toggle Availability ==

Shipper -> UI : (1) Open Shipper console
Shipper -> UI : (2) Toggle availability switch (online/offline)
UI -> ShipperSvc : (3) Submit new status
activate ShipperSvc

ShipperSvc -> ShipperSvc : (4) Verify session and shipper role

alt Role not OK or account not approved
    ShipperSvc --> UI : (13) Return access denied — MSG-SHIP-04
    deactivate ShipperSvc
    UI --> Shipper : Show access denied
else Role OK and account approved
    alt New status is offline
        ShipperSvc -> ShipperDB : (7) Check for any in-flight delivery (picked_up or delivering)
        ShipperDB --> ShipperSvc : In-flight delivery result

        alt Active delivery exists
            ShipperSvc --> UI : (8) Return conflict — MSG-SHIP-07
            deactivate ShipperSvc
            UI --> Shipper : Show conflict
        else No active delivery
            ShipperSvc -> ShipperDB : (9) Set availability to Offline
            ShipperDB --> ShipperSvc : Updated
            ShipperSvc -> DispatchSvc : (11) Notify dispatch service of availability change
            ShipperSvc --> UI : (12) Confirm new availability — MSG-SHIP-06
            deactivate ShipperSvc
            UI --> Shipper : Show Offline status
        end
    else New status is online
        ShipperSvc -> ShipperDB : (10) Set availability to Online
        ShipperDB --> ShipperSvc : Updated
        ShipperSvc -> DispatchSvc : (11) Notify dispatch service of availability change
        ShipperSvc --> UI : (12) Confirm new availability — MSG-SHIP-06
        deactivate ShipperSvc
        UI --> Shipper : Show Online status
    end
end

@enduml
```

---

## SD-18: UC-18 — Accept Delivery Assignment

```plantuml
@startuml SD-18_AcceptDeliveryAssignment

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-18: UC-18 — Accept Delivery Assignment

actor "Shipper" as Shipper
boundary "Delivery Assignment Screen" as UI
control "Order Lifecycle Service" as LifecycleSvc
database "Order Store" as OrderDB
control "Notification Service" as NotifSvc

autonumber stop

== Claim Ready-for-Pickup Order ==

NotifSvc -> UI : (1) Receive ready_for_pickup order notification
Shipper -> UI : (2) Tap Accept Pickup on the order card
UI -> LifecycleSvc : (3) Submit T-09 pickup claim request
activate LifecycleSvc

LifecycleSvc -> LifecycleSvc : (4) Verify session and resolve actor role
LifecycleSvc -> OrderDB : (5) Load order by id
OrderDB --> LifecycleSvc : Order or not found

alt Order not found
    LifecycleSvc --> UI : (20) Return not found — MSG-HIST-01
    deactivate LifecycleSvc
    UI --> Shipper : Show not found
else Order found
    LifecycleSvc -> LifecycleSvc : (7) Validate pickup transition is permitted

    alt Role not permitted
        LifecycleSvc --> UI : (19) Return access denied — MSG-LCYC-02
        deactivate LifecycleSvc
        UI --> Shipper : Show access denied
    else Role permitted
        LifecycleSvc -> LifecycleSvc : (9) Shipper account is approved and online?

        alt Account not approved or offline
            LifecycleSvc --> UI : (18) Return access denied — MSG-SHIP-04
            deactivate LifecycleSvc
            UI --> Shipper : Show access denied
        else Account approved and online
            LifecycleSvc -> OrderDB : (11) Assign order to shipper and update status (T-09)
            OrderDB --> LifecycleSvc : Assignment result

            alt Self-assignment failed (concurrent claim)
                LifecycleSvc --> UI : (17) Return conflict — MSG-DEL-02
                deactivate LifecycleSvc
                UI --> Shipper : Show conflict
            else Assignment successful
                LifecycleSvc -> OrderDB : (13) Append status change to audit log
                OrderDB --> LifecycleSvc : Log written
                LifecycleSvc -> NotifSvc : (15) Notify downstream services of pickup assignment
                LifecycleSvc --> UI : (16) Return updated order — MSG-DEL-01
                deactivate LifecycleSvc
                UI --> Shipper : Show updated order
            end
        end
    end
end

@enduml
```

---

## SD-19: UC-19 — Deliver Order

```plantuml
@startuml SD-19_DeliverOrder

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-19: UC-19 — Deliver Order

actor "Shipper" as Shipper
boundary "Shipper Console" as UI
control "Order Lifecycle Service" as LifecycleSvc
database "Order Store" as OrderDB
control "Notification Service" as NotifSvc

autonumber stop

== Start Delivery ==

Shipper -> UI : (1) Open assigned delivery in shipper console
Shipper -> UI : (2) Tap Start Delivery to begin en-route leg
UI -> LifecycleSvc : (3) Submit Start Delivery (T-10)
activate LifecycleSvc

LifecycleSvc -> LifecycleSvc : (4) Verify session and resolve actor role
LifecycleSvc -> OrderDB : (5) Load order and verify shipper assignment
OrderDB --> LifecycleSvc : Order and assignment result

alt Ownership fails or status is not picked_up
    LifecycleSvc --> UI : (17) Return role or state error — MSG-DEL-03 or MSG-LCYC-01
    deactivate LifecycleSvc
    UI --> Shipper : Show error
else Assignment OK and status = picked_up
    LifecycleSvc -> OrderDB : (7) Advance order to Delivering and append status change to audit log
    OrderDB --> LifecycleSvc : Updated order
    LifecycleSvc -> NotifSvc : (8) Notify downstream services of status change
    LifecycleSvc --> UI : Return order in Delivering status
    deactivate LifecycleSvc
    UI --> Shipper : Show Delivering status
end

== Mark Delivered ==

Shipper -> UI : (9) Travel to customer and hand over the order
Shipper -> UI : (10) Tap Mark Delivered
UI -> LifecycleSvc : (11) Submit Delivered confirmation (T-11)
activate LifecycleSvc

LifecycleSvc -> OrderDB : (12) Re-verify assignment and order is still Delivering
OrderDB --> LifecycleSvc : Order and assignment result

alt Pre-conditions not met
    LifecycleSvc --> UI : (18) Return role or state error — MSG-DEL-03 or MSG-LCYC-01
    deactivate LifecycleSvc
    UI --> Shipper : Show error
else Pre-conditions OK
    LifecycleSvc -> OrderDB : (14) Advance order to Delivered and append status change to audit log
    OrderDB --> LifecycleSvc : Updated order
    LifecycleSvc -> NotifSvc : (15) Notify downstream services of delivery completion
    LifecycleSvc --> UI : (16) Return updated order — MSG-DEL-04
    deactivate LifecycleSvc
    UI --> Shipper : Show Delivered confirmation
end

@enduml
```

---

## SD-20: UC-20 — Track Order Status

```plantuml
@startuml SD-20_TrackOrderStatus

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-20: UC-20 — Track Order Status

actor "Customer" as Actor
boundary "Active Order Screen" as UI
control "Order Service" as OrderSvc
database "Order Store" as OrderDB
control "WebSocket Gateway" as WSGateway

autonumber stop

== Load Current Status ==

Actor -> UI : (1) Open active order screen
UI -> OrderSvc : (2) Request current order status and timeline
activate OrderSvc

OrderSvc -> OrderSvc : (4) Authenticate session
OrderSvc -> OrderDB : (5) Load order and verify customer ownership
OrderDB --> OrderSvc : Order or not found

alt Order not found or not owned by customer
    OrderSvc --> UI : (12) Return not found — MSG-HIST-01
    deactivate OrderSvc
    UI --> Actor : Show error
else Order found and owned by customer
    OrderSvc --> UI : (7) Return order details and status timeline — MSG-TRACK-01
    deactivate OrderSvc
    UI --> Actor : Display current status and timeline
end

== Real-Time Updates ==

UI -> WSGateway : (3) Connect to real-time notification channel (best-effort)

alt WebSocket channel available
    WSGateway -> UI : (8) Push real-time status updates when order/payment events occur
    UI --> Actor : (10) Render update in-app in real time
else WebSocket unavailable
    Actor -> UI : (11) Periodically refresh order status (graceful degradation)
    UI -> OrderSvc : Re-request status
    activate OrderSvc
    OrderSvc --> UI : Current order status
    deactivate OrderSvc
    UI --> Actor : Show refreshed status
end

@enduml
```

---

## SD-21: UC-21 — Cancel Order

```plantuml
@startuml SD-21_CancelOrder

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-21: UC-21 — Cancel Order

actor "Customer" as Actor
boundary "Active Order Screen" as UI
control "Order Lifecycle Service" as LifecycleSvc
database "Order Store" as OrderDB
control "Notification Service" as NotifSvc
control "Payment Service" as PaySvc
control "Promotion Service" as PromoSvc

autonumber stop

== Cancel Order ==

Actor -> UI : (1) Open active order screen
Actor -> UI : (2) Tap Cancel Order and enter a non-empty reason
UI -> LifecycleSvc : (3) Submit cancellation with reason
activate LifecycleSvc

LifecycleSvc -> LifecycleSvc : (4) Verify session and actor role
LifecycleSvc -> OrderDB : (5) Load order and verify customer ownership
OrderDB --> LifecycleSvc : Order or not found

alt Order not found or not owned by customer
    LifecycleSvc --> UI : (21) Return not found — MSG-HIST-01
    deactivate LifecycleSvc
    UI --> Actor : Show not found
else Order found
    alt Reason is empty
        LifecycleSvc --> UI : (20) Return validation error — MSG-CANC-01
        deactivate LifecycleSvc
        UI --> Actor : Show validation error
    else Reason provided
        alt Current status not in pending or paid
            LifecycleSvc --> UI : (19) Return state error — MSG-CANC-02
            deactivate LifecycleSvc
            UI --> Actor : Show state error
        else Status is pending or paid
            LifecycleSvc -> OrderDB : (10) Cancel order and append status change to audit log
            OrderDB --> LifecycleSvc : Cancellation result

            alt Optimistic lock failed
                LifecycleSvc --> UI : (18) Return conflict — MSG-LCYC-06
                deactivate LifecycleSvc
                UI --> Actor : Show conflict
            else Lock succeeded
                LifecycleSvc -> NotifSvc : (12) Notify downstream services of cancellation
                alt Order was paid via VNPay
                    LifecycleSvc -> PaySvc : (14) Initiate payment refund pipeline
                else COD or unpaid order
                    LifecycleSvc -> LifecycleSvc : (15) No refund applicable
                end
                LifecycleSvc -> PromoSvc : (16) Roll back any applied promotion reservations
                LifecycleSvc --> UI : (17) Return updated order — MSG-CANC-03
                deactivate LifecycleSvc
                UI --> Actor : Show cancellation confirmation
            end
        end
    end
end

@enduml
```

---

## SD-22: UC-22 — Submit Rating & Review

```plantuml
@startuml SD-22_SubmitRatingReview

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-22: UC-22 — Submit Rating & Review

actor "Customer" as Actor
boundary "Delivered Order Screen" as UI
control "Review Service" as ReviewSvc
database "Review Store" as ReviewDB
database "Restaurant Store" as RestDB

autonumber stop

== Submit Rating ==

Actor -> UI : (1) Open delivered order screen
Actor -> UI : (2) Select Rate & Review — choose 1–5 stars + optional comment
UI -> ReviewSvc : (3) Submit rating and optional comment
activate ReviewSvc

ReviewSvc -> ReviewSvc : (4) Authenticate session
ReviewSvc -> ReviewSvc : (5) Validate rating and comment content

alt Payload invalid
    ReviewSvc --> UI : (18) Return validation error — MSG-RATE-01
    deactivate ReviewSvc
    UI --> Actor : Show validation error
else Payload valid
    ReviewSvc -> ReviewDB : (7) Load order and verify customer ownership
    ReviewDB --> ReviewSvc : Order or not found

    alt Order not found or not owned
        ReviewSvc --> UI : (17) Return not found — MSG-HIST-01
        deactivate ReviewSvc
        UI --> Actor : Show not found
    else Order found
        alt Order status is not delivered
            ReviewSvc --> UI : (16) Return state error — MSG-RATE-02
            deactivate ReviewSvc
            UI --> Actor : Show state error
        else Order is delivered
            ReviewSvc -> ReviewDB : (10) Check if review already exists
            ReviewDB --> ReviewSvc : Existing review or none

            alt Review already exists
                ReviewSvc --> UI : (15) Return conflict — MSG-RATE-03
                deactivate ReviewSvc
                UI --> Actor : Show conflict
            else No existing review
                ReviewSvc -> ReviewDB : (12) Save and publish review
                ReviewDB --> ReviewSvc : Review saved
                ReviewSvc -> RestDB : (13) Update restaurant aggregate rating
                ReviewSvc --> UI : (14) Return confirmation — MSG-RATE-04
                deactivate ReviewSvc
                UI --> Actor : Show confirmation
            end
        end
    end
end

@enduml
```

---

## SD-23: UC-23 — Manage Restaurant Promotions

```plantuml
@startuml SD-23_ManageRestaurantPromotions

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-23: UC-23 — Manage Restaurant Promotions

actor "Restaurant Partner" as Partner
boundary "Promotion Dashboard" as UI
control "Promotion Service" as PromoSvc
database "Promotion Store" as PromoDB
database "Restaurant Store" as RestDB

autonumber stop

== Read / Create / Update / Lifecycle ==

Partner -> UI : (1) Open promotion dashboard
Partner -> UI : (2) Submit create/update/list/lifecycle request
UI -> PromoSvc : Submit request
activate PromoSvc

PromoSvc -> PromoSvc : (3) Verify session and restaurant role
PromoSvc -> RestDB : (4) Load restaurant record
RestDB --> PromoSvc : Restaurant or not found

alt Restaurant not found, not owned, or not approved
    PromoSvc --> UI : (19) Return access denied — MSG-PROMO-02
    deactivate PromoSvc
    UI --> Partner : Show access denied
else Restaurant valid and owned
    alt Operation is read (GET)
        PromoSvc -> PromoDB : Load promotion list or detail
        PromoDB --> PromoSvc : Promotion data
        PromoSvc --> UI : (7) Return restaurant's promotion list or detail
        deactivate PromoSvc
        UI --> Partner : Display promotions
    else Write operation
        PromoSvc -> PromoSvc : (8) Validate payload

        alt Payload invalid
            PromoSvc --> UI : (18) Return validation error — MSG-PROMO-01
            deactivate PromoSvc
            UI --> Partner : Show validation error
        else Payload valid
            alt Operation is create
                PromoSvc -> PromoDB : (10) Create promotion in Draft status
                PromoDB --> PromoSvc : Promotion created
                PromoSvc --> UI : (17) Return the resulting promotion
                deactivate PromoSvc
                UI --> Partner : Show new promotion
            else Update or lifecycle change
                PromoSvc -> PromoDB : (11) Load existing promotion and verify restaurant ownership
                PromoDB --> PromoSvc : Promotion or not found

                alt Promotion not found or not owned by restaurant
                    PromoSvc --> UI : (16) Return not found — MSG-PROMO-03
                    deactivate PromoSvc
                    UI --> Partner : Show not found
                else Promotion found
                    alt Status transition not permitted
                        PromoSvc --> UI : (15) Return state error — MSG-PROMO-05
                        deactivate PromoSvc
                        UI --> Partner : Show state error
                    else Transition permitted
                        PromoSvc -> PromoDB : (14) Apply and save changes
                        PromoDB --> PromoSvc : Updated promotion
                        PromoSvc --> UI : (17) Return the resulting promotion
                        deactivate PromoSvc
                        UI --> Partner : Show updated promotion
                    end
                end
            end
        end
    end
end

@enduml
```

---

## SD-24: UC-24 — Manage Platform Promotions

```plantuml
@startuml SD-24_ManagePlatformPromotions

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-24: UC-24 — Manage Platform Promotions

actor "Administrator" as Admin
boundary "Admin Promotion Console" as UI
control "Promotion Service" as PromoSvc
database "Promotion Store" as PromoDB

autonumber stop

== Admin Promotion & Coupon Management ==

Admin -> UI : (1) Open admin promotion console
Admin -> UI : (2) Submit promotion or coupon request
UI -> PromoSvc : Submit request
activate PromoSvc

PromoSvc -> PromoSvc : (3) Verify admin session

alt Operation is read (GET)
    PromoSvc -> PromoDB : Load promotion and coupon data
    PromoDB --> PromoSvc : Data
    PromoSvc --> UI : (5) Return promotion and coupon list or detail
    deactivate PromoSvc
    UI --> Admin : Display data
else Write operation
    alt Operation is coupon issuance
        PromoSvc -> PromoDB : (7) Load parent promotion
        PromoDB --> PromoSvc : Promotion or not found

        alt Promotion not found or does not support coupon codes
            PromoSvc --> UI : (13) Return not found or state error — MSG-PROMO-03 or MSG-PROMO-05
            deactivate PromoSvc
            UI --> Admin : Show error
        else Promotion supports coupons
            PromoSvc -> PromoSvc : (9) Validate coupon batch payload

            alt Payload invalid
                PromoSvc --> UI : (12) Return validation error — MSG-PROMO-01
                deactivate PromoSvc
                UI --> Admin : Show validation error
            else Payload valid
                PromoSvc -> PromoDB : (10) Issue and save provided coupon codes
                PromoDB --> PromoSvc : Issued codes
                PromoSvc --> UI : (11) Return issued codes — MSG-PROMO-10
                deactivate PromoSvc
                UI --> Admin : Show issued codes
            end
        end
    else Create or lifecycle change
        PromoSvc -> PromoSvc : (14) Validate payload

        alt Payload invalid
            PromoSvc --> UI : (21) Return validation error — MSG-PROMO-01
            deactivate PromoSvc
            UI --> Admin : Show validation error
        else Payload valid
            PromoSvc -> PromoDB : (15) Load target promotion (if not create)
            PromoDB --> PromoSvc : Promotion or not found

            alt Promotion not found
                PromoSvc --> UI : (20) Return not found — MSG-PROMO-03
                deactivate PromoSvc
                UI --> Admin : Show not found
            else Promotion found or create
                alt Status transition not permitted
                    PromoSvc --> UI : (19) Return state error — MSG-PROMO-05
                    deactivate PromoSvc
                    UI --> Admin : Show state error
                else Transition permitted
                    PromoSvc -> PromoDB : (17) Apply and save promotion change
                    PromoDB --> PromoSvc : Updated promotion
                    PromoSvc --> UI : (18) Return the resulting promotion
                    deactivate PromoSvc
                    UI --> Admin : Show updated promotion
                end
            end
        end
    end
end

@enduml
```

---

## SD-25: UC-25 — Process Payment Refund

```plantuml
@startuml SD-25_ProcessPaymentRefund

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-25: UC-25 — Process Payment Refund

control "Ordering BC" as OrderingBC
control "Payment Service" as PaySvc
database "Payment Store" as PayDB
control "Payment Gateway" as Gateway
control "Notification Service" as NotifSvc

autonumber stop

== Automated Refund (Event-Driven) ==

OrderingBC -> PaySvc : (2) Signal Payment BC to initiate refund
note right of OrderingBC : T-05 or T-07 cancellation on VNPay-paid order
activate PaySvc

PaySvc -> PayDB : (4) Look up confirmed payment transaction
PayDB --> PaySvc : Transaction or not found

alt Completed transaction not found
    PaySvc -> PaySvc : (18) Log and exit (COD or already-refunded order)
    deactivate PaySvc
else Completed transaction found
    alt amount <= 0
        PaySvc -> PaySvc : (17) Log data anomaly and exit
        deactivate PaySvc
    else amount > 0
        alt Status already refund_pending or refunded
            PaySvc -> PaySvc : (8) Log duplicate event and exit — MSG-REFUND-02
            deactivate PaySvc
        else Status is completed
            PaySvc -> PayDB : (9) Mark transaction as refund in progress
            PayDB --> PaySvc : Lock result

            alt Optimistic lock lost
                PaySvc -> PaySvc : (16) Concurrent handler is processing refund — exit
                deactivate PaySvc
            else Lock won
                PaySvc -> NotifSvc : (11) Notify customer that refund has been initiated — MSG-REFUND-01
                PaySvc -> Gateway : (12) Submit refund request to payment gateway
                Gateway --> PaySvc : Gateway response

                alt Gateway responded success
                    PaySvc -> PayDB : (14) Record successful refund completion
                    PayDB --> PaySvc : Updated
                    deactivate PaySvc
                else Gateway failure
                    PaySvc -> PayDB : (15) Record refund attempt failure; schedule retry — MSG-REFUND-04
                    PayDB --> PaySvc : Updated
                    deactivate PaySvc
                end
            end
        end
    end
end

@enduml
```

---

## SD-26: UC-26 — Manage Real-Time Notifications

```plantuml
@startuml SD-26_ManageRealTimeNotifications

skinparam shadowing false
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true
skinparam maxMessageSize 120
skinparam sequenceArrowThickness 1.5
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title SD-26: UC-26 — Manage Real-Time Notifications

control "Publishing BC" as PublisherBC
control "Notification Service" as NotifSvc
database "Notification Store" as NotifDB
control "Channel Dispatcher" as Dispatcher
control "Push Provider (FCM)" as FCM
actor "Authenticated User" as User
boundary "Notification Inbox" as UI

autonumber stop

== Event-Driven Dispatch ==

PublisherBC -> NotifSvc : (1) Publish domain event
note right of PublisherBC : OrderStatusChangedEvent, OrderPlacedEvent,\nPaymentConfirmedEvent, PaymentFailedEvent,\nOrderCancelledAfterPaymentEvent
activate NotifSvc

NotifSvc -> NotifSvc : (2) Identify notification type and recipients
NotifSvc -> NotifDB : (3) Load each recipient's notification preferences
NotifDB --> NotifSvc : Preferences (or defaults)

alt Recipient has muted this type
    NotifSvc -> NotifDB : (5) Persist notification record for audit — skip delivery
    deactivate NotifSvc
else Recipient has not muted
    NotifSvc -> NotifSvc : (6) Determine enabled delivery channels per recipient preferences

    alt Type is critical (system_announcement, new_order_received)
        NotifSvc -> NotifSvc : (8) Bypass quiet-hours suppression
    else Non-critical type
        alt Quiet hours active and within quiet window
            NotifSvc -> NotifSvc : (10) Remove push from enabled channels
note right : in-app is always persisted
        else Outside quiet window
            NotifSvc -> NotifSvc : (11) Keep all enabled channels
        end
    end

    NotifSvc -> NotifDB : (12) Persist notification record per channel (deduplicated)
    NotifDB --> NotifSvc : Records saved
    NotifSvc -> Dispatcher : (13) Dispatch notification to enabled channels concurrently
    activate Dispatcher
    Dispatcher -> FCM : Push via FCM
    FCM --> Dispatcher : Delivery result
    Dispatcher --> NotifSvc : (14) Record delivery outcome per channel
    deactivate Dispatcher

    alt Push delivery returned invalid or unregistered token
        NotifSvc -> NotifDB : (16) Mark invalid device token as inactive
    else Token valid
        NotifSvc -> NotifSvc : (17) Leave device tokens unchanged
    end
    deactivate NotifSvc
end

== REST Inbox & Preference Management ==

User -> UI : (18) Manage inbox, preferences and push tokens via REST endpoints
UI -> NotifSvc : Submit management request
activate NotifSvc

NotifSvc -> NotifDB : (19) Apply change and synchronise read-state across all active sessions
NotifDB --> NotifSvc : Updated
NotifSvc --> UI : Return updated state
deactivate NotifSvc
UI --> User : Show updated inbox / preferences

@enduml
```

---

*End of Appendix SD — Sequence Diagrams v2.0*
