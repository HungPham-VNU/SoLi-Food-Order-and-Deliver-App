import {
  Controller,
  ForbiddenException,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  ORDERING_RPC_PATTERNS,
  orderTransitionRequestSchema,
  type OrderTransitionRequest,
} from '@uitfood/contracts';
import { TransitionOrderCommand } from '@/ordering/order-lifecycle/commands/transition-order.command';
import { OrderLifecycleService } from '@/ordering/order-lifecycle/services/order-lifecycle.service';
import { OrderRepository } from '@/ordering/order-lifecycle/repositories/order.repository';
import { InternalAuthService } from '@/auth/internal-auth.service';
import {
  PAYMENT_INITIATION_PORT,
  type IPaymentInitiationPort,
} from '@/shared/ports/payment-initiation.port';
import type {
  CancellationReason,
  TriggeredByRole,
} from '@/ordering/order/order.schema';
import { asOrderingRpcException } from './ordering-rpc.errors';

interface Auth {
  internalAuth: string;
}

/**
 * Resolves the single actor role used by the order state machine from the
 * gateway-issued roles claim. Priority: admin > restaurant > shipper > customer.
 */
function resolveActorRole(roles: string[]): TriggeredByRole {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('restaurant')) return 'restaurant';
  if (roles.includes('shipper')) return 'shipper';
  return 'customer';
}

/**
 * Order lifecycle RPC surface: the generic state-machine transition (the gateway
 * maps each REST action to a target status), order/timeline reads, and the
 * mobile VNPay pending-payment cancellation.
 */
@Controller()
export class OrderingOrderRpcController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly orderRepo: OrderRepository,
    private readonly lifecycleService: OrderLifecycleService,
    private readonly auth: InternalAuthService,
    @Inject(PAYMENT_INITIATION_PORT)
    private readonly payments: IPaymentInitiationPort,
  ) {}

  @MessagePattern(ORDERING_RPC_PATTERNS.transitionOrder)
  async transition(@Payload() p: OrderTransitionRequest) {
    try {
      const req = orderTransitionRequestSchema.parse(p);
      const caller = this.auth.verifyOrderingToken(req.internalAuth);
      const actorRole = resolveActorRole(caller.roles);
      return await this.commandBus.execute(
        new TransitionOrderCommand(
          req.orderId,
          req.toStatus,
          caller.userId,
          actorRole,
          req.note,
          req.cancellationReason as CancellationReason | undefined,
        ),
      );
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  @MessagePattern(ORDERING_RPC_PATTERNS.getOrder)
  async getOrder(@Payload() p: Auth & { orderId: string }) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      const result = await this.orderRepo.findWithItemsAndCustomer(p.orderId);
      if (!result) throw new NotFoundException(`Order ${p.orderId} not found.`);
      const actorRole = resolveActorRole(caller.roles);
      if (actorRole === 'shipper') {
        if (
          result.order.status !== 'ready_for_pickup' &&
          result.order.shipperId !== caller.userId
        ) {
          throw new ForbiddenException('You do not have access to this order.');
        }
      } else {
        await this.lifecycleService.assertOwnership(
          result.order,
          caller.userId,
          actorRole,
        );
      }
      return result;
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  @MessagePattern(ORDERING_RPC_PATTERNS.getOrderTimeline)
  async getTimeline(@Payload() p: Auth & { orderId: string }) {
    try {
      this.auth.verifyOrderingToken(p.internalAuth);
      return await this.orderRepo.findTimeline(p.orderId);
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  @MessagePattern(ORDERING_RPC_PATTERNS.cancelPendingPayment)
  async cancelPendingPayment(@Payload() p: Auth & { orderId: string }) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      const transaction = await this.payments.cancelPendingPaymentForOrder(
        p.orderId,
        caller.userId,
        'Customer cancelled VNPay payment from mobile checkout',
      );
      await this.commandBus.execute(
        new TransitionOrderCommand(
          p.orderId,
          'cancelled',
          caller.userId,
          'customer',
          'Customer cancelled VNPay payment before completion.',
          'customer_request',
        ),
      );
      return transaction;
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }
}
