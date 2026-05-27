import React, { useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import {
  CartHeader,
  CartItemCard,
  OrderSummaryCard,
  EmptyCart,
} from '../components';
import type { CartItem, CartScreenProps } from '../types';
import { formatCurrency } from '@/src/lib/format-utils';
import {
  useMyCart,
  useUpdateCartItemQuantity,
  useRemoveCartItem,
} from '../hooks';
import { useAddressStore } from '@/src/features/location/store/address-store';
import { useDeliveryEstimate } from '@/src/features/restaurants/api/restaurant-api';

// ─── Pricing Logic ─────────────────────────────────────────────────────────────

const DISCOUNT_THRESHOLD = 500000; // 500k VND
const DISCOUNT_PERCENT = 10; // 10%
const DEFAULT_DELIVERY_FEE = 15000; // 15k VND

function computeOrderSummary(
  subtotal: number,
  deliveryFee: number = DEFAULT_DELIVERY_FEE,
  estimatedMinutes?: number,
) {
  const remaining = Math.max(0, DISCOUNT_THRESHOLD - subtotal);
  const discount =
    subtotal >= DISCOUNT_THRESHOLD ? subtotal * (DISCOUNT_PERCENT / 100) : 0;
  const total = subtotal - discount + deliveryFee;
  return {
    subtotal,
    discount,
    delivery: deliveryFee,
    total,
    discountThreshold: DISCOUNT_THRESHOLD,
    discountPercent: DISCOUNT_PERCENT,
    remainingForDiscount: remaining,
    estimatedMinutes,
  };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function CartScreen({
  onBack,
  onCheckout,
  onContinueShopping,
}: CartScreenProps) {
  const insets = useSafeAreaInsets();
  const { latitude, longitude } = useAddressStore();

  const { data: cart, isLoading, isError } = useMyCart();
  const { mutate: updateQuantity, isPending: isUpdating } =
    useUpdateCartItemQuantity();
  const { mutate: removeItem, isPending: isRemoving } = useRemoveCartItem();

  const { data: estimate } = useDeliveryEstimate(
    cart?.restaurantId,
    latitude,
    longitude,
  );

  const isMutating = isUpdating || isRemoving;

  const cartItems: CartItem[] = (cart?.items || []).map((item) => ({
    id: item.cartItemId,
    menuItemId: item.menuItemId,
    name: item.itemName,
    price: item.unitPrice,
    quantity: item.quantity,
    imageUrl: item.imageUrl ?? '',
    selectedModifiers: item.selectedModifiers,
  }));

  const deliveryFee = estimate?.deliveryFee ?? DEFAULT_DELIVERY_FEE;
  const summary = computeOrderSummary(
    cart?.totalAmount || 0,
    deliveryFee,
    estimate?.estimatedMinutes,
  );
  const headerHeight = insets.top + 64;
  const checkoutBarHeight = 80 + insets.bottom;

  const handleIncrement = useCallback(
    (id: string) => {
      if (isMutating) return;
      const item = cart?.items.find((i) => i.cartItemId === id);
      if (item) {
        updateQuantity(
          { cartItemId: id, quantity: item.quantity + 1 },
          {
            onError: (error: any) => {
              Alert.alert(
                'Error',
                error.message || 'Failed to update quantity',
              );
            },
          },
        );
      }
    },
    [cart, updateQuantity, isMutating],
  );

  const handleDecrement = useCallback(
    (id: string) => {
      if (isMutating) return;
      const item = cart?.items.find((i) => i.cartItemId === id);
      if (item && item.quantity > 1) {
        updateQuantity(
          { cartItemId: id, quantity: item.quantity - 1 },
          {
            onError: (error: any) => {
              Alert.alert(
                'Error',
                error.message || 'Failed to update quantity',
              );
            },
          },
        );
      } else if (item && item.quantity === 1) {
        removeItem(id, {
          onError: (error: any) => {
            Alert.alert('Error', error.message || 'Failed to remove item');
          },
        });
      }
    },
    [cart, updateQuantity, removeItem, isMutating],
  );

  const handleRemove = useCallback(
    (id: string) => {
      if (isMutating) return;
      removeItem(id, {
        onError: (error: any) => {
          Alert.alert('Error', error.message || 'Failed to remove item');
        },
      });
    },
    [removeItem, isMutating],
  );

  const handleItemPress = useCallback((menuItemId: string) => {
    router.push({
      pathname: '/restaurant/menu-item/[id]',
      params: { id: menuItemId },
    });
  }, []);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handleContinueShopping = () => {
    if (onContinueShopping) {
      onContinueShopping();
    } else {
      router.push('/(customer)/(tabs)');
    }
  };

  const handleCheckout = () => {
    if (onCheckout) {
      onCheckout();
    } else {
      router.push('/(customer)/checkout');
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#0d631b" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        <Text className="text-on-surface text-center mb-4">
          Failed to load cart
        </Text>
        <TouchableOpacity
          onPress={handleBack}
          className="bg-primary px-6 py-2 rounded-full"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      {/* ── Floating Header ──────────────────────────────────────────────────── */}
      <CartHeader
        insetsTop={insets.top}
        onBack={handleBack}
        restaurantName={cart?.restaurantName}
        distanceKm={estimate?.distanceKm}
        estimatedMinutes={estimate?.estimatedMinutes}
      />

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      {!cart || cart.items.length === 0 ? (
        <EmptyCart onContinueShopping={handleContinueShopping} />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingTop: headerHeight + 16,
            paddingBottom: checkoutBarHeight + 24,
            paddingHorizontal: 16,
            gap: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Section label */}
          <Text
            className="text-on-surface text-[18px] mb-1"
            style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
          >
            {cart.items.length} {cart.items.length === 1 ? 'Item' : 'Items'}
          </Text>

          {/* Cart items */}
          <View className="gap-3">
            {cartItems.map((item) => (
              <CartItemCard
                key={item.id}
                item={item}
                onPress={handleItemPress}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
                onRemove={handleRemove}
              />
            ))}
          </View>

          {/* Order summary */}
          <OrderSummaryCard summary={summary} />
        </ScrollView>
      )}

      {/* ── Sticky Checkout Bar ───────────────────────────────────────────────── */}
      {cart && cart.items.length > 0 && (
        <View
          className="absolute bottom-0 left-0 right-0 px-4 pt-3 bg-surface/90"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <TouchableOpacity
            onPress={handleCheckout}
            activeOpacity={0.85}
            className="flex-row items-center justify-between bg-primary rounded-full pl-7 pr-2 py-2 shadow-lg active:scale-95"
          >
            <Text
              className="text-on-primary text-base"
              style={{ fontFamily: 'Inter_600SemiBold' }}
            >
              Proceed to Checkout
            </Text>
            <View className="bg-surface-container-lowest rounded-full px-4 py-2.5">
              <Text
                className="text-primary text-[15px]"
                style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
              >
                {formatCurrency(summary.total)}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
