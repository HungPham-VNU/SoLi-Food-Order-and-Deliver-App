import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyCart,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
} from '../api/cart-api';

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
    queryFn: getMyCart,
  });
}

/**
 * Hook to add an item to the cart.
 * Automatically invalidates the 'cart' query key on success to refresh the UI.
 */
export function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addItemToCart,
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
    }) => updateCartItemQuantity(cartItemId, quantity),
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
    mutationFn: removeCartItem,
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
    mutationFn: clearCart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}
