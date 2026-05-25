import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import {
  getMyCart,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
} from '../api/cart-api';
import type {
  AddItemToCartRequest,
  CartItemResponse,
  CartResponse,
  SelectedModifierResponse,
} from '../types';

export const cartKeys = {
  all: ['cart'] as const,
  myCart: () => [...cartKeys.all, 'my'] as const,
  mutation: () => [...cartKeys.all, 'mutation'] as const,
};

type CartMutationContext = {
  previousCart: CartResponse | null | undefined;
};

let optimisticIdSequence = 0;

function createOptimisticUuid() {
  optimisticIdSequence += 1;
  const entropy = `${Date.now().toString(16)}${optimisticIdSequence.toString(16)}`;
  const tail = entropy.slice(-12).padStart(12, '0');
  return `00000000-0000-4000-8000-${tail}`;
}

function createTimestamp() {
  return new Date().toISOString();
}

function getModifierFingerprint(
  modifiers: Pick<SelectedModifierResponse, 'groupId' | 'optionId'>[],
) {
  if (modifiers.length === 0) return '';

  return [...modifiers]
    .sort(
      (a, b) =>
        a.groupId.localeCompare(b.groupId) ||
        a.optionId.localeCompare(b.optionId),
    )
    .map((modifier) => `${modifier.groupId}:${modifier.optionId}`)
    .join('|');
}

function getItemSubtotal(item: CartItemResponse) {
  const modifierTotal = item.selectedModifiers.reduce(
    (sum, modifier) => sum + modifier.price,
    0,
  );
  return (item.unitPrice + modifierTotal) * item.quantity;
}

function recalculateCart(
  cart: CartResponse | null,
  updatedAt = createTimestamp(),
) {
  if (!cart || cart.items.length === 0) {
    return null;
  }

  const items = cart.items.map((item) => ({
    ...item,
    subtotal: getItemSubtotal(item),
  }));

  return {
    ...cart,
    items,
    totalAmount: items.reduce((sum, item) => sum + item.subtotal, 0),
    updatedAt,
  };
}

function getOptimisticSelectedModifiers(payload: AddItemToCartRequest) {
  if (payload.optimisticSelectedModifiers) {
    return payload.optimisticSelectedModifiers;
  }

  return (payload.selectedModifiers ?? []).map((modifier) => ({
    groupId: modifier.groupId,
    groupName: '',
    optionId: modifier.optionId,
    optionName: 'Selected option',
    price: 0,
  }));
}

function createOptimisticCart(payload: AddItemToCartRequest) {
  const now = createTimestamp();
  const selectedModifiers = getOptimisticSelectedModifiers(payload);
  const item: CartItemResponse = {
    cartItemId: createOptimisticUuid(),
    menuItemId: payload.menuItemId,
    itemName: payload.itemName,
    unitPrice: payload.unitPrice,
    imageUrl: payload.imageUrl ?? null,
    quantity: payload.quantity,
    subtotal: 0,
    selectedModifiers,
  };

  return recalculateCart(
    {
      cartId: createOptimisticUuid(),
      customerId: 'optimistic-customer',
      restaurantId: payload.restaurantId,
      restaurantName: payload.restaurantName,
      items: [item],
      totalAmount: 0,
      createdAt: now,
      updatedAt: now,
    },
    now,
  );
}

function addItemOptimistically(
  cart: CartResponse | null | undefined,
  payload: AddItemToCartRequest,
) {
  if (!cart || cart.items.length === 0) {
    return createOptimisticCart(payload);
  }

  if (cart.restaurantId !== payload.restaurantId) {
    return cart;
  }

  const now = createTimestamp();
  const selectedModifiers = getOptimisticSelectedModifiers(payload);
  const incomingFingerprint = getModifierFingerprint(selectedModifiers);
  const existingIndex = cart.items.findIndex(
    (item) =>
      item.menuItemId === payload.menuItemId &&
      getModifierFingerprint(item.selectedModifiers) === incomingFingerprint,
  );

  if (existingIndex >= 0) {
    const items = cart.items.map((item, index) =>
      index === existingIndex
        ? { ...item, quantity: Math.min(99, item.quantity + payload.quantity) }
        : item,
    );
    return recalculateCart({ ...cart, items }, now);
  }

  const item: CartItemResponse = {
    cartItemId: createOptimisticUuid(),
    menuItemId: payload.menuItemId,
    itemName: payload.itemName,
    unitPrice: payload.unitPrice,
    imageUrl: payload.imageUrl ?? null,
    quantity: payload.quantity,
    subtotal: 0,
    selectedModifiers,
  };

  return recalculateCart({ ...cart, items: [...cart.items, item] }, now);
}

function updateQuantityOptimistically(
  cart: CartResponse | null | undefined,
  cartItemId: string,
  quantity: number,
) {
  if (!cart) {
    return cart ?? null;
  }

  if (quantity <= 0) {
    return removeItemOptimistically(cart, cartItemId);
  }

  const items = cart.items.map((item) =>
    item.cartItemId === cartItemId ? { ...item, quantity } : item,
  );

  return recalculateCart({ ...cart, items });
}

function removeItemOptimistically(
  cart: CartResponse | null | undefined,
  cartItemId: string,
) {
  if (!cart) {
    return cart ?? null;
  }

  return recalculateCart({
    ...cart,
    items: cart.items.filter((item) => item.cartItemId !== cartItemId),
  });
}

async function snapshotCart(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: cartKeys.all });
  return {
    previousCart: queryClient.getQueryData<CartResponse | null>(
      cartKeys.myCart(),
    ),
  };
}

function rollbackCart(
  queryClient: QueryClient,
  context: CartMutationContext | undefined,
) {
  if (!context) return;
  queryClient.setQueryData<CartResponse | null>(
    cartKeys.myCart(),
    context.previousCart ?? null,
  );
}

function syncCartFromServer(
  queryClient: QueryClient,
  cart: CartResponse | null | undefined,
) {
  if (!isCurrentCartMutationSettling(queryClient) || cart === undefined) return;
  queryClient.setQueryData<CartResponse | null>(cartKeys.myCart(), cart);
}

function invalidateCartWhenSettled(queryClient: QueryClient) {
  if (!isCurrentCartMutationSettling(queryClient)) return;
  return queryClient.invalidateQueries({ queryKey: cartKeys.all });
}

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
 * Optimistically updates the cart cache, then reconciles with the server.
 */
export function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: cartKeys.mutation(),
    mutationFn: addItemToCart,
    onMutate: async (payload) => {
      const context = await snapshotCart(queryClient);
      queryClient.setQueryData<CartResponse | null>(cartKeys.myCart(), (cart) =>
        addItemOptimistically(cart, payload),
      );
      return context;
    },
    onError: (_error, _payload, context) => {
      rollbackCart(queryClient, context);
    },
    onSuccess: (cart) => {
      syncCartFromServer(queryClient, cart);
    },
    onSettled: () => {
      return invalidateCartWhenSettled(queryClient);
    },
  });
}

/**
 * Hook to update the quantity of a specific item in the cart.
 */
export function useUpdateCartItemQuantity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: cartKeys.mutation(),
    mutationFn: ({
      cartItemId,
      quantity,
    }: {
      cartItemId: string;
      quantity: number;
    }) => updateCartItemQuantity(cartItemId, quantity),
    onMutate: async ({ cartItemId, quantity }) => {
      const context = await snapshotCart(queryClient);
      queryClient.setQueryData<CartResponse | null>(cartKeys.myCart(), (cart) =>
        updateQuantityOptimistically(cart, cartItemId, quantity),
      );
      return context;
    },
    onError: (_error, _payload, context) => {
      rollbackCart(queryClient, context);
    },
    onSuccess: (cart) => {
      syncCartFromServer(queryClient, cart);
    },
    onSettled: () => {
      return invalidateCartWhenSettled(queryClient);
    },
  });
}

/**
 * Hook to remove a specific item from the cart.
 */
export function useRemoveCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: cartKeys.mutation(),
    mutationFn: removeCartItem,
    onMutate: async (cartItemId) => {
      const context = await snapshotCart(queryClient);
      queryClient.setQueryData<CartResponse | null>(cartKeys.myCart(), (cart) =>
        removeItemOptimistically(cart, cartItemId),
      );
      return context;
    },
    onError: (_error, _cartItemId, context) => {
      rollbackCart(queryClient, context);
    },
    onSuccess: (cart) => {
      syncCartFromServer(queryClient, cart);
    },
    onSettled: () => {
      return invalidateCartWhenSettled(queryClient);
    },
  });
}

/**
 * Hook to clear the entire cart.
 */
export function useClearCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: cartKeys.mutation(),
    mutationFn: clearCart,
    onMutate: async () => {
      const context = await snapshotCart(queryClient);
      queryClient.setQueryData<CartResponse | null>(cartKeys.myCart(), null);
      return context;
    },
    onError: (_error, _payload, context) => {
      rollbackCart(queryClient, context);
    },
    onSuccess: () => {
      syncCartFromServer(queryClient, null);
    },
    onSettled: () => {
      return invalidateCartWhenSettled(queryClient);
    },
  });
}
