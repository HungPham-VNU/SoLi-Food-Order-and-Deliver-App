import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useMyCart } from '../hooks';
import { OrderReviewItem } from '../components/shared/order-review-item';
import { CheckoutPriceBreakdown } from '../components/checkout/checkout-price-breakdown';
import { formatCurrency } from '@/src/lib/format-utils';
import type { ReviewScreenProps } from '../types';

export function OrderReviewScreen({ onBack, onPlaceOrder }: ReviewScreenProps) {
  const insets = useSafeAreaInsets();
  const { data: cart, isLoading } = useMyCart();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const subtotal = cart?.totalAmount || 0;
  const deliveryFee = 15000; // Mock delivery fee
  const total = subtotal + deliveryFee;

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View 
        style={{ paddingTop: insets.top + 16 }}
        className="px-4 pb-4 flex-row items-center border-b border-outline-variant/10"
      >
        <TouchableOpacity 
          onPress={handleBack}
          className="w-10 h-10 items-center justify-center rounded-full bg-surface-container"
        >
          <ChevronLeft size={24} color="#1a1c1c" />
        </TouchableOpacity>
        <Text 
          className="flex-1 text-center mr-10 text-xl text-on-surface"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
        >
          Review Order
        </Text>
      </View>

      <ScrollView 
        className="flex-1 px-4"
        contentContainerStyle={{ paddingVertical: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Text 
          className="text-lg text-on-surface mb-4"
          style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
        >
          Items
        </Text>
        
        {cart?.items.map((item) => (
          <OrderReviewItem 
            key={item.cartItemId} 
            item={{
              id: item.cartItemId,
              menuItemId: item.menuItemId,
              name: item.itemName,
              price: item.unitPrice,
              quantity: item.quantity,
              imageUrl: item.imageUrl ?? '',
              selectedModifiers: item.selectedModifiers,
            }} 
          />
        ))}

        <View className="mt-6">
          <CheckoutPriceBreakdown 
            summary={{
              subtotal,
              delivery: deliveryFee,
              discount: 0,
              total,
            }}
          />
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View 
        style={{ paddingBottom: Math.max(insets.bottom, 20) }}
        className="px-4 pt-4 border-t border-outline-variant/10 bg-surface"
      >
        <TouchableOpacity
          onPress={onPlaceOrder}
          disabled={isLoading || !cart?.items.length}
          className="bg-primary h-14 rounded-2xl items-center justify-center shadow-md active:scale-[0.98]"
        >
          <Text 
            className="text-on-primary text-lg"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Place Order • {formatCurrency(total)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
