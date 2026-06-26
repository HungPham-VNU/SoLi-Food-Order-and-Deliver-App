import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '@/auth/auth.module';
import { OrderingContractsModule } from '../ordering-contracts.module';
import { CartModule } from '../cart/cart.module';
import { OrderHistoryModule } from '../order-history/order-history.module';
import { OrderLifecycleModule } from '../order-lifecycle/order-lifecycle.module';
import { OrderingRpcController } from './ordering-rpc.controller';
import { OrderingCartRpcController } from './ordering-cart-rpc.controller';
import { OrderingOrderRpcController } from './ordering-order-rpc.controller';
import { OrderingHistoryRpcController } from './ordering-history-rpc.controller';

/**
 * Ordering TCP RPC surface. The gateway translates the public cart/checkout/
 * order/history REST routes into the `ordering.*` patterns these controllers
 * handle; the Review service uses `ordering.review-eligibility.get.v1`.
 *
 * CqrsModule provides CommandBus (checkout → PlaceOrderCommand, transitions →
 * TransitionOrderCommand); the imported domain modules provide CartService,
 * OrderHistoryService, OrderRepository, and the Payment port.
 */
@Module({
  imports: [
    ConfigModule,
    CqrsModule,
    AuthModule,
    OrderingContractsModule,
    CartModule,
    OrderHistoryModule,
    OrderLifecycleModule,
  ],
  controllers: [
    OrderingRpcController,
    OrderingCartRpcController,
    OrderingOrderRpcController,
    OrderingHistoryRpcController,
  ],
})
export class OrderingRpcModule {}
