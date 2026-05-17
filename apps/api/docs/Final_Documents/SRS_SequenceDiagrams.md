# SRS Sequence Diagrams — Appendix SD
## SoLi Food Delivery Application

**Document Version:** 2.0
**Status:** Final
**Scope:** UC-1 through UC-10 — Enterprise-Style PlantUML Sequence Diagrams
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
                        OrderSvc -> PromSvc : (7) Reserve promotion (non-blocking)
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
                            OrderSvc -> PaySvc : (10) Initiate payment session\n(orderId, amount)
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

*End of Appendix SD — Sequence Diagrams v2.0*
