/**
 * OrderPlacedEvent
 *
 * Published by: Ordering BC.
 *
 * Timing:
 *  - COD: emitted after successful checkout.
 *  - VNPay: emitted at checkout as not-ready, then emitted as ready only after
 *    verified IPN confirms payment and Ordering advances the order to paid.
 *
 * Downstream contexts must only treat the order as successfully placed when
 * readyForFulfillment is true.
 */
export class OrderPlacedEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly restaurantId: string,
    public readonly restaurantName: string,
    /** totalAmount = itemsTotal + shippingFee - discountAmount. */
    public readonly totalAmount: number,
    /** Shipping fee computed from the innermost eligible delivery zone. */
    public readonly shippingFee: number,
    public readonly paymentMethod: 'cod' | 'vnpay',
    public readonly items: Array<{
      menuItemId: string;
      name: string;
      quantity: number;
      unitPrice: number;
    }>,
    public readonly deliveryAddress: {
      street?: string;
      district?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
    },
    /**
     * Haversine distance in km from restaurant to delivery address.
     * Undefined when either party's coordinates were absent.
     */
    public readonly distanceKm: number | undefined,
    /**
     * Estimated delivery time in minutes.
     * Undefined when coordinates or zone data were unavailable.
     */
    public readonly estimatedDeliveryMinutes: number | undefined,
    /**
     * True only when downstream contexts may treat the order as successfully
     * placed. COD is ready immediately; VNPay is ready only after verified IPN
     * confirms payment and Ordering advances the order to paid.
     */
    public readonly readyForFulfillment: boolean = paymentMethod === 'cod',
  ) {}
}
