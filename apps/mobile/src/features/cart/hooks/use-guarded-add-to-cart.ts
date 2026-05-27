import { useCallback } from 'react';
import { Alert } from 'react-native';

import type { AddItemToCartRequest, CartResponse } from '../types';
import {
  cartHasDifferentRestaurant,
  getDifferentRestaurantCartMessage,
  getUserFacingErrorMessage,
  isCartRestaurantConflictError,
} from '../utils/restaurant-cart-guard';
import { useAddToCart, useClearCart, useMyCart } from './use-cart';

type GuardedAddToCartOptions = {
  successMessage?: string;
  onOptimisticUpdate?: () => void;
  onSuccess?: (cart: CartResponse) => void;
  onError?: (error: unknown) => void;
};

export function useGuardedAddToCart() {
  const { data: cart, isLoading: isCartLoading } = useMyCart();
  const { mutate: addToCart, isPending: isAddingToCart } = useAddToCart();
  const { mutate: clearCart, isPending: isClearingCart } = useClearCart();

  const runAddToCart = useCallback(
    (payload: AddItemToCartRequest, options?: GuardedAddToCartOptions) => {
      addToCart(payload, {
        onSuccess: (updatedCart) => {
          Alert.alert(
            'Success',
            options?.successMessage ?? `${payload.itemName} added to cart`,
          );
          options?.onSuccess?.(updatedCart);
        },
        onError: (error) => {
          if (isCartRestaurantConflictError(error)) {
            Alert.alert(
              'Cannot mix restaurants',
              getDifferentRestaurantCartMessage(cart, payload.restaurantName),
            );
          } else {
            Alert.alert('Error', getUserFacingErrorMessage(error));
          }
          options?.onError?.(error);
        },
      });
      options?.onOptimisticUpdate?.();
    },
    [addToCart, cart],
  );

  const addItem = useCallback(
    (payload: AddItemToCartRequest, options?: GuardedAddToCartOptions) => {
      if (isCartLoading || isAddingToCart || isClearingCart) {
        Alert.alert('Please wait', 'A cart operation is already in progress');
        return;
      }

      if (cartHasDifferentRestaurant(cart, payload.restaurantId)) {
        Alert.alert(
          'Start a new cart?',
          getDifferentRestaurantCartMessage(cart, payload.restaurantName),
          [
            { text: 'Keep Cart', style: 'cancel' },
            {
              text: 'Clear and Add',
              style: 'destructive',
              onPress: () => {
                clearCart(undefined, {
                  onSuccess: () => runAddToCart(payload, options),
                  onError: (error) => {
                    Alert.alert('Error', getUserFacingErrorMessage(error));
                    options?.onError?.(error);
                  },
                });
              },
            },
          ],
        );
        return;
      }

      runAddToCart(payload, options);
    },
    [
      cart,
      clearCart,
      isAddingToCart,
      isCartLoading,
      isClearingCart,
      runAddToCart,
    ],
  );

  return {
    addItem,
    cart,
    isAddingToCart,
    isClearingCart,
    isPending: isCartLoading || isAddingToCart || isClearingCart,
  };
}
