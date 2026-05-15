// ─── Cart Feature Types ────────────────────────────────────────────────────────

export interface CartItem {
  id: string;
  name: string;
  subtitle: string;
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
}

export interface CartScreenProps {
  onBack?: () => void;
  onCheckout?: () => void;
  onContinueShopping?: () => void;
}

export interface ShippingAddressScreenProps {
  onBack?: () => void;
  onContinue?: (selectedAddressId: string) => void;
  onAddNewAddress?: () => void;
  onEditAddress?: (addressId: string) => void;
  onSelectAddress?: (addressId: string) => void;
}

export interface PaymentScreenProps {
  onBack?: () => void;
  onContinue?: (selectedPaymentMethodId: string) => void;
  onAddPaymentMethod?: () => void;
  onSelectPaymentMethod?: (paymentMethodId: string) => void;
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
  quantity: number;
  selectedModifiers?: SelectedOption[];
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
