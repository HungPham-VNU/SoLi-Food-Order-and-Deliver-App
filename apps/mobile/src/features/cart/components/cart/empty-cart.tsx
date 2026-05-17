import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ShoppingCart, ArrowRight } from 'lucide-react-native';

interface EmptyCartProps {
  onContinueShopping?: () => void;
}

export function EmptyCart({ onContinueShopping }: EmptyCartProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 gap-4">
      <View className="w-24 h-24 rounded-full bg-primary-fixed items-center justify-center mb-2">
        <ShoppingCart size={48} color="#0d631b" strokeWidth={1.5} />
      </View>

      <Text
        className="text-on-surface text-[22px] text-center"
        style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
      >
        Your cart is empty
      </Text>

      <Text
        className="text-on-surface-variant text-sm text-center leading-relaxed"
        style={{ fontFamily: 'Inter_400Regular' }}
      >
        Looks like you haven&apos;t added any items yet. Head back to explore fresh
        produce and more!
      </Text>

      {onContinueShopping && (
        <TouchableOpacity
          onPress={onContinueShopping}
          activeOpacity={0.85}
          className="flex-row items-center gap-2 bg-primary rounded-full px-7 py-4 mt-2 shadow-md active:scale-95"
        >
          <Text
            className="text-on-primary text-[15px]"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Start Shopping
          </Text>
          <ArrowRight size={16} color="#ffffff" />
        </TouchableOpacity>
      )}
    </View>
  );
}
