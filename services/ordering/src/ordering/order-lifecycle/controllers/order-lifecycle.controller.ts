import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { hasRole } from '@/shared/security/role.util';
import { TransitionOrderCommand } from '../commands/transition-order.command';
import { OrderRepository } from '../repositories/order.repository';
import { CancelOrderDto, RefundOrderDto } from '../dto/cancel-order.dto';
import type { TriggeredByRole } from '../../order/order.schema';

// ---------------------------------------------------------------------------
// Example responses (for Swagger documentation)
// ---------------------------------------------------------------------------

/**
 * A full Order row as returned by every transition endpoint and GET /orders/:id.
 * Individual endpoints override `status`, `version`, and `shipperId` to reflect
 * the state the order is in after that specific transition.
 */
const ORDER_EXAMPLE = {
  id: 'a1f3c8e2-5b7d-4e9a-8c1f-2d3e4f5a6b7c',
  customerId: 'c3f5e0a4-7d9f-4a1c-ae3b-4f5a6b7c8d9e',
  restaurantId: 'b2e4d9f3-6c8e-4f0b-9d2a-3e4f5a6b7c8d',
  restaurantName: 'Phở Hà Nội',
  cartId: 'd4a6f1b5-8e0a-4b2d-bf4c-5a6b7c8d9e0f',
  status: 'confirmed',
  totalAmount: 125000,
  shippingFee: 15000,
  discountAmount: 0,
  estimatedDeliveryMinutes: 32.5,
  paymentMethod: 'cod',
  deliveryAddress: {
    street: '227 Nguyễn Văn Cừ',
    district: 'Quận 5',
    city: 'Hồ Chí Minh',
    latitude: 10.762622,
    longitude: 106.682172,
  },
  note: 'Ít cay, không hành',
  paymentUrl: null,
  expiresAt: '2026-05-28T10:30:30.000Z',
  version: 1,
  shipperId: null,
  createdAt: '2026-05-28T10:15:30.000Z',
  updatedAt: '2026-05-28T10:18:45.000Z',
};

const ORDER_ITEMS_EXAMPLE = [
  {
    id: 'e5b7a2c6-9f1b-4c3e-a05d-6b7c8d9e0f1a',
    orderId: 'a1f3c8e2-5b7d-4e9a-8c1f-2d3e4f5a6b7c',
    menuItemId: 'f6c8b3d7-a02c-4d4f-b16e-7c8d9e0f1a2b',
    itemName: 'Phở Bò Tái',
    unitPrice: 45000,
    modifiersPrice: 10000,
    quantity: 2,
    subtotal: 110000,
    modifiers: [
      {
        groupId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
        groupName: 'Topping',
        optionId: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
        optionName: 'Trứng chần',
        price: 10000,
      },
    ],
  },
];

const ORDER_TIMELINE_EXAMPLE = [
  {
    id: '4d5e6f7a-8b9c-4d0e-bf1a-2b3c4d5e6f7a',
    orderId: 'a1f3c8e2-5b7d-4e9a-8c1f-2d3e4f5a6b7c',
    fromStatus: null,
    toStatus: 'pending',
    triggeredBy: 'c3f5e0a4-7d9f-4a1c-ae3b-4f5a6b7c8d9e',
    triggeredByRole: 'customer',
    note: null,
    cancellationReason: null,
    createdAt: '2026-05-28T10:15:30.000Z',
  },
  {
    id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b',
    orderId: 'a1f3c8e2-5b7d-4e9a-8c1f-2d3e4f5a6b7c',
    fromStatus: 'pending',
    toStatus: 'confirmed',
    triggeredBy: 'a9b8c7d6-e5f4-4a3b-8c2d-1e0f9a8b7c6d',
    triggeredByRole: 'restaurant',
    note: null,
    cancellationReason: null,
    createdAt: '2026-05-28T10:18:45.000Z',
  },
];

/**
 * OrderLifecycleController
 *
 * Exposes the HTTP surface for the Phase 5 order state machine.
 *
 * All mutation endpoints dispatch a TransitionOrderCommand with the actor's
 * identity and role. Ownership and permission enforcement happens inside
 * TransitionOrderHandler and OrderLifecycleService — not in this controller.
 *
 * Routes:
 *  PATCH  /orders/:id/confirm         → T-01 (pending → confirmed, COD)
 *  PATCH  /orders/:id/start-preparing → T-06 (confirmed → preparing)
 *  PATCH  /orders/:id/ready           → T-08 (preparing → ready_for_pickup)
 *  PATCH  /orders/:id/pickup          → T-09 (ready_for_pickup → picked_up)
 *  PATCH  /orders/:id/en-route        → T-10 (picked_up → delivering)
 *  PATCH  /orders/:id/deliver         → T-11 (delivering → delivered)
 *  PATCH  /orders/:id/cancel          → T-03 / T-05 / T-07 (body: { reason })
 *  POST   /orders/:id/refund          → T-12 (delivered → refunded, admin only)
 *  GET    /orders/:id                 → get current order state + items
 *  GET    /orders/:id/timeline        → get OrderStatusLog history
 *
 * Phase: 5
 */
@ApiTags('Ordering - Order Lifecycle')
@ApiBearerAuth()
@Controller('orders')
export class OrderLifecycleController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly orderRepo: OrderRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // T-01: pending → confirmed (COD — restaurant accepts)
  // ---------------------------------------------------------------------------

  @Patch(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm order (T-01 — COD: restaurant accepts)' })
  @ApiOkResponse({
    description: 'Order confirmed',
    schema: { example: { ...ORDER_EXAMPLE, status: 'confirmed', version: 1 } },
  })
  @ApiForbiddenResponse({ description: 'Role or ownership check failed' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid transition or VNPay order',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ) {
    const actorRole = this.resolveRole(session.user.role);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.commandBus.execute(
      new TransitionOrderCommand(id, 'confirmed', session.user.id, actorRole),
    );
  }

  // ---------------------------------------------------------------------------
  // T-06: confirmed → preparing (restaurant starts cooking)
  // ---------------------------------------------------------------------------

  @Patch(':id/start-preparing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start preparing order (T-06)' })
  @ApiOkResponse({
    description: 'Order is now being prepared',
    schema: { example: { ...ORDER_EXAMPLE, status: 'preparing', version: 2 } },
  })
  @ApiForbiddenResponse({ description: 'Role or ownership check failed' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid transition' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async startPreparing(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ) {
    const actorRole = this.resolveRole(session.user.role);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.commandBus.execute(
      new TransitionOrderCommand(id, 'preparing', session.user.id, actorRole),
    );
  }

  // ---------------------------------------------------------------------------
  // T-08: preparing → ready_for_pickup (food ready for shipper)
  // ---------------------------------------------------------------------------

  @Patch(':id/ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark order ready for pickup (T-08)' })
  @ApiOkResponse({
    description: 'Order is ready for pickup',
    schema: {
      example: { ...ORDER_EXAMPLE, status: 'ready_for_pickup', version: 3 },
    },
  })
  @ApiForbiddenResponse({ description: 'Role or ownership check failed' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid transition' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async markReady(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ) {
    const actorRole = this.resolveRole(session.user.role);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.commandBus.execute(
      new TransitionOrderCommand(
        id,
        'ready_for_pickup',
        session.user.id,
        actorRole,
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // T-09: ready_for_pickup → picked_up (shipper self-assigns)
  // ---------------------------------------------------------------------------

  @Patch(':id/pickup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Shipper picks up order (T-09, self-assign)' })
  @ApiOkResponse({
    description: 'Order picked up by shipper',
    schema: {
      example: {
        ...ORDER_EXAMPLE,
        status: 'picked_up',
        version: 4,
        shipperId: '3c4d5e6f-7a8b-4c9d-ae0f-2a3b4c5d6e7f',
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Role check failed' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({
    description: 'Another shipper claimed the order first',
  })
  @ApiUnprocessableEntityResponse({ description: 'Invalid transition' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async pickup(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ) {
    const actorRole = this.resolveRole(session.user.role);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.commandBus.execute(
      new TransitionOrderCommand(id, 'picked_up', session.user.id, actorRole),
    );
  }

  // ---------------------------------------------------------------------------
  // T-10: picked_up → delivering (shipper en route)
  // ---------------------------------------------------------------------------

  @Patch(':id/en-route')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Shipper starts en route (T-10)' })
  @ApiOkResponse({
    description: 'Order is being delivered',
    schema: {
      example: {
        ...ORDER_EXAMPLE,
        status: 'delivering',
        version: 5,
        shipperId: '3c4d5e6f-7a8b-4c9d-ae0f-2a3b4c5d6e7f',
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Role or ownership check failed' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid transition' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async enRoute(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ) {
    const actorRole = this.resolveRole(session.user.role);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.commandBus.execute(
      new TransitionOrderCommand(id, 'delivering', session.user.id, actorRole),
    );
  }

  // ---------------------------------------------------------------------------
  // T-11: delivering → delivered (handoff confirmed)
  // ---------------------------------------------------------------------------

  @Patch(':id/deliver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm order delivered (T-11)' })
  @ApiOkResponse({
    description: 'Order delivered successfully',
    schema: {
      example: {
        ...ORDER_EXAMPLE,
        status: 'delivered',
        version: 6,
        shipperId: '3c4d5e6f-7a8b-4c9d-ae0f-2a3b4c5d6e7f',
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Role or ownership check failed' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid transition' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async deliver(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: UserSession,
  ) {
    const actorRole = this.resolveRole(session.user.role);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.commandBus.execute(
      new TransitionOrderCommand(id, 'delivered', session.user.id, actorRole),
    );
  }

  // ---------------------------------------------------------------------------
  // T-03 / T-05 / T-07: cancel order (any cancellable state)
  // ---------------------------------------------------------------------------

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel order (T-03 / T-05 / T-07)',
    description:
      'Cancels the order from its current state. Requires a reason. ' +
      'VNPay paid orders trigger a refund event automatically.',
  })
  @ApiOkResponse({
    description: 'Order cancelled',
    schema: {
      example: {
        ...ORDER_EXAMPLE,
        status: 'cancelled',
        version: 2,
        updatedAt: '2026-05-28T10:25:10.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Missing reason note' })
  @ApiForbiddenResponse({ description: 'Role or ownership check failed' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiUnprocessableEntityResponse({
    description: 'Order cannot be cancelled from current state',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: UserSession,
    @Body() dto: CancelOrderDto,
  ) {
    const actorRole = this.resolveRole(session.user.role);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.commandBus.execute(
      new TransitionOrderCommand(
        id,
        'cancelled',
        session.user.id,
        actorRole,
        dto.reason,
        dto.reasonCode,
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // T-12: delivered → refunded (admin only)
  // ---------------------------------------------------------------------------

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process refund for delivered order (T-12, admin only)',
    description: 'Admin-only dispute resolution. Requires a reason note.',
  })
  @ApiOkResponse({
    description: 'Order refunded',
    schema: {
      example: {
        ...ORDER_EXAMPLE,
        status: 'refunded',
        version: 7,
        shipperId: '3c4d5e6f-7a8b-4c9d-ae0f-2a3b4c5d6e7f',
        updatedAt: '2026-05-28T12:30:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Missing reason note' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiUnprocessableEntityResponse({
    description: 'Order is not in delivered state',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() session: UserSession,
    @Body() dto: RefundOrderDto,
  ) {
    if (!hasRole(session.user.role, 'admin')) {
      throw new ForbiddenException('Only admins can process refunds.');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.commandBus.execute(
      new TransitionOrderCommand(
        id,
        'refunded',
        session.user.id,
        'admin',
        dto.reason,
        dto.reasonCode ?? 'customer_request',
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // GET /orders/:id — current order state + items
  // ---------------------------------------------------------------------------

  @Get(':id')
  @ApiOperation({ summary: 'Get order details (state + items)' })
  @ApiOkResponse({
    description: 'Order details',
    schema: { example: { order: ORDER_EXAMPLE, items: ORDER_ITEMS_EXAMPLE } },
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() _session: UserSession,
  ) {
    const result = await this.orderRepo.findWithItems(id);
    if (!result) {
      throw new NotFoundException(`Order ${id} not found.`);
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // GET /orders/:id/timeline — audit trail
  // ---------------------------------------------------------------------------

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get order status timeline (audit log)' })
  @ApiOkResponse({
    description: 'Ordered list of status log entries',
    schema: { example: ORDER_TIMELINE_EXAMPLE },
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getTimeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() _session: UserSession,
  ) {
    return this.orderRepo.findTimeline(id);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Map the session user's role to a TriggeredByRole.
   *
   * Priority: admin > restaurant > shipper > customer
   * This means a user with multiple roles gets the most-privileged one.
   */
  private resolveRole(
    userRole: string | string[] | undefined | null,
  ): TriggeredByRole {
    if (hasRole(userRole, 'admin')) return 'admin';
    if (hasRole(userRole, 'restaurant')) return 'restaurant';
    if (hasRole(userRole, 'shipper')) return 'shipper';
    return 'customer';
  }
}
