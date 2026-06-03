import { apiFetch } from '@/src/lib/api-client';
import type {
  AddItemToCartRequest,
  CartItemResponse,
  CartResponse,
  UpdateCartItemQuantityRequest,
} from '../types';

function normalizeCartResponse(cart: CartResponse | null): CartResponse | null {
  if (!cart) {
    return null;
  }

  const items = Array.isArray(cart.items) ? cart.items : [];
  const normalizedItems: CartItemResponse[] = items.map((item) => {
    const selectedModifiers = Array.isArray(item.selectedModifiers)
      ? item.selectedModifiers
      : [];
    const modifierTotal = selectedModifiers.reduce(
      (sum, modifier) => sum + modifier.price,
      0,
    );
    const subtotal =
      typeof item.subtotal === 'number'
        ? item.subtotal
        : (item.unitPrice + modifierTotal) * item.quantity;

    return {
      ...item,
      selectedModifiers,
      subtotal,
    };
  });

  return {
    ...cart,
    items: normalizedItems,
    totalAmount:
      typeof cart.totalAmount === 'number'
        ? cart.totalAmount
        : normalizedItems.reduce((sum, item) => sum + item.subtotal, 0),
  };
}

export const getMyCart = async () =>
  normalizeCartResponse(await apiFetch<CartResponse | null>('/api/carts/my'));

export const addItemToCart = (data: AddItemToCartRequest) => {
  const { optimisticSelectedModifiers, ...requestBody } = data;

  return apiFetch<CartResponse>('/api/carts/my/items', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  }).then((cart) => normalizeCartResponse(cart)!);
};

export const updateCartItemQuantity = async (
  cartItemId: string,
  quantity: number,
) => {
  const response = await apiFetch<CartResponse | ''>(
    `/api/carts/my/items/${cartItemId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ quantity } as UpdateCartItemQuantityRequest),
    },
  );

  return normalizeCartResponse(response || null);
};

export const removeCartItem = async (cartItemId: string) => {
  const response = await apiFetch<CartResponse | ''>(
    `/api/carts/my/items/${cartItemId}`,
    {
      method: 'DELETE',
    },
  );

  return normalizeCartResponse(response || null);
};

export const clearCart = () =>
  apiFetch<void>('/api/carts/my', {
    method: 'DELETE',
  });

export const checkoutCart = (
  data: import('../types').CheckoutDto,
  idempotencyKey?: string,
) =>
  apiFetch<import('../types').CheckoutResponseDto>('/api/carts/my/checkout', {
    method: 'POST',
    headers: idempotencyKey
      ? { 'X-Idempotency-Key': idempotencyKey }
      : undefined,
    body: JSON.stringify(data),
  });
