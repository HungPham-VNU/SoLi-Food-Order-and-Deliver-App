import { apiFetch } from '@/src/lib/api-client';
import {
  AddItemToCartRequest,
  CartResponse,
  UpdateCartItemQuantityRequest,
} from '../types';

export const getMyCart = () => apiFetch<CartResponse | null>('/api/carts/my');

export const addItemToCart = (data: AddItemToCartRequest) => {
  const { optimisticSelectedModifiers, ...requestBody } = data;

  return apiFetch<CartResponse>('/api/carts/my/items', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
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

  return response || null;
};

export const removeCartItem = async (cartItemId: string) => {
  const response = await apiFetch<CartResponse | ''>(
    `/api/carts/my/items/${cartItemId}`,
    {
      method: 'DELETE',
    },
  );

  return response || null;
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
