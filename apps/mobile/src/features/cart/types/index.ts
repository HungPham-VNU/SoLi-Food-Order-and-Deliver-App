// ─── Cart Feature Types ────────────────────────────────────────────────────────

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  selectedModifiers?: SelectedModifierResponse[];
}

export interface OrderSummary {
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  discountThreshold?: number;
  discountPercent?: number;
  remainingForDiscount?: number;
  estimatedMinutes?: number;
}

export type CheckoutSummary = OrderSummary;

export interface CartScreenProps {
  onBack?: () => void;
  onCheckout?: () => void;
  onContinueShopping?: () => void;
}

export interface DeliveryAddressScreenProps {
  onBack?: () => void;
  onContinue?: (selectedAddressId: string) => void;
  onAddNewAddress?: () => void;
  onEditAddress?: (addressId: string) => void;
  onSelectAddress?: (addressId: string) => void;
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expiry?: string;
  color?: string;
  type: 'card' | 'apple-pay' | 'google-pay' | 'cash';
}

export interface PaymentScreenProps {
  onBack?: () => void;
  onContinue?: (paymentMethod: PaymentMethod) => void;
  onAddPaymentMethod?: () => void;
  onSelectPaymentMethod?: (paymentMethod: PaymentMethod) => void;
}

export interface ReviewScreenProps {
  onBack?: () => void;
  onPlaceOrder?: () => void;
}

// ─── Backend API Types ────────────────────────────────────────────────────────

export interface SelectedOption {
  groupId: string;
  optionId: string;
}

export interface AddItemToCartRequest {
  menuItemId: string;
  restaurantId: string;
  restaurantName: string;
  itemName: string;
  unitPrice: number;
  imageUrl?: string | null;
  quantity: number;
  selectedModifiers?: SelectedOption[];
  optimisticSelectedModifiers?: SelectedModifierResponse[];
}

export interface UpdateCartItemQuantityRequest {
  quantity: number;
}

export interface UpdateCartItemModifiersRequest {
  selectedOptions: SelectedOption[];
}

export interface SelectedModifierResponse {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface CartItemResponse {
  cartItemId: string;
  menuItemId: string;
  itemName: string;
  unitPrice: number;
  imageUrl?: string | null;
  quantity: number;
  subtotal: number;
  selectedModifiers: SelectedModifierResponse[];
}

export interface CartResponse {
  cartId: string;
  customerId: string;
  restaurantId: string;
  restaurantName: string;
  items: CartItemResponse[];
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryAddressDto {
  latitude?: number;
  longitude?: number;
}

export interface CheckoutDto {
  deliveryAddress: DeliveryAddressDto;
  paymentMethod: 'cod' | 'vnpay';
  note?: string;
  couponCode?: string;
}

export interface CheckoutResponseDto {
  orderId: string;
  status: string;
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  paymentMethod: 'cod' | 'vnpay';
  paymentUrl?: string;
  estimatedDeliveryMinutes?: number;
  createdAt: string;
}
