import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/src/lib/api-client';
import {
  AddItemToCartRequest,
  CartResponse,
  UpdateCartItemQuantityRequest,
} from '../types';

export const cartKeys = {
  all: ['cart'] as const,
  myCart: () => [...cartKeys.all, 'my'] as const,
};

/**
 * Hook to fetch the current customer's active cart.
 * Returns null if the cart is empty or doesn't exist.
 */
export function useMyCart() {
  return useQuery({
    queryKey: cartKeys.myCart(),
    queryFn: () => apiFetch<CartResponse | null>('/api/carts/my'),
  });
}

/**
 * Hook to add an item to the cart.
 * Automatically invalidates the 'cart' query key on success to refresh the UI.
 */
export function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddItemToCartRequest) =>
      apiFetch<CartResponse>('/api/carts/my/items', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}

/**
 * Hook to update the quantity of a specific item in the cart.
 */
export function useUpdateCartItemQuantity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cartItemId,
      quantity,
    }: {
      cartItemId: string;
      quantity: number;
    }) =>
      apiFetch<CartResponse>(`/api/carts/my/items/${cartItemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity } as UpdateCartItemQuantityRequest),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}

/**
 * Hook to remove a specific item from the cart.
 */
export function useRemoveCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cartItemId: string) =>
      apiFetch<void>(`/api/carts/my/items/${cartItemId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}

/**
 * Hook to clear the entire cart.
 */
export function useClearCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<void>('/api/carts/my', {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}
