# SRS Sequence Diagrams — Appendix SD
## SoLi Food Delivery Application

**Document Version:** 2.0
**Status:** Final
**Scope:** UC-1 through UC-10 — Enterprise-Style PlantUML Sequence Diagrams
**Traceability:** Root message numbers correspond **directly** to Activity Diagram step numbers in `SRS_FoodDelivery.md`. Internal sub-steps within a single activity step use decimal notation — e.g., `(5.1)`, `(5.2)` are sub-steps of Activity step `(5)`.

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

title SD-1: UC-1 — User Authentication\n[BR-AUTH-1 through BR-AUTH-10]

actor "Guest / User" as Actor
boundary "Authentication Page" as UI
control "Authentication Service" as AuthSvc
database "User Repository" as UserRepo
database "Session Store" as SessionStore
control "OTP Service" as OTPSvc

autonumber stop

== Sign In ==

Actor -> UI : (1) Select "Sign In"
UI -> AuthSvc : (3) Submit sign-in request\n(email, password)
activate AuthSvc

AuthSvc -> AuthSvc : (4.1) Validate credential format [BR-AUTH-1]
AuthSvc -> UserRepo : (4.2) Verify account credentials
activate UserRepo
UserRepo --> AuthSvc : account | null
deactivate UserRepo

alt Credentials invalid or account banned [BR-AUTH-2]
    AuthSvc --> UI : Reject — MSG-AUTH-01
    deactivate AuthSvc
    UI --> Actor : (7) Show sign-in error
else Credentials valid
    AuthSvc -> SessionStore : (5) Create authenticated session\n(TTL = 7 days) [BR-AUTH-3]
    activate SessionStore
    SessionStore --> AuthSvc : session token
    deactivate SessionStore
    AuthSvc --> UI : Success — session token
    deactivate AuthSvc
    UI --> Actor : (6) Redirect to home page
end

== Sign Up ==

Actor -> UI : (1) Select "Sign Up"
UI -> AuthSvc : (8) Submit registration\n(name, email, password)
activate AuthSvc

AuthSvc -> AuthSvc : (9.1) Validate registration fields [BR-AUTH-4]

alt Input invalid
    AuthSvc --> UI : Reject — MSG-AUTH-03
    deactivate AuthSvc
    UI --> Actor : (12) Show validation error
else Input valid
    AuthSvc -> UserRepo : (9.2) Check email uniqueness
    activate UserRepo
    UserRepo --> AuthSvc : unique: true | false
    deactivate UserRepo

    alt Email already registered [BR-AUTH-5]
        AuthSvc --> UI : Reject — MSG-AUTH-02
        deactivate AuthSvc
        UI --> Actor : (12) Show duplicate email error
    else Email available
        AuthSvc -> UserRepo : (10.1) Create account (role = 'user') [BR-AUTH-6]
        activate UserRepo
        UserRepo --> AuthSvc : account created
        deactivate UserRepo
        AuthSvc -> SessionStore : (10.2) Create authenticated session
        activate SessionStore
        SessionStore --> AuthSvc : session token
        deactivate SessionStore
        AuthSvc --> UI : Success — session token
        deactivate AuthSvc
        UI --> Actor : (11) Redirect to home page
    end
end

== Forgot Password ==

Actor -> UI : (1) Select "Forgot Password"
UI -> AuthSvc : (13) Submit email for password reset
activate AuthSvc

AuthSvc -> UserRepo : (14.1) Look up account by email
activate UserRepo
UserRepo --> AuthSvc : account | null
deactivate UserRepo

note over AuthSvc : BR-AUTH-7: Always respond with MSG-AUTH-04\nregardless of email existence\n(prevents user enumeration)

opt Account exists
    AuthSvc -> OTPSvc : (14.2) Dispatch reset code\n(single-use, valid 60 min)
    activate OTPSvc
    OTPSvc --> AuthSvc : dispatched
    deactivate OTPSvc
end

AuthSvc --> UI : MSG-AUTH-04
deactivate AuthSvc
UI --> Actor : (15) Show MSG-AUTH-04

== Logout ==

Actor -> UI : (16) Request logout
UI -> AuthSvc : Submit logout request [Bearer token]
activate AuthSvc
AuthSvc -> SessionStore : (17) Invalidate session [BR-AUTH-8]
activate SessionStore
SessionStore --> AuthSvc : session removed
deactivate SessionStore
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

title SD-2: UC-2 — Discover Restaurants & Food\n[BR-2.1 through BR-2.6]

actor "User / Guest" as Actor
boundary "Discovery Page" as UI
control "Search Service" as SearchSvc
database "Restaurant & Menu Catalog" as Catalog

autonumber stop

Actor -> UI : (1) Navigate to discovery page\nor enter search criteria
UI -> SearchSvc : (2) Submit search request\n(keyword, category, cuisine, coordinates?)
activate SearchSvc

SearchSvc -> SearchSvc : (3) Validate search parameters [BR-2.1]

alt Parameters invalid
    SearchSvc --> UI : Reject — MSG-DISC-01
    deactivate SearchSvc
    UI --> Actor : (6) Show MSG-DISC-01
else Parameters valid
    SearchSvc -> SearchSvc : (3.1) Clamp pagination\n(limit ∈ [1,100], offset ≥ 0) [BR-2.2]
    SearchSvc -> Catalog : (4) Query matching restaurants and menu items
    activate Catalog
    note over Catalog : BR-2.3: Only approved and open restaurants\nBR-2.4: Only available items (when keyword/tag provided)\nBR-2.5: Relevance scoring applied
    Catalog --> SearchSvc : matching restaurants and items
    deactivate Catalog
    SearchSvc --> UI : Paginated results with totals [BR-2.6]
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

title SD-3: UC-3 — View Restaurant Details\n[BR-3.1 through BR-3.3]

actor "User / Guest" as Actor
boundary "Restaurant Detail Page" as UI
control "Restaurant Service" as RestSvc
database "Restaurant Repository" as RestRepo
database "Menu Repository" as MenuRepo

autonumber stop

Actor -> UI : (1) Select a restaurant
UI -> RestSvc : (2) Load restaurant profile (restaurantId)
activate RestSvc

RestSvc -> RestSvc : (2.1) Validate restaurant identifier [BR-3.1]
RestSvc -> RestRepo : (2.2) Retrieve restaurant by ID
activate RestRepo
RestRepo --> RestSvc : restaurant | null
deactivate RestRepo

alt Restaurant not found [BR-3.2]
    RestSvc --> UI : Reject — MSG-REST-01
    deactivate RestSvc
    UI --> Actor : (5) Show MSG-REST-01
else Restaurant found
    RestSvc -> MenuRepo : (3) Load full menu structure\n(categories, items, modifier groups)
    activate MenuRepo
    note over MenuRepo : BR-3.3: All items returned regardless\nof availability status (display only)
    MenuRepo --> RestSvc : menu structure
    deactivate MenuRepo
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

title SD-4: UC-4 — Add Item to Cart\n[BR-4.1 through BR-4.6]

actor "Customer" as Actor
boundary "Cart Page" as UI
control "Cart Service" as CartSvc
database "Catalog Snapshot" as Snapshot
database "Cart Store" as CartStore

autonumber stop

Actor -> UI : (1) Select menu item and configure modifiers
Actor -> UI : (2) Tap "Add to Cart"
UI -> CartSvc : Submit add-item request
activate CartSvc

CartSvc -> Snapshot : (3.1) Retrieve item and modifier snapshot
activate Snapshot
Snapshot --> CartSvc : snapshot | null
deactivate Snapshot

CartSvc -> CartSvc : (3) Validate item, modifiers and quantity\n[BR-4.1: format] [BR-4.2: availability] [BR-4.3: modifier constraints]

alt Item unavailable or modifiers invalid
    CartSvc --> UI : Reject — MSG-CART-01 to MSG-CART-07
    deactivate CartSvc
    UI --> Actor : (9) Show validation error
else Validation passed
    CartSvc -> CartStore : (4.1) Load customer cart
    activate CartStore
    CartStore --> CartSvc : cart | null
    deactivate CartStore

    CartSvc -> CartSvc : (4) Check restaurant consistency [BR-4.4]

    alt Cart belongs to a different restaurant
        CartSvc --> UI : Reject — MSG-CART-08 or MSG-CART-09
        deactivate CartSvc
        UI --> Actor : (8) Show different-restaurant error
    else Same restaurant or empty cart
        CartSvc -> CartSvc : (5) Merge with existing cart line\nor add new item [BR-4.5]

        alt Line quantity would exceed 99
            CartSvc --> UI : Reject — MSG-CART-10
            deactivate CartSvc
            UI --> Actor : (7) Show quantity ceiling error
        else Quantity valid
            CartSvc -> CartStore : (6.1) Save updated cart\n(reset TTL to 7 days) [BR-4.6]
            activate CartStore
            CartStore --> CartSvc : saved
            deactivate CartStore
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

title SD-5: UC-5 — Manage Shopping Cart\n[BR-5.1 through BR-5.7]

actor "Customer" as Actor
boundary "Cart Page" as UI
control "Cart Service" as CartSvc
database "Cart Store" as CartStore

autonumber stop

Actor -> UI : (1) Open cart

== View Cart ==

UI -> CartSvc : (3) Load and return cart contents
activate CartSvc
CartSvc -> CartStore : Retrieve customer cart [BR-5.1]
activate CartStore
CartStore --> CartSvc : cart | null
deactivate CartStore
note over CartSvc : BR-5.7: Read-only — TTL is not reset
CartSvc --> UI : Cart contents (or null)
deactivate CartSvc
UI --> Actor : (3) Display cart

== Update Item Quantity ==

Actor -> UI : (2) Select "Update Quantity" — enter new quantity
UI -> CartSvc : (4) Submit quantity update (cartItemId, quantity)
activate CartSvc

CartSvc -> CartStore : Load customer cart
activate CartStore
CartStore --> CartSvc : cart | null
deactivate CartStore

CartSvc -> CartSvc : (4.1) Find line by cartItemId

alt Line not found [BR-5.2]
    CartSvc --> UI : Reject — MSG-CART-11
    deactivate CartSvc
    UI --> Actor : (6) Show MSG-CART-11
else Line found
    alt quantity = 0 → remove line [BR-5.2]
        CartSvc -> CartSvc : Remove line from cart
    else quantity ∈ [1, 99]
        CartSvc -> CartSvc : Update line quantity
    end
    CartSvc -> CartStore : (5) Save updated cart\n(reset TTL to 7 days) [BR-5.7]
    activate CartStore
    CartStore --> CartSvc : saved
    deactivate CartStore
    CartSvc --> UI : Updated cart
    deactivate CartSvc
    UI --> Actor : (5) Display updated cart
end

== Update Item Modifiers ==

Actor -> UI : (2) Select "Update Modifiers" — choose new options
UI -> CartSvc : (7) Submit modifier update (cartItemId, selectedModifiers[])
activate CartSvc

CartSvc -> CartStore : Load customer cart
activate CartStore
CartStore --> CartSvc : cart
deactivate CartStore

CartSvc -> CartSvc : (7.1) Find line by cartItemId
CartSvc -> CartSvc : (7) Validate new modifier set and re-fingerprint line\n[BR-5.3: wholesale replacement + re-validation]

alt Modifiers invalid
    CartSvc --> UI : Reject — MSG-CART-03 to MSG-CART-07
    deactivate CartSvc
    UI --> Actor : (9) Show modifier validation error
else Modifiers valid
    CartSvc -> CartSvc : (7.2) Rebuild modifier fingerprint
    CartSvc -> CartSvc : (7.3) Check fingerprint collision with existing line\n[BR-5.3: merge if collision, overflow → MSG-CART-10]

    alt Merged quantity would exceed 99
        CartSvc --> UI : Reject — MSG-CART-10
        deactivate CartSvc
        UI --> Actor : (9) Show quantity overflow error
    else No overflow
        CartSvc -> CartStore : (8.1) Save updated cart\n(reset TTL to 7 days) [BR-5.7]
        activate CartStore
        CartStore --> CartSvc : saved
        deactivate CartStore
        CartSvc --> UI : Updated cart
        deactivate CartSvc
        UI --> Actor : (8) Display updated cart with new modifiers
    end
end

== Remove Item ==

Actor -> UI : (2) Select "Remove Item"
UI -> CartSvc : Submit remove-item request (cartItemId)
activate CartSvc

CartSvc -> CartStore : Load customer cart
activate CartStore
CartStore --> CartSvc : cart | null
deactivate CartStore

CartSvc -> CartSvc : Find line by cartItemId

alt Line not found [BR-5.4]
    CartSvc --> UI : Reject — MSG-CART-11
    deactivate CartSvc
    UI --> Actor : (11) Show MSG-CART-11
else Line found
    CartSvc -> CartSvc : (10) Remove line from cart

    alt Last item removed [BR-5.6]
        CartSvc -> CartStore : Delete cart record
        activate CartStore
        CartStore --> CartSvc : deleted
        deactivate CartStore
    else Items remain
        CartSvc -> CartStore : Save updated cart (reset TTL) [BR-5.7]
        activate CartStore
        CartStore --> CartSvc : saved
        deactivate CartStore
    end

    CartSvc --> UI : Cart (or null)
    deactivate CartSvc
    UI --> Actor : (10) Display updated cart
end

== Clear Cart ==

Actor -> UI : (2) Select "Clear Cart"
UI -> CartSvc : Submit clear-cart request
activate CartSvc
CartSvc -> CartStore : (12) Delete entire cart [BR-5.5]
activate CartStore
note over CartStore : BR-5.5: Idempotent —\nalready empty → no error
CartStore --> CartSvc : deleted
deactivate CartStore
CartSvc --> UI : HTTP 204 No Content
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

title SD-6: UC-6 — Save & Manage Delivery Addresses\n[BR-6.1 through BR-6.4]

actor "Customer" as Actor
boundary "Checkout Page" as UI
control "Order Service" as OrderSvc
database "Delivery Zone Repository" as ZoneRepo
database "Order Repository" as OrderRepo

autonumber stop

Actor -> UI : (1) Enter delivery address\n(street, district, city, coordinates?)
UI -> OrderSvc : Submit delivery address for validation
activate OrderSvc

OrderSvc -> OrderSvc : (2) Validate address structure\n[BR-6.1: street, district, city required]

alt Address structure invalid
    OrderSvc --> UI : Reject — MSG-ADDR-01
    deactivate OrderSvc
    UI --> Actor : (9) Show MSG-ADDR-01
else Structure valid
    OrderSvc -> OrderSvc : (3) Validate coordinate pairing\n[BR-6.1: both lat/lon or neither]

    alt Coordinate pairing invalid
        OrderSvc --> UI : Reject — MSG-ADDR-02
        deactivate OrderSvc
        UI --> Actor : (8) Show MSG-ADDR-02
    else Coordinates valid or absent
        note over OrderSvc : (4) Address accepted — checkout processing begins (UC-8)

        OrderSvc -> ZoneRepo : (5.1) Load active delivery zones for restaurant
        activate ZoneRepo
        ZoneRepo --> OrderSvc : delivery zones[]
        deactivate ZoneRepo

        OrderSvc -> OrderSvc : (5) Verify delivery zone eligibility\n(Haversine distance vs zone radii) [BR-6.2]

        alt Address outside all delivery zones
            OrderSvc --> UI : Reject — MSG-ADDR-03
            deactivate OrderSvc
            UI --> Actor : (7) Show MSG-ADDR-03
        else In delivery range
            OrderSvc -> OrderRepo : (6) Store address immutably with order [BR-6.3]
            activate OrderRepo
            OrderRepo --> OrderSvc : address captured
            deactivate OrderRepo
            OrderSvc --> UI : Address confirmed — continue to payment
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

title SD-7: UC-7 — Manage Delivery Zones\n[BR-7.1 through BR-7.7]

actor "Restaurant Partner / Admin" as Partner
actor "Customer" as Customer
boundary "Zone Management UI" as ZoneUI
boundary "Restaurant Page" as RestUI
control "Delivery Zone Service" as ZoneSvc
database "Zone Repository" as ZoneRepo
control "Geo Service" as GeoSvc
control "Event Bus" as EventBus
database "Ordering ACL Snapshot" as ACLSnap

autonumber stop

== Zone Management: Create or Update ==

Partner -> ZoneUI : (1) Initiate zone management request
ZoneUI -> ZoneSvc : (2) Submit zone operation\n(restaurantId, actor credentials)
activate ZoneSvc

ZoneSvc -> ZoneSvc : (2.1) Authorize actor [BR-7.1]

alt Not authorized (not owner and not admin)
    ZoneSvc --> ZoneUI : Reject — MSG-ZONE-01
    deactivate ZoneSvc
    ZoneUI --> Partner : (12) Show MSG-ZONE-01
else Authorized
    ZoneSvc -> ZoneSvc : (4) Validate zone configuration\n[BR-7.2: radiusKm, baseFee, perKmRate, speed, prep time]

    alt Configuration invalid
        ZoneSvc --> ZoneUI : Reject — MSG-ZONE-02
        deactivate ZoneSvc
        ZoneUI --> Partner : (8) Show MSG-ZONE-02
    else Configuration valid
        ZoneSvc -> ZoneRepo : (5) Execute Create or Update
        activate ZoneRepo
        ZoneRepo --> ZoneSvc : zone record
        deactivate ZoneRepo

        ZoneSvc -> EventBus : (6) Synchronise zone data with ordering system\n(publish DeliveryZoneSnapshotUpdatedEvent) [BR-7.4]
        activate EventBus
        EventBus -> ACLSnap : (6.1) Upsert delivery zone snapshot\n(idempotent)
        activate ACLSnap
        ACLSnap --> EventBus : snapshot updated
        deactivate ACLSnap
        EventBus --> ZoneSvc : synchronised
        deactivate EventBus

        ZoneSvc --> ZoneUI : Success
        deactivate ZoneSvc
        ZoneUI --> Partner : (7) Confirm operation
    end
end

== Zone Management: Delete ==

Partner -> ZoneUI : (1) Initiate delete zone request
ZoneUI -> ZoneSvc : (2) Submit delete request (zoneId)
activate ZoneSvc

ZoneSvc -> ZoneSvc : (2.1) Authorize actor [BR-7.1]

alt Not authorized
    ZoneSvc --> ZoneUI : Reject — MSG-ZONE-01
    deactivate ZoneSvc
    ZoneUI --> Partner : (12) Show MSG-ZONE-01
else Authorized
    ZoneSvc -> ZoneRepo : (9.1) Look up zone by ID
    activate ZoneRepo
    ZoneRepo --> ZoneSvc : zone | null
    deactivate ZoneRepo

    alt Zone not found [BR-7.3]
        ZoneSvc --> ZoneUI : Reject — MSG-ZONE-03
        deactivate ZoneSvc
        ZoneUI --> Partner : (11) Show MSG-ZONE-03
    else Zone found
        ZoneSvc -> ZoneRepo : (9) Execute Delete
        activate ZoneRepo
        ZoneRepo --> ZoneSvc : deleted
        deactivate ZoneRepo

        ZoneSvc -> EventBus : (9.2) Synchronise deletion with ordering system\n(isDeleted = true) [BR-7.4]
        activate EventBus
        EventBus -> ACLSnap : (9.3) Tombstone delivery zone snapshot
        activate ACLSnap
        ACLSnap --> EventBus : snapshot removed
        deactivate ACLSnap
        EventBus --> ZoneSvc : synchronised
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

ZoneSvc -> ZoneRepo : (13.1) Load restaurant location and active zones
activate ZoneRepo
ZoneRepo --> ZoneSvc : restaurant location + zones[]
deactivate ZoneRepo

alt No location or no active zones [BR-7.5]
    ZoneSvc --> RestUI : Reject — MSG-ZONE-04
    deactivate ZoneSvc
    RestUI --> Customer : (17) Show MSG-ZONE-04
else Configuration available
    ZoneSvc -> GeoSvc : (14.1) Compute Haversine distance\n(restaurant → customer address)
    activate GeoSvc
    GeoSvc --> ZoneSvc : distance in km
    deactivate GeoSvc

    ZoneSvc -> ZoneSvc : (14) Select innermost eligible zone\n[BR-7.6: distanceKm ≤ zone.radiusKm]

    alt No eligible zone
        ZoneSvc --> RestUI : Reject — MSG-ZONE-05
        deactivate ZoneSvc
        RestUI --> Customer : (16) Show MSG-ZONE-05
    else Eligible zone found
        ZoneSvc -> ZoneSvc : (15.1) Compute fee and ETA [BR-7.7]
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

title SD-8: UC-8 — Place Order\n[BR-8.1 through BR-8.12]

actor "Customer" as Actor
boundary "Checkout Page" as UI
control "Order Service" as OrderSvc
database "Cart Store" as CartStore
database "Catalog Snapshot" as CatalogSnap
database "Delivery Zone Snapshot" as ZoneSnap
control "Promotion Service" as PromSvc
database "Order Repository" as OrderRepo
control "Event Bus" as EventBus
control "Payment Service" as PaySvc

autonumber stop

Actor -> UI : (1) Confirm checkout\n(address, payment method, coupon?)
UI -> OrderSvc : Submit checkout request\n[X-Idempotency-Key?]
activate OrderSvc

OrderSvc -> OrderSvc : (2) Validate checkout request\n[BR-8.1: paymentMethod, address, note, idempotency key]

alt Checkout data invalid
    OrderSvc --> UI : Reject — MSG-ORD-01 or MSG-ORD-02
    deactivate OrderSvc
    UI --> Actor : (18) Show validation error
else Data valid

    OrderSvc -> CartStore : (3) Check idempotency record [BR-8.2]
    activate CartStore
    CartStore --> OrderSvc : existing order | null
    deactivate CartStore

    alt Duplicate request — order already placed
        OrderSvc --> UI : Return existing order
        deactivate OrderSvc
        UI --> Actor : (17) Return existing order (idempotent)
    else New request

        OrderSvc -> CartStore : (4.1) Acquire checkout lock [BR-8.3]
        activate CartStore
        CartStore --> OrderSvc : lock acquired | denied
        deactivate CartStore

        alt Concurrent checkout in progress
            OrderSvc --> UI : Reject — MSG-ORD-03
            deactivate OrderSvc
            UI --> Actor : (16) Show MSG-ORD-03
        else Lock acquired

            OrderSvc -> CartStore : (5.1) Load customer cart
            activate CartStore
            CartStore --> OrderSvc : cart contents
            deactivate CartStore

            OrderSvc -> CatalogSnap : (5.2) Load restaurant and item snapshots
            activate CatalogSnap
            CatalogSnap --> OrderSvc : restaurant + item snapshots
            deactivate CatalogSnap

            OrderSvc -> OrderSvc : (5) Validate cart, restaurant,\nitems and modifiers\n[BR-8.4: cart, restaurant status]\n[BR-8.5: item availability, modifier constraints]

            alt Cart or catalog validation fails
                OrderSvc --> UI : Reject — MSG-ORD-04 to MSG-ORD-10
                deactivate OrderSvc
                UI --> Actor : (15) Show validation error
            else Validation passed

                OrderSvc -> ZoneSnap : (6.1) Load restaurant delivery zones
                activate ZoneSnap
                ZoneSnap --> OrderSvc : delivery zones[]
                deactivate ZoneSnap

                OrderSvc -> OrderSvc : (6) Compute delivery fee\nand check zone eligibility [BR-8.6]

                alt Address outside delivery range
                    OrderSvc --> UI : Reject — MSG-ORD-11
                    deactivate OrderSvc
                    UI --> Actor : (14) Show MSG-ORD-11
                else In delivery range

                    opt Coupon code provided [BR-8.7]
                        OrderSvc -> PromSvc : (7) Reserve promotion\n(non-blocking)
                        activate PromSvc
                        PromSvc --> OrderSvc : discount amount | no discount
                        deactivate PromSvc
                    end

                    OrderSvc -> OrderSvc : (8.1) Apply server-authoritative pricing\n[BR-8.8: snapshot prices; totalAmount = items + shipping − discount]

                    OrderSvc -> OrderRepo : (8) Persist order\n(order + items + status log) [BR-8.9, BR-8.10]
                    activate OrderRepo
                    OrderRepo --> OrderSvc : order created | constraint violation
                    deactivate OrderRepo

                    alt Persistence failure
                        OrderSvc --> UI : Reject — MSG-ORD-13 or MSG-ORD-14
                        deactivate OrderSvc
                        UI --> Actor : (13) Show error
                    else Order persisted

                        opt Payment method: VNPay [BR-8.11]
                            OrderSvc -> PaySvc : (10) Initiate payment session\n(orderId, amount)
                            activate PaySvc
                            PaySvc --> OrderSvc : payment URL
                            deactivate PaySvc
                        end

                        OrderSvc -> CartStore : (11.1) Record idempotency result [BR-8.2]
                        activate CartStore
                        CartStore --> OrderSvc : recorded
                        deactivate CartStore

                        OrderSvc -> EventBus : (11.2) Notify downstream services [BR-8.12]
                        activate EventBus
                        EventBus --> OrderSvc : published
                        deactivate EventBus

                        OrderSvc -> CartStore : (11.3) Clear customer cart [BR-8.12]
                        activate CartStore
                        CartStore --> OrderSvc : cleared
                        deactivate CartStore

                        OrderSvc --> UI : Order confirmation\n(orderId, status, paymentUrl?)
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

title SD-9: UC-9 — Make Online Payment (VNPay)\n[BR-9.1 through BR-9.8]

actor "Customer" as Actor
boundary "VNPay Gateway" as VNPay
control "Payment Service" as PaySvc
database "Payment Transaction Store" as TxnStore
control "Event Bus" as EventBus
control "Order Service" as OrderSvc

autonumber stop

== VNPay IPN Callback ==

Actor -> VNPay : (2) Open VNPay payment URL
Actor -> VNPay : (3) Complete payment on VNPay hosted page
VNPay --> Actor : Payment result page displayed

VNPay -> PaySvc : (4) Send IPN notification
activate PaySvc

PaySvc -> PaySvc : (5) Verify payment callback authenticity\n(HMAC-SHA512 signature) [BR-9.1]

alt Signature invalid
    PaySvc --> VNPay : (15) MSG-PAY-01 — invalid signature (RspCode 97)
    deactivate PaySvc
else Signature valid

    PaySvc -> TxnStore : (6) Locate payment transaction by reference [BR-9.2]
    activate TxnStore
    TxnStore --> PaySvc : transaction | null
    deactivate TxnStore

    alt Transaction not found
        PaySvc --> VNPay : (14) MSG-PAY-02 — transaction not found (RspCode 01)
        deactivate PaySvc
    else Transaction found

        PaySvc -> PaySvc : (7) Check transaction state [BR-9.3]

        alt Already in terminal state (completed / failed / refunded)
            PaySvc --> VNPay : (13) MSG-PAY-06 — already processed (RspCode 00)
            deactivate PaySvc
        else Non-terminal state

            PaySvc -> PaySvc : (8) Verify payment amount\n[BR-9.4: vnp_Amount ÷ 100 must match transaction amount]

            alt Amount mismatch
                PaySvc -> TxnStore : (12.1) Record payment as failed
                activate TxnStore
                TxnStore --> PaySvc : updated
                deactivate TxnStore
                PaySvc -> EventBus : (12.2) Notify payment failure
                activate EventBus
                EventBus -> OrderSvc : (12.3) Cancel associated order
                activate OrderSvc
                OrderSvc --> EventBus : order cancelled
                deactivate OrderSvc
                deactivate EventBus
                PaySvc --> VNPay : (12) MSG-PAY-03 — amount mismatch (RspCode 04)
                deactivate PaySvc
            else Amount valid

                alt VNPay reports success [BR-9.5]
                    PaySvc -> TxnStore : (10.1) Record payment as completed
                    activate TxnStore
                    TxnStore --> PaySvc : updated
                    deactivate TxnStore
                    PaySvc -> EventBus : (10.2) Notify payment confirmed
                    activate EventBus
                    EventBus -> OrderSvc : (10.3) Advance order to paid status
                    activate OrderSvc
                    OrderSvc --> EventBus : order updated to paid
                    deactivate OrderSvc
                    deactivate EventBus
                    PaySvc --> VNPay : (10) MSG-PAY-04 — success (RspCode 00)
                    deactivate PaySvc
                else VNPay reports failure [BR-9.6]
                    PaySvc -> TxnStore : (11.1) Record payment as failed
                    activate TxnStore
                    TxnStore --> PaySvc : updated
                    deactivate TxnStore
                    PaySvc -> EventBus : (11.2) Notify payment failure
                    activate EventBus
                    EventBus -> OrderSvc : (11.3) Cancel associated order
                    activate OrderSvc
                    OrderSvc --> EventBus : order cancelled
                    deactivate OrderSvc
                    deactivate EventBus
                    PaySvc --> VNPay : (11) MSG-PAY-05 — acknowledged (RspCode 00)
                    deactivate PaySvc
                end
            end
        end
    end
end

== Scheduled Timeout ==

control "Payment Timeout Scheduler" as Scheduler

Scheduler -> Scheduler : (16) Detect expired payment sessions\n[BR-9.7: status ∈ {pending, awaiting_ipn} AND expiresAt < now]
activate Scheduler

Scheduler -> TxnStore : (16.1) Query expired payment sessions
activate TxnStore
TxnStore --> Scheduler : expired transactions[]
deactivate TxnStore

loop For each expired transaction
    Scheduler -> TxnStore : (17.1) Mark transaction as failed
    activate TxnStore
    TxnStore --> Scheduler : updated
    deactivate TxnStore
    Scheduler -> EventBus : (17.2) Notify payment failure
    activate EventBus
    EventBus -> OrderSvc : (17.3) Cancel associated order
    activate OrderSvc
    OrderSvc --> EventBus : order cancelled
    deactivate OrderSvc
    deactivate EventBus
end

Scheduler -> Scheduler : (17) Expired sessions marked as failed;\nassociated orders cancelled
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

title SD-10: UC-10 — View Order History\n[BR-10.1 through BR-10.6]

actor "Customer" as Actor
boundary "Orders Screen" as UI
control "Order History Service" as HistSvc
database "Order Repository" as OrderRepo

autonumber stop

Actor -> UI : (1) Navigate to order history
Actor -> UI : (2) Select operation

== List Orders ==

UI -> HistSvc : (3) Load order list\n(status?, dateRange?, limit, offset)
activate HistSvc

HistSvc -> HistSvc : (3.1) Validate filters\n[BR-10.1: status enum, minDate ≤ maxDate, limit ∈ [1,100]]

alt Filters invalid
    HistSvc --> UI : Reject — MSG-HIST-02
    deactivate HistSvc
    UI --> Actor : (6) Show MSG-HIST-02
else Filters valid
    HistSvc -> OrderRepo : (4) Query orders scoped to current customer\n[BR-10.2: hard-scoped by customerId, ordered by createdAt DESC]
    activate OrderRepo
    note over OrderRepo : BR-10.3: Each row includes\nitemCount and firstItemName
    OrderRepo --> HistSvc : paginated order rows + total count
    deactivate OrderRepo
    HistSvc --> UI : Order list with total
    deactivate HistSvc
    UI --> Actor : (5) Display paginated order list
end

== View Order Detail ==

Actor -> UI : (7) Select a specific order
UI -> HistSvc : (8) Load order, items and status audit log\n(orderId)
activate HistSvc

HistSvc -> OrderRepo : (8.1) Retrieve order by ID
activate OrderRepo
OrderRepo --> HistSvc : order | null
deactivate OrderRepo

alt Order not found or belongs to different customer [BR-10.4]
    HistSvc --> UI : Reject — MSG-HIST-01
    deactivate HistSvc
    UI --> Actor : (10) Show MSG-HIST-01
else Order found and owned
    HistSvc -> OrderRepo : (8.2) Load order items
    activate OrderRepo
    OrderRepo --> HistSvc : items[]
    deactivate OrderRepo

    HistSvc -> OrderRepo : (8.3) Load status audit log\n[BR-10.5: chronological order]
    activate OrderRepo
    OrderRepo --> HistSvc : status log entries[]
    deactivate OrderRepo

    HistSvc --> UI : Full order detail\n(order + items + timeline)
    deactivate HistSvc
    UI --> Actor : (9) Display order detail with status timeline
end

== Reorder ==

Actor -> UI : (11) Select "Reorder" on a past order
UI -> HistSvc : (12) Build reorder proposal (orderId)
activate HistSvc

HistSvc -> OrderRepo : (12.1) Load historical order and items
activate OrderRepo
OrderRepo --> HistSvc : order + items
deactivate OrderRepo

HistSvc -> HistSvc : (12.2) Build cart-shaped reorder payload\nfrom historical item data

note over HistSvc : BR-10.6: No cart mutation occurs.\nReturns a read-only proposal.\nUC-4 re-validates all items\nwhen customer re-adds them.

HistSvc --> UI : Reorder payload
deactivate HistSvc
UI --> Actor : (13) Display reorder proposal\n(customer selects items to re-add via UC-4)

@enduml
```

---

*End of Appendix SD — Sequence Diagrams v2.0*
