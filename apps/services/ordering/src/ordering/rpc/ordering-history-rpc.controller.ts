import { Controller, ForbiddenException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ORDERING_RPC_PATTERNS } from '@uitfood/contracts';
import { OrderHistoryService } from '@/ordering/order-history/services/order-history.service';
import { InternalAuthService } from '@/auth/internal-auth.service';
import type {
  OrderHistoryFiltersDto,
  AdminOrderFiltersDto,
} from '@/ordering/order-history/dto/order-history.dto';
import { asOrderingRpcException } from './ordering-rpc.errors';

interface Auth {
  internalAuth: string;
}

function requireRole(roles: string[], ...allowed: string[]): void {
  if (!roles.some((r) => allowed.includes(r))) {
    throw new ForbiddenException(
      `This action requires one of: ${allowed.join(', ')}.`,
    );
  }
}

/**
 * Order-history read RPC surface for all four actor types. The scope id is always
 * the verified caller's user id (customer / restaurant owner / shipper); admin
 * reads are unscoped. Role is checked against the gateway-issued token.
 */
@Controller()
export class OrderingHistoryRpcController {
  constructor(
    private readonly history: OrderHistoryService,
    private readonly auth: InternalAuthService,
  ) {}

  // --- Customer ---
  @MessagePattern(ORDERING_RPC_PATTERNS.customerOrders)
  async customerOrders(
    @Payload() p: Auth & { filters: OrderHistoryFiltersDto },
  ) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      return await this.history.getCustomerOrders(caller.userId, p.filters);
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  @MessagePattern(ORDERING_RPC_PATTERNS.customerOrderDetail)
  async customerOrderDetail(@Payload() p: Auth & { orderId: string }) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      return await this.history.getCustomerOrderDetail(
        caller.userId,
        p.orderId,
      );
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  @MessagePattern(ORDERING_RPC_PATTERNS.customerReorder)
  async customerReorder(@Payload() p: Auth & { orderId: string }) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      return await this.history.getCustomerReorderItems(
        caller.userId,
        p.orderId,
      );
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  // --- Restaurant ---
  @MessagePattern(ORDERING_RPC_PATTERNS.restaurantOrders)
  async restaurantOrders(
    @Payload() p: Auth & { filters: OrderHistoryFiltersDto },
  ) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      requireRole(caller.roles, 'restaurant', 'admin');
      return await this.history.getRestaurantOrders(caller.userId, p.filters);
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  @MessagePattern(ORDERING_RPC_PATTERNS.restaurantActiveOrders)
  async restaurantActiveOrders(@Payload() p: Auth) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      requireRole(caller.roles, 'restaurant', 'admin');
      return await this.history.getRestaurantActiveOrders(caller.userId);
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  // --- Shipper ---
  @MessagePattern(ORDERING_RPC_PATTERNS.shipperAvailableOrders)
  async shipperAvailable(@Payload() p: Auth) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      requireRole(caller.roles, 'shipper', 'admin');
      return await this.history.getAvailableOrders();
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  @MessagePattern(ORDERING_RPC_PATTERNS.shipperActiveOrder)
  async shipperActive(@Payload() p: Auth) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      requireRole(caller.roles, 'shipper', 'admin');
      return await this.history.getShipperActiveOrder(caller.userId);
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  @MessagePattern(ORDERING_RPC_PATTERNS.shipperHistory)
  async shipperHistory(
    @Payload() p: Auth & { filters: OrderHistoryFiltersDto },
  ) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      requireRole(caller.roles, 'shipper', 'admin');
      return await this.history.getShipperHistory(caller.userId, p.filters);
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  // --- Admin ---
  @MessagePattern(ORDERING_RPC_PATTERNS.adminOrders)
  async adminOrders(@Payload() p: Auth & { filters: AdminOrderFiltersDto }) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      requireRole(caller.roles, 'admin');
      return await this.history.getAllOrders(p.filters);
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  @MessagePattern(ORDERING_RPC_PATTERNS.adminOrderDetail)
  async adminOrderDetail(@Payload() p: Auth & { orderId: string }) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      requireRole(caller.roles, 'admin');
      return await this.history.getAnyOrderDetail(p.orderId);
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }
}
