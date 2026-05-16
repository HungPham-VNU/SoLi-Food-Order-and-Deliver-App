import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import type { CartItem } from '../types';

interface OrderReviewItemProps {
  item: CartItem;
}

export function OrderReviewItem({ item }: OrderReviewItemProps) {
  return (
    <View className="bg-surface-container-lowest flex-row items-center p-3 rounded-2xl gap-4 mb-3">
      <View className="w-16 h-16 rounded-xl overflow-hidden bg-surface-container">
        <Image
          source={{ uri: item.imageUrl }}
          className="w-full h-full"
          contentFit="cover"
        />
      </View>
      <View className="flex-1">
        <Text
          className="font-bold text-sm text-on-surface"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
        >
          {item.name}
        </Text>
      </View>
      <View className="items-end">
        <Text
          className="font-bold text-sm text-primary"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
        >
          ${item.price.toFixed(2)}
        </Text>
        <Text
          className="text-[10px] text-on-surface-variant font-medium"
          style={{ fontFamily: 'Inter_500Medium' }}
        >
          Qty: {item.quantity}
        </Text>
      </View>
    </View>
  );
}
