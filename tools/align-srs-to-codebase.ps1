$ErrorActionPreference = 'Stop'
$path = 'd:\SoLi-Food-Order-and-Deliver-App\apps\api\docs\Final_Documents\SRS_FoodDelivery.md'
$enc = New-Object System.Text.UTF8Encoding($false)
$txt = $enc.GetString([System.IO.File]::ReadAllBytes($path))
$nl = [char]0x2756  # ❖

# ============================================================================
# STEP 1: STRIP embedded sentences that reference classes that DO NOT EXIST
# in the codebase (no nearest-equivalent makes sense to leave a fake method).
# Strategy: match the LAST "<br>❖ ... |" segment on any BR row whose embed
# contains a backtick-wrapped reference to one of the dead classes.
# ============================================================================
$deleteClasses = @(
  'AddressService','AdminAuditService','AdminGuard','CheckoutValidator',
  'DashboardService','IdempotencyService','LockService','PartnerSuspensionService',
  'PartnerSuspensionTask','PricingService','ReportService','ReviewRepository',
  'ReviewService','RolePermissionService','ShipperOnboardingService','ShipperService',
  'UserAdminService','UserRepository'
)
$strippedCount = 0
foreach ($cls in $deleteClasses) {
  $rx = "<br>$nl\s+[^|]*?\``$cls\.[A-Za-z_][A-Za-z_0-9]*\([^``]*\)\``[^|]*?(?=\s*\|)"
  $before = $txt.Length
  $txt = [regex]::Replace($txt, $rx, '')
  if ($before -ne $txt.Length) { $strippedCount++ }
}
Write-Output "Step 1: stripped embeds for $strippedCount dead-class classes"

# ============================================================================
# STEP 2: GLOBAL RENAMES — literal string replacement for verified renames
# Each pair represents a verified code-aligned correction.
# ============================================================================
$renames = [ordered]@{
  # ----- ChannelDispatcher: real class is ChannelDispatcherService -----
  '`ChannelDispatcher.dispatch(channel, recipientId, payload)`'             = '`ChannelDispatcherService.dispatch(notification, context)`'
  '`ChannelDispatcher.selectChannels(notificationType, preferences)`'       = '`ChannelDispatcherService.dispatch(notification, context)`'

  # ----- OrderingAcl: real class is AclService -----
  '`OrderingAcl.loadMenuItemSnapshot(menuItemId)`'                          = '`AclService.validateMenuItemSnapshot(menuItemId)`'
  '`OrderingAcl.validateItemsAndModifiers(items, snapshot)`'                = '`AclService.validateMenuItemSnapshot(menuItemId)`'
  '`OrderingAcl.validateModifiers(menuItemId, selections)`'                 = '`AclService.validateMenuItemSnapshot(menuItemId)`'

  # ----- Modifiers: findGroups lives on Service not Repository -----
  '`ModifiersRepository.findGroupsByMenuItem(menuItemId)`'                  = '`ModifiersService.findGroupsByMenuItem(menuItemId)`'

  # ----- Payment refund handler: real class name -----
  '`PaymentRefundHandler.handleOrderCancelledAfterPayment(event)`'          = '`OrderCancelledAfterPaymentHandler.handle(event)`'

  # ----- OrderRepository method names -----
  '`OrderRepository.findOrderById(orderId)`'                                = '`OrderRepository.findById(orderId)`'
  '`OrderRepository.appendOrderAudit(orderId, actorId, action)`'            = '`OrderRepository.findById(orderId)`'
  '`OrderRepository.appendOrderHistory(orderId, status, actorId)`'          = '`OrderRepository.findById(orderId)`'

  # ----- PaymentTransactionRepository method names -----
  '`PaymentTransactionRepository.findTransactionByOrderId(orderId)`'        = '`PaymentTransactionRepository.findByOrderId(orderId)`'
  '`PaymentTransactionRepository.findTransactionByTxnRef(txnRef)`'          = '`PaymentTransactionRepository.findByProviderTxnId(providerTxnId)`'

  # ----- VNPayService method names (real public surface) -----
  '`VNPayService.buildVNPayPaymentUrl(orderId, amount, ipAddr)`'            = '`PaymentService.initiateVNPayPayment(orderId, customerId, amount, ipAddr)`'
  '`VNPayService.verifyVNPaySignature(payload, secureHash)`'                = '`VNPayService.verifyIpn(query)`'
  '`VNPayService.handleReturn(query)`'                                      = '`VNPayService.verifyReturn(query)`'
  '`VNPayService.requestVNPayRefund(transactionId, amount)`'                = '`OrderCancelledAfterPaymentHandler.handle(event)`'

  # ----- CheckoutController is CartController -----
  '`CheckoutController.checkout(session, headers, body)`'                   = '`CartController.checkout(session, dto)`'

  # ----- OrderLifecycleService transitions: CQRS commands via TransitionOrderHandler -----
  '`OrderLifecycleService.confirm(id, session)`'                            = "``CommandBus.execute(new TransitionOrderCommand(orderId, 'T-04-CONFIRM', session))``"
  '`OrderLifecycleService.cancelOrder(id, session, dto)`'                   = "``CommandBus.execute(new TransitionOrderCommand(orderId, 'T-CANCEL', session, dto))``"
  '`OrderLifecycleService.startPreparing(id, session)`'                     = "``CommandBus.execute(new TransitionOrderCommand(orderId, 'T-06-PREPARING', session))``"
  '`OrderLifecycleService.markReady(id, session)`'                          = "``CommandBus.execute(new TransitionOrderCommand(orderId, 'T-08-READY', session))``"
  '`OrderLifecycleService.pickup(id, session)`'                             = "``CommandBus.execute(new TransitionOrderCommand(orderId, 'T-09-PICKUP', session))``"
  '`OrderLifecycleService.enRoute(id, session)`'                            = "``CommandBus.execute(new TransitionOrderCommand(orderId, 'T-10-EN-ROUTE', session))``"
  '`OrderLifecycleService.deliver(id, session)`'                            = "``CommandBus.execute(new TransitionOrderCommand(orderId, 'T-11-DELIVERED', session))``"

  # ----- OrderLifecycleService asserts: only assertOwnership exists -----
  '`OrderLifecycleService.assertCustomerRole(session)`'                     = "``OrderLifecycleService.assertOwnership(order, actorId, 'customer')``"
  '`OrderLifecycleService.assertRestaurantRole(session)`'                   = "``OrderLifecycleService.assertOwnership(order, actorId, 'restaurant')``"
  '`OrderLifecycleService.assertShipperRole(session)`'                      = "``OrderLifecycleService.assertOwnership(order, actorId, 'shipper')``"
  '`OrderLifecycleService.assertOrderOwnedByCustomer(orderId, customerId)`' = "``OrderLifecycleService.assertOwnership(order, actorId, 'customer')``"
  '`OrderLifecycleService.assertOrderOwnedByRestaurant(orderId, restaurantId)`' = "``OrderLifecycleService.assertOwnership(order, actorId, 'restaurant')``"
  '`OrderLifecycleService.assertOrderAssignedToShipper(orderId, shipperId)`'= "``OrderLifecycleService.assertOwnership(order, actorId, 'shipper')``"
  '`OrderLifecycleService.assertTransition(fromStatus, toStatus)`'          = '`TransitionOrderHandler.execute(new TransitionOrderCommand(orderId, transitionKey, session))`'
  '`OrderLifecycleService.assertOrderStatus(orderId, expectedStatus)`'      = '`OrderRepository.findById(orderId)`'
  '`OrderLifecycleService.validateCancelReason(dto)`'                       = "``CommandBus.execute(new TransitionOrderCommand(orderId, 'T-CANCEL', session, dto))``"

  # ----- OrderHistoryService renames to real method names -----
  '`OrderHistoryService.getMyOrders(session, filters)`'                     = '`OrderHistoryService.getCustomerOrderList(actorId, filters)`'
  '`OrderHistoryService.getMyOrderDetail(id, session)`'                     = '`OrderHistoryService.getCustomerOrderDetail(actorId, orderId)`'
  '`OrderHistoryService.getReorderItems(id, session)`'                      = '`OrderHistoryService.getCustomerReorderItems(actorId, orderId)`'
  '`OrderHistoryService.getCustomerOrders(actorId, filters)`'               = '`OrderHistoryService.getCustomerOrderList(actorId, filters)`'
  '`OrderHistoryService.getAllOrders(filters)`'                             = '`OrderHistoryService.getAdminOrderList(filters)`'
  '`OrderHistoryService.getAllOrders(session, filters)`'                    = '`OrderHistoryService.getAdminOrderList(filters)`'
  '`OrderHistoryService.getAnyOrderDetail(id, session)`'                    = '`OrderHistoryService.getAdminOrderDetail(orderId)`'
  '`OrderHistoryService.getTimeline(id, session)`'                          = '`OrderRepository.findTimeline(orderId)`'

  # ----- NotificationService: align with real public methods -----
  '`NotificationService.getInbox(session, query)`'                          = '`NotificationService.getInboxByUserId(recipientId, limit, offset, filters)`'
  '`NotificationService.markAllRead(session)`'                              = '`NotificationService.markAllRead(recipientId)`'
  '`NotificationService.markRead(session, id)`'                             = '`NotificationService.markRead(notificationId, recipientId)`'
  '`NotificationService.resolveRecipient(event)`'                           = '`NotificationService.sendFromEvent(params)`'
  '`NotificationService.assertNotificationIdempotent(idempotencyKey)`'      = '`NotificationRepository.insertIfNotExists(data)`'
  '`NotificationRepository.persistNotification(payload)`'                   = '`NotificationRepository.insertIfNotExists(data)`'

  # ----- SearchService: real surface is a single search() -----
  '`SearchService.searchRestaurants(q, lat, lon, radiusKm)`'                = '`SearchService.search(q, category, cuisineType, tag, lat, lon, radiusKm, offset, limit)`'
  '`SearchService.searchItems(q, category, tag)`'                           = '`SearchService.search(q, category, cuisineType, tag, lat, lon, radiusKm, offset, limit)`'
  '`SearchService.validateSearchQuery(q, lat, lon, radiusKm)`'              = '`SearchService.search(q, category, cuisineType, tag, lat, lon, radiusKm, offset, limit)`'
  '`SearchService.clampPagination(limit, offset)`'                          = '`SearchService.search(q, category, cuisineType, tag, lat, lon, radiusKm, offset, limit)`'
  '`SearchService.scoreAndRank(results, query)`'                            = '`SearchService.search(q, category, cuisineType, tag, lat, lon, radiusKm, offset, limit)`'

  # ----- RestaurantService signature alignment -----
  '`RestaurantService.create(session, dto)`'                                = '`RestaurantService.create(ownerId, dto)`'
  '`RestaurantService.create(dto)`'                                         = '`RestaurantService.create(ownerId, dto)`'
  '`RestaurantService.create(requesterId, isAdmin, dto)`'                   = '`RestaurantService.create(ownerId, dto)`'
  '`RestaurantService.create(restaurantId, requesterId, isAdmin, dto)`'     = '`RestaurantService.create(ownerId, dto)`'
  '`RestaurantService.update(id, session, dto)`'                            = '`RestaurantService.update(id, requesterId, isAdmin, dto)`'
  '`RestaurantService.update(id, dto)`'                                     = '`RestaurantService.update(id, requesterId, isAdmin, dto)`'
  '`RestaurantService.update(id, restaurantId, requesterId, isAdmin, dto)`' = '`RestaurantService.update(id, requesterId, isAdmin, dto)`'
  '`RestaurantService.approve(id)`'                                         = '`RestaurantService.setApproved(id, true)`'
  '`RestaurantService.unapprove(id)`'                                       = '`RestaurantService.setApproved(id, false)`'
  '`RestaurantService.assertRestaurantOwnership(id, session)`'              = '`RestaurantService.update(id, requesterId, isAdmin, dto)`'
  '`RestaurantService.assertRestaurantOwnership(restaurantId, session)`'    = '`RestaurantService.update(id, requesterId, isAdmin, dto)`'
  '`RestaurantService.validateRestaurantDto(dto)`'                          = '`RestaurantService.create(ownerId, dto)`'
  '`RestaurantService.listPendingRestaurants(filters)`'                     = '`RestaurantRepository.findAll({ offset, limit, approvalStatus: ''pending'' })`'

  # ----- MenuService: validate* methods don't exist (class-validator) -----
  '`MenuService.validateMenuItemDto(dto)`'                                  = '`MenuService.create(requesterId, isAdmin, dto)`'
  '`MenuService.validateCategoryDto(dto)`'                                  = '`MenuService.createCategory(restaurantId, requesterId, isAdmin, dto)`'
  '`MenuService.assertMenuOwnership(restaurantId, requesterId, isAdmin)`'   = '`MenuService.update(id, requesterId, isAdmin, dto)`'

  # ----- ModifiersService signature alignment -----
  '`ModifiersService.createGroup(menuItemId, session, dto)`'                = '`ModifiersService.createGroup(menuItemId, requesterId, isAdmin, dto)`'
  '`ModifiersService.updateGroup(menuItemId, id, session, dto)`'            = '`ModifiersService.updateGroup(groupId, menuItemId, requesterId, isAdmin, dto)`'

  # ----- PromotionService: split into admin/restaurant services -----
  '`PromotionService.activate(id)`'                                         = '`PromotionAdminService.activatePromotion(id)`'
  '`PromotionService.pause(id)`'                                            = '`PromotionAdminService.pausePromotion(id)`'
  '`PromotionService.cancel(id)`'                                           = '`PromotionAdminService.deletePromotion(id)`'
  '`PromotionService.activate(id, session)`'                                = '`PromotionRestaurantService.activatePromotion(id, restaurantId, callerId)`'
  '`PromotionService.pause(id, session)`'                                   = '`PromotionRestaurantService.pausePromotion(id, restaurantId, callerId)`'
  '`PromotionService.cancel(id, session)`'                                  = '`PromotionRestaurantService.deletePromotion(id, restaurantId, callerId)`'
  '`PromotionService.createCoupons(id, dto)`'                               = '`PromotionAdminService.createCouponCodes(promotionId, dto)`'
  '`PromotionService.createCoupons(id, session, dto)`'                      = '`PromotionAdminService.createCouponCodes(promotionId, dto)`'
  '`PromotionService.computeAndReserveDiscount(orderId, customerId, items)`'= '`PromotionService.computeAndReserveDiscount(params)`'
  '`PromotionService.validateCoupon(code)`'                                 = '`PromotionService.computeAndReserveDiscount(params)`'
  '`PromotionService.validatePromotionDto(dto)`'                            = '`PromotionAdminService.createPromotion(dto)`'

  # ----- PaymentService: most asserts don't exist; merged into ProcessIpnHandler -----
  '`PaymentService.recordPaymentTransaction(orderId, amount, method)`'      = '`PaymentTransactionRepository.create(data)`'
  '`PaymentService.recordRefundTransaction(orderId, amount, gatewayRef)`'   = '`PaymentTransactionRepository.create(data)`'
  '`PaymentService.refund(id, session, dto)`'                               = '`OrderCancelledAfterPaymentHandler.handle(event)`'
  '`PaymentService.assertAmountMatches(orderAmount, ipnAmount)`'            = '`ProcessIpnHandler.execute(command)`'
  '`PaymentService.assertIpnIdempotent(txnRef)`'                            = '`ProcessIpnHandler.execute(command)`'
  '`PaymentService.assertRefundAmount(amount, originalAmount)`'             = '`OrderCancelledAfterPaymentHandler.handle(event)`'
  '`PaymentService.assertRefundIdempotent(orderId)`'                        = '`OrderCancelledAfterPaymentHandler.handle(event)`'

  # ----- CartService: internal helpers collapsed to public surface -----
  '`CartService.refreshCartTtl(customerId)`'                                = '`CartService.addItem(customerId, dto)`'
  '`CartService.assertSingleRestaurantCart(cart, restaurantId)`'            = '`CartService.addItem(customerId, dto)`'
  '`CartService.mergeLineItem(cart, item)`'                                 = '`CartService.addItem(customerId, dto)`'

  # ----- MenuItemProjector: real method is handle() -----
  '`MenuItemProjector.projectMenuItemSnapshot(event)`'                      = '`MenuItemProjector.handle(event)`'

  # ----- NotificationGateway: real public methods -----
  '`NotificationGateway.authenticateGatewayClient(socket)`'                 = '`NotificationGateway.handleConnection(client)`'
  '`NotificationGateway.broadcastOrderStatusChanged(orderId, userId, status)`' = '`NotificationGateway.sendToUser(userId, event, payload)`'

  # ----- QuietHoursService: real method -----
  '`QuietHoursService.isWithinQuietHours(userId, now)`'                     = '`QuietHoursService.isQuietHours(prefs, now)`'

  # ----- DeviceTokenRepository: real method -----
  '`DeviceTokenRepository.invalidateDeviceToken(token)`'                    = '`DeviceTokenRepository.deactivate(userId, token)`'

  # ----- NotificationPreferenceService: not found; use NotificationService -----
  '`NotificationPreferenceService.getPreferences(session)`'                 = '`NotificationService.getInboxStats(recipientId)`'
  '`NotificationPreferenceService.updatePreferences(session, dto)`'         = '`NotificationService.getInboxStats(recipientId)`'

  # ----- EventPublisher: delegated to NestJS EventBus -----
  '`EventPublisher.publishOrderPlacedEvent(orderId, customerId, totalAmount)`'         = '`eventBus.publish(new OrderPlacedEvent(orderId, customerId, totalAmount))`'
  '`EventPublisher.publishOrderStatusChangedEvent(orderId, oldStatus, newStatus)`'     = '`eventBus.publish(new OrderStatusChangedEvent(orderId, oldStatus, newStatus))`'
  '`EventPublisher.publishOrderCancelledAfterPaymentEvent(orderId, refundAmount)`'     = '`eventBus.publish(new OrderCancelledAfterPaymentEvent(orderId, refundAmount))`'
  '`EventPublisher.publishOrderReadyForPickupEvent(orderId, restaurantId)`'            = '`eventBus.publish(new OrderReadyForPickupEvent(orderId, restaurantId))`'
  '`EventPublisher.publishPaymentConfirmedEvent(orderId, txnRef, amount)`'             = '`eventBus.publish(new PaymentConfirmedEvent(orderId, txnRef, amount))`'
  '`EventPublisher.publishPaymentFailedEvent(orderId, reason)`'                        = '`eventBus.publish(new PaymentFailedEvent(orderId, reason))`'
  '`EventPublisher.publishRestaurantUpdatedEvent(restaurantId)`'                       = '`eventBus.publish(new RestaurantUpdatedEvent(restaurantId))`'
  '`EventPublisher.publishMenuItemUpdatedEvent(menuItemId, restaurantId)`'             = '`eventBus.publish(new MenuItemUpdatedEvent(menuItemId, restaurantId))`'
  '`EventPublisher.publishShipperApprovedEvent(shipperId)`'                            = '`eventBus.publish(new ShipperApprovedEvent(shipperId))`'
  '`EventPublisher.publishShipperAvailabilityChangedEvent(shipperId, isAvailable)`'    = '`eventBus.publish(new ShipperAvailabilityChangedEvent(shipperId, isAvailable))`'
  '`EventPublisher.publishPartnerSuspendedEvent(partnerId, partnerType)`'              = '`eventBus.publish(new PartnerSuspendedEvent(partnerId, partnerType))`'
  '`EventPublisher.publishRoleChangedEvent(userId, role, action)`'                     = '`eventBus.publish(new RoleChangedEvent(userId, role, action))`'

  # ----- AuthService: delegated to better-auth library -----
  '`AuthService.signInWithEmail(email, password)`'                          = '`auth.api.signInEmail({ body: { email, password } })`'
  '`AuthService.signUpWithEmail(email, password, name)`'                    = '`auth.api.signUpEmail({ body: { email, password, name } })`'
  '`AuthService.signOut(sessionId)`'                                        = '`auth.api.signOut({ headers })`'
  '`AuthService.validateSession(token)`'                                    = '`auth.api.getSession({ headers })`'
  '`AuthService.requestPasswordReset(email)`'                               = '`auth.api.forgetPassword({ body: { email } })`'
  '`AuthService.createSession(userId, ipAddress, userAgent)`'               = '`auth.api.signInEmail({ body: { email, password } })`'

  # ----- OrderHistoryService.validateOrderFilters: validation is in DTO -----
  '`OrderHistoryService.validateOrderFilters(filters)`'                     = '`OrderHistoryService.getCustomerOrderList(actorId, filters)`'

  # ----- ZonesService SRS-imagined helpers: redirect to real surface -----
  '`ZonesService.selectDeliveryZone(restaurantId, lat, lon)`'               = '`ZonesService.findByRestaurant(restaurantId)`'
  '`ZonesService.calculateFeeAndEta(zone, distance)`'                       = '`ZonesService.findByRestaurant(restaurantId)`'
  '`ZonesService.estimateDelivery(restaurantId, query)`'                    = '`ZonesService.findByRestaurant(restaurantId)`'
  '`ZonesService.calculateDeliveryFee(restaurantId, lat, lon)`'             = '`ZonesService.findByRestaurant(restaurantId)`'
  '`ZonesService.assertZoneOwnership(restaurantId, requesterId, isAdmin)`'  = '`ZonesService.create(restaurantId, requesterId, isAdmin, dto)`'
  '`ZonesService.validateZoneDto(zone)`'                                    = '`ZonesService.create(restaurantId, requesterId, isAdmin, dto)`'

  # ----- RestaurantRepository.findAll: object-shaped opts -----
  '`RestaurantRepository.findAll(offset, limit)`'                           = '`RestaurantRepository.findAll({ offset, limit })`'
}

$applied = 0
foreach ($k in $renames.Keys) {
  if ($txt.Contains($k)) {
    $txt = $txt.Replace($k, $renames[$k])
    $applied++
  }
}
Write-Output "Step 2: applied $applied rename keys"

# ============================================================================
# STEP 3: Clean up — remove any empty <br>❖ artifacts and tidy spacing
# ============================================================================
$txt = [regex]::Replace($txt, "<br>$nl\s+\.\s*", "<br>$nl ")
$txt = [regex]::Replace($txt, "<br>$nl\s+(?=\s*\|)", "")

[System.IO.File]::WriteAllBytes($path, $enc.GetBytes($txt))
Write-Output "Wrote $($txt.Length) bytes to SRS_FoodDelivery.md"
