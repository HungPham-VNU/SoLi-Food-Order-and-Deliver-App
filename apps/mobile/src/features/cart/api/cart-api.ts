import { apiFetch } from '@/src/lib/api-client';
import {
  AddItemToCartRequest,
  CartResponse,
  UpdateCartItemQuantityRequest,
} from '../types';

export const getMyCart = () => apiFetch<CartResponse | null>('/api/carts/my');

export const addItemToCart = (data: AddItemToCartRequest) =>
  apiFetch<CartResponse>('/api/carts/my/items', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateCartItemQuantity = (cartItemId: string, quantity: number) =>
  apiFetch<CartResponse>(`/api/carts/my/items/${cartItemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity } as UpdateCartItemQuantityRequest),
  });

export const removeCartItem = (cartItemId: string) =>
  apiFetch<void>(`/api/carts/my/items/${cartItemId}`, {
    method: 'DELETE',
  });

export const clearCart = () =>
  apiFetch<void>('/api/carts/my', {
    method: 'DELETE',
  });

export const checkoutCart = (data: import('../types').CheckoutDto, idempotencyKey?: string) =>
  apiFetch<import('../types').CheckoutResponseDto>('/api/carts/my/checkout', {
    method: 'POST',
    headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
    body: JSON.stringify(data),
  });
