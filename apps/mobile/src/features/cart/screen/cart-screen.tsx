import React, { useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { CartHeader } from '@/src/features/cart/components/cart-header';
import { CartItemCard } from '@/src/features/cart/components/cart-item-card';
import { OrderSummaryCard } from '@/src/features/cart/components/order-summary-card';
import { EmptyCart } from '@/src/features/cart/components/empty-cart';
import type { CartItem, CartScreenProps } from '@/src/features/cart/types';
import { useMyCart, useUpdateCartItemQuantity, useRemoveCartItem } from '../api/cart-api';

// ─── Pricing Logic ─────────────────────────────────────────────────────────────

const DISCOUNT_THRESHOLD = 30;
const DISCOUNT_PERCENT = 15;
const DELIVERY_FEE = 0;

function computeOrderSummary(subtotal: number) {
  const remaining = Math.max(0, DISCOUNT_THRESHOLD - subtotal);
  const discount =
    subtotal >= DISCOUNT_THRESHOLD ? subtotal * (DISCOUNT_PERCENT / 100) : 0;
  const total = subtotal - discount + DELIVERY_FEE;
  return {
    subtotal,
    discount,
    delivery: DELIVERY_FEE,
    total,
    discountThreshold: DISCOUNT_THRESHOLD,
    discountPercent: DISCOUNT_PERCENT,
    remainingForDiscount: remaining,
  };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function CartScreen({
  onBack,
  onCheckout,
  onContinueShopping,
}: CartScreenProps) {
  const insets = useSafeAreaInsets();
  
  const { data: cart, isLoading, isError } = useMyCart();
  const { mutate: updateQuantity } = useUpdateCartItemQuantity();
  const { mutate: removeItem } = useRemoveCartItem();

  const cartItems: CartItem[] = (cart?.items || []).map((item) => ({
    id: item.cartItemId,
    name: item.itemName,
    subtitle: '', // Backend doesn't provide subtitle yet
    price: item.unitPrice,
    quantity: item.quantity,
    imageUrl: '', // Backend doesn't provide imageUrl for cart items yet
  }));

  const summary = computeOrderSummary(cart?.totalAmount || 0);
  const headerHeight = insets.top + 64;
  const checkoutBarHeight = 80 + insets.bottom;

  const handleIncrement = useCallback((id: string) => {
    const item = cart?.items.find(i => i.cartItemId === id);
    if (item) {
      updateQuantity({ cartItemId: id, quantity: item.quantity + 1 });
    }
  }, [cart, updateQuantity]);

  const handleDecrement = useCallback((id: string) => {
    const item = cart?.items.find(i => i.cartItemId === id);
    if (item && item.quantity > 1) {
      updateQuantity({ cartItemId: id, quantity: item.quantity - 1 });
    } else if (item && item.quantity === 1) {
      removeItem(id);
    }
  }, [cart, updateQuantity, removeItem]);

  const handleRemove = useCallback((id: string) => {
    removeItem(id);
  }, [removeItem]);

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
      router.push('/(customer)/checkout/shipping-address');
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
        <Text className="text-on-surface text-center mb-4">Failed to load cart</Text>
        <TouchableOpacity onPress={handleBack} className="bg-primary px-6 py-2 rounded-full">
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
      <CartHeader insetsTop={insets.top} onBack={handleBack} />

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
                ${summary.total.toFixed(2)}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
