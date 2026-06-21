import type {
  OrderStatus,
  TriggeredByRole,
} from '@/shared/contracts/order.contract';

/**
 * OrderStatusChangedEvent
 *
 * Published by: Ordering BC (OrderLifecycleService) on every state transition
 * Consumed by: Notification Context (push notifications to affected actors)
 */
export class OrderStatusChangedEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly restaurantId: string,
    public readonly fromStatus: OrderStatus,
    public readonly toStatus: OrderStatus,
    public readonly triggeredByRole: TriggeredByRole,
    public readonly note?: string,
  ) {}
}
