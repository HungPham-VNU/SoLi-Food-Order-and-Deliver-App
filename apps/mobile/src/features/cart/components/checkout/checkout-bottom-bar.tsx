import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { formatCurrency } from '@/src/lib/format-utils';

interface CheckoutBottomBarProps {
  total: number;
  onPlaceOrder: () => void;
  paddingBottom?: number;
  isPlacingOrder?: boolean;
}

export function CheckoutBottomBar({
  total,
  onPlaceOrder,
  paddingBottom = 16,
  isPlacingOrder = false,
}: CheckoutBottomBarProps) {
  return (
    <View
      className="absolute bottom-0 left-0 right-0 bg-surface/90 border-t border-surface-container px-4 py-4"
      style={{ paddingBottom }}
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
          {formatCurrency(total)}
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPlaceOrder}
        disabled={isPlacingOrder}
        className={`w-full bg-primary rounded-full py-4 flex-row items-center justify-center gap-2 shadow-lg ${
          isPlacingOrder ? 'opacity-70' : ''
        }`}
      >
        {isPlacingOrder ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <Text
              className="text-on-primary text-base"
              style={{ fontFamily: 'Inter_700Bold' }}
            >
              Place Order
            </Text>
            <ArrowRight size={20} color="#ffffff" />
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}
