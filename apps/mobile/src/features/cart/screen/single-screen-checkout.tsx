import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  MapPin,
  Clock,
  FileEdit,
  Tag,
  ArrowRight,
} from 'lucide-react-native';
import { CheckoutHeader } from '../components';
import { formatCurrency } from '@/src/lib/format-utils';
import { useMyCart } from '../api/cart-api';
import type { CartItem } from '../types';

// ─── Pricing Logic ─────────────────────────────────────────────────────────────

const DISCOUNT_THRESHOLD = 500000; // 500k VND
const DISCOUNT_PERCENT = 10; // 10%
const DELIVERY_FEE = 15000; // 15k VND

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

export function SingleScreenCheckout() {
  const insets = useSafeAreaInsets();
  const { data: cart, isLoading, isError } = useMyCart();

  const handleBack = () => {
    router.back();
  };

  const handlePlaceOrder = () => {
    console.log('Order placed successfully!');
    router.dismissAll();
    router.replace('/(customer)/(tabs)');
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#0d631b" />
      </View>
    );
  }

  if (isError || !cart) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        <Text className="text-on-surface text-center mb-4">Failed to load cart</Text>
        <TouchableOpacity onPress={handleBack} className="bg-primary px-6 py-2 rounded-full">
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cartItems: CartItem[] = cart.items.map((item) => ({
    id: item.cartItemId,
    name: item.itemName,
    subtitle: '', // Backend doesn't provide subtitle yet
    price: item.unitPrice,
    quantity: item.quantity,
    imageUrl: '', // Backend doesn't provide imageUrl for cart items yet
    selectedModifiers: item.selectedModifiers,
  }));

  const summary = computeOrderSummary(cart.totalAmount || 0);

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="dark-content" />
      
      <CheckoutHeader title="Checkout" onBack={handleBack} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 80,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: 16,
          gap: 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Delivery */}
        <View className="bg-surface-container-lowest rounded-2xl p-4 gap-4 overflow-hidden border border-outline-variant/15">
          <View className="flex-row justify-between items-start">
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-full bg-surface-container-high items-center justify-center">
                <MapPin size={16} color="#40493d" />
              </View>
              <Text
                className="text-on-surface text-base"
                style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
              >
                Delivery Address
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/(customer)/checkout/shipping-address')}
            >
              <Text
                className="text-primary text-sm"
                style={{ fontFamily: 'Inter_500Medium' }}
              >
                Change
              </Text>
            </TouchableOpacity>
          </View>
          
          <View className="pl-10">
            <Text
              className="text-on-surface text-sm mb-0.5"
              style={{ fontFamily: 'Inter_500Medium' }}
            >
              Alex Rivera
            </Text>
            <Text
              className="text-on-surface-variant text-sm"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              482 Willow Creek Lane{"\n"}
              Apt 4B, Seattle, WA 98101
            </Text>
          </View>
          
          <View className="pl-10 mt-2">
            <View className="flex-row items-center self-start gap-1.5 bg-primary-fixed/30 px-3 py-1.5 rounded-full">
              <Clock size={14} color="#005312" />
              <Text
                className="text-on-primary-fixed-variant text-xs"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                Arrives in 30-45 mins
              </Text>
            </View>
          </View>
        </View>

        {/* Section 2: Order Summary */}
        <View className="gap-4">
          <Text
            className="text-on-surface text-lg px-2"
            style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
          >
            Order Summary
          </Text>
          
          <View className="bg-surface-container-lowest rounded-2xl p-2 border border-outline-variant/15">
            {cartItems.map((item, index) => (
              <View key={item.id}>
                <View className="flex-row gap-4 p-2">
                  <View className="w-16 h-16 rounded-xl bg-surface-container overflow-hidden items-center justify-center">
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} className="w-full h-full" />
                    ) : (
                      <Text className="text-on-surface-variant" style={{ fontFamily: 'Inter_500Medium' }}>No Image</Text>
                    )}
                  </View>
                  <View className="flex-1 justify-center">
                    <Text
                      className="text-sm text-on-surface"
                      style={{ fontFamily: 'Inter_500Medium' }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                      <View className="mt-0.5 gap-0.5">
                        {item.selectedModifiers.map((opt, idx) => (
                          <Text
                            key={`${opt.groupId}-${opt.optionId}-${idx}`}
                            className="text-xs text-on-surface-variant leading-snug"
                            style={{ fontFamily: 'Inter_400Regular' }}
                          >
                            • {opt.groupName}: {opt.optionName}
                          </Text>
                        ))}
                      </View>
                    )}
                    <View className="flex-row items-center gap-3 mt-1.5">
                      <Text
                        className="text-sm text-on-surface"
                        style={{ fontFamily: 'Inter_600SemiBold' }}
                      >
                        {formatCurrency(item.price * item.quantity)}
                      </Text>
                      <Text
                        className="text-xs text-on-surface-variant"
                        style={{ fontFamily: 'Inter_400Regular' }}
                      >
                        Qty: {item.quantity}
                      </Text>
                    </View>
                  </View>
                </View>
                {index < cartItems.length - 1 && (
                  <View className="h-px bg-surface-container mx-4 my-1" />
                )}
              </View>
            ))}
          </View>

          {/* Notes Input */}
          <View className="mt-4 relative justify-center">
            <View className="absolute left-3 z-10 top-3">
              <FileEdit size={20} color="#40493d" />
            </View>
            <TextInput
              className="bg-surface-container-high rounded-xl py-3 pl-10 pr-4 text-sm text-on-surface"
              style={{ fontFamily: 'Inter_400Regular' }}
              placeholderTextColor="#40493d"
              placeholder="Notes for Restaurant (Optional)"
            />
          </View>
        </View>

        {/* Section 3: Promotions */}
        <View className="bg-surface-container-lowest rounded-2xl p-1.5 border border-outline-variant/15 flex-row items-center gap-2">
          <View className="flex-1 relative justify-center">
            <View className="absolute left-3 z-10">
              <Tag size={18} color="#40493d" />
            </View>
            <TextInput
              className="bg-surface-container-high rounded-xl py-2.5 pl-10 pr-3 text-sm text-on-surface"
              style={{ fontFamily: 'Inter_400Regular' }}
              placeholderTextColor="#40493d"
              placeholder="Promo code"
              autoCapitalize="characters"
            />
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            className="bg-surface-container-high px-4 py-2.5 rounded-xl"
          >
            <Text
              className="text-on-surface text-sm"
              style={{ fontFamily: 'Inter_500Medium' }}
            >
              Apply
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section 4: Payment */}
        <View className="bg-surface-container-lowest rounded-2xl p-4 gap-4 overflow-hidden border border-outline-variant/15">
          <View className="flex-row justify-between items-center">
            <Text
              className="text-on-surface text-base"
              style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
            >
              Payment Method
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/(customer)/checkout/payment')}
            >
              <Text
                className="text-primary text-sm"
                style={{ fontFamily: 'Inter_500Medium' }}
              >
                Change
              </Text>
            </TouchableOpacity>
          </View>
          
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-6 bg-surface-container rounded-sm items-center justify-center border border-outline-variant/30 flex-row overflow-hidden">
              <View className="w-3.5 h-3.5 rounded-full bg-red-500/80" style={{ marginRight: -6 }} />
              <View className="w-3.5 h-3.5 rounded-full bg-yellow-500/80" />
            </View>
            <View>
              <Text
                className="text-sm text-on-surface"
                style={{ fontFamily: 'Inter_500Medium' }}
              >
                Mastercard
              </Text>
              <Text
                className="text-xs text-on-surface-variant mt-0.5"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                **** 8829
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-surface/90 border-t border-surface-container px-4 py-4"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <View className="flex-row justify-between items-center mb-4 px-2">
          <Text
            className="text-on-surface"
            style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
          >
            Total
          </Text>
          <Text
            className="text-xl text-secondary"
            style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
          >
            {formatCurrency(summary.total)}
          </Text>
        </View>
        
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePlaceOrder}
          className="w-full bg-primary rounded-full py-4 flex-row items-center justify-center gap-2 shadow-lg"
        >
          <Text
            className="text-on-primary text-base"
            style={{ fontFamily: 'Inter_700Bold' }}
          >
            Place Order
          </Text>
          <ArrowRight size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
