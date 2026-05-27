import type { CartResponse } from '../types';

const CART_CONFLICT_MESSAGE_PATTERN =
  /Cart already contains items from restaurant/i;
const STATUS_PATTERN = /Status:\s*(\d+)/i;

function toErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export function getUserFacingErrorMessage(error: unknown): string {
  return toErrorText(error).split('\n')[0] || 'An unexpected error occurred.';
}

export function hasActiveCart(
  cart: CartResponse | null | undefined,
): cart is CartResponse {
  return !!cart && cart.items.length > 0;
}

export function cartHasDifferentRestaurant(
  cart: CartResponse | null | undefined,
  restaurantId: string,
): cart is CartResponse {
  return hasActiveCart(cart) && cart.restaurantId !== restaurantId;
}

export function getDifferentRestaurantCartMessage(
  cart: CartResponse | null | undefined,
  nextRestaurantName: string,
): string {
  const currentRestaurantName =
    hasActiveCart(cart) && cart.restaurantName.trim()
      ? cart.restaurantName.trim()
      : 'another restaurant';
  const targetRestaurantName = nextRestaurantName.trim() || 'this restaurant';

  return (
    `Your cart already has items from ${currentRestaurantName}. ` +
    `Clear the current cart before adding items from ${targetRestaurantName}.`
  );
}

export function isCartRestaurantConflictError(error: unknown): boolean {
  const message = toErrorText(error);
  const statusMatch = message.match(STATUS_PATTERN);
  return (
    statusMatch?.[1] === '409' &&
    CART_CONFLICT_MESSAGE_PATTERN.test(message)
  );
}
