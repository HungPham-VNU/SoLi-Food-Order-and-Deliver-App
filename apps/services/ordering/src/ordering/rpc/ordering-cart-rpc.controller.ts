import { Controller } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ORDERING_RPC_PATTERNS } from '@uitfood/contracts';
import { CartService } from '@/ordering/cart/cart.service';
import { PlaceOrderCommand } from '@/ordering/order/commands/place-order.command';
import { InternalAuthService } from '@/auth/internal-auth.service';
import type {
  AddItemToCartDto,
  UpdateCartItemQuantityDto,
  UpdateCartItemModifiersDto,
} from '@/ordering/cart/dto/cart.dto';
import type { CheckoutDto } from '@/ordering/order/dto/checkout.dto';
import type { Order } from '@/ordering/order/order.schema';
import { asOrderingRpcException } from './ordering-rpc.errors';

interface Auth {
  internalAuth: string;
}

/**
 * Cart + checkout RPC surface. The gateway authenticates the customer session,
 * mints an `aud=ordering` token, and forwards the request here; the customer id
 * is taken from the verified token (never the payload).
 */
@Controller()
export class OrderingCartRpcController {
  constructor(
    private readonly cart: CartService,
    private readonly commandBus: CommandBus,
    private readonly auth: InternalAuthService,
  ) {}

  @MessagePattern(ORDERING_RPC_PATTERNS.getCart)
  async getCart(@Payload() p: Auth) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      return await this.cart.getCart(caller.userId);
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  @MessagePattern(ORDERING_RPC_PATTERNS.addCartItem)
  async addItem(@Payload() p: Auth & { dto: AddItemToCartDto }) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      return await this.cart.addItem(caller.userId, p.dto);
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  @MessagePattern(ORDERING_RPC_PATTERNS.updateCartItem)
  async updateItem(
    @Payload()
    p: Auth & { cartItemId: string; dto: UpdateCartItemQuantityDto },
  ) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      return await this.cart.updateItemQuantity(
        caller.userId,
        p.cartItemId,
        p.dto,
      );
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  @MessagePattern(ORDERING_RPC_PATTERNS.updateCartItemModifiers)
  async updateItemModifiers(
    @Payload()
    p: Auth & { cartItemId: string; dto: UpdateCartItemModifiersDto },
  ) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      return await this.cart.updateItemModifiers(
        caller.userId,
        p.cartItemId,
        p.dto,
      );
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  @MessagePattern(ORDERING_RPC_PATTERNS.removeCartItem)
  async removeItem(@Payload() p: Auth & { cartItemId: string }) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      return await this.cart.removeItem(caller.userId, p.cartItemId);
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  @MessagePattern(ORDERING_RPC_PATTERNS.clearCart)
  async clearCart(@Payload() p: Auth) {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      await this.cart.clearCart(caller.userId);
      return { cleared: true };
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }

  @MessagePattern(ORDERING_RPC_PATTERNS.checkout)
  async checkout(
    @Payload()
    p: Auth & {
      dto: CheckoutDto;
      idempotencyKey?: string;
      ipAddr?: string;
    },
  ): Promise<Order> {
    try {
      const caller = this.auth.verifyOrderingToken(p.internalAuth);
      const command = new PlaceOrderCommand(
        caller.userId,
        p.dto.deliveryAddress,
        p.dto.paymentMethod,
        p.dto.note,
        p.idempotencyKey,
        p.ipAddr,
        p.dto.couponCode,
      );
      return await this.commandBus.execute(command);
    } catch (e) {
      throw asOrderingRpcException(e);
    }
  }
}
