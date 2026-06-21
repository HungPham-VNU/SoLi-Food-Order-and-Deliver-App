import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DatabaseModule } from '@/drizzle/drizzle.module';
import { RestaurantSnapshotRepository } from '../acl/repositories/restaurant-snapshot.repository';

// Controllers
import { OrderLifecycleController } from './controllers/order-lifecycle.controller';
import { PaymentCancellationController } from './controllers/payment-cancellation.controller';

// Commands
import { TransitionOrderHandler } from './commands/transition-order.handler';

// Event handlers — incoming Payment BC events
import { PaymentConfirmedEventHandler } from './events/payment-confirmed.handler';
import { PaymentFailedEventHandler } from './events/payment-failed.handler';
// Event handlers — Promotion BC (PR-3)
import { PromotionRollbackOnCancellationHandler } from './events/promotion-rollback-on-cancellation.handler';

// Tasks
import { OrderTimeoutTask } from './tasks/order-timeout.task';

// Services
import { OrderLifecycleService } from './services/order-lifecycle.service';

// Repositories
import { OrderRepository } from './repositories/order.repository';
import { PaymentModule } from '@/module/payment/payment.module';
import { PromotionModule } from '@/module/promotion/promotion.module';

/**
 * OrderLifecycleModule — Phase 5 implementation.
 *
 * Hosts the hand-crafted state machine (D6-A), TransitionOrderHandler,
 * OrderLifecycleService, OrderLifecycleController, and the
 * OrderTimeoutTask (@Cron — requires ScheduleModule.forRoot() in AppModule).
 *
 * Architecture decisions:
 *  D1-C  Single TransitionOrderCommand/Handler for all state transitions.
 *  D3-B  RestaurantSnapshotRepository declared directly here (avoids circular
 *         import with AclModule — mirrors the OrderModule pattern).
 *  D6-A  Hand-crafted TRANSITIONS map in constants/transitions.ts.
 *
 * Phase: 5
 */
@Module({
  imports: [CqrsModule, DatabaseModule, PaymentModule, PromotionModule],
  controllers: [OrderLifecycleController, PaymentCancellationController],
  providers: [
    // Command handler — core state machine logic
    TransitionOrderHandler,

    // Event handlers — incoming Payment BC events
    PaymentConfirmedEventHandler,
    PaymentFailedEventHandler,

    // Event handlers — Promotion BC (PR-3)
    // Rolls back reserved/confirmed promotion usages when an order is
    // cancelled or refunded. Uses PROMOTION_APPLICATION_PORT (DIP).
    // PromotionModule is imported explicitly above for this port.
    PromotionRollbackOnCancellationHandler,

    // Cron task — auto-cancel expired orders
    OrderTimeoutTask,

    // Service — ownership verification
    OrderLifecycleService,

    // Repositories
    OrderRepository,
    // RestaurantSnapshotRepository declared here directly to avoid a circular
    // import with AclModule (same pattern as OrderModule).
    RestaurantSnapshotRepository,
  ],
})
export class OrderLifecycleModule {}
