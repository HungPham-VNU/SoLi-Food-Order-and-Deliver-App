import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Utensils } from 'lucide-react-native';
import type { CartItem } from '../../types';
import { calculateItemTotal } from '../../utils/price-calculations';

interface OrderReviewItemProps {
  item: CartItem;
}

export function OrderReviewItem({ item }: OrderReviewItemProps) {
  return (
    <View className="bg-surface-container-lowest flex-row items-center p-3 rounded-2xl gap-4 mb-3">
      <View className="w-16 h-16 rounded-xl overflow-hidden bg-surface-container">
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            className="w-full h-full"
            contentFit="cover"
          />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Utensils size={20} color="#707a6c" />
          </View>
        )}
      </View>
      <View className="flex-1">
        <Text
          className="font-bold text-sm text-on-surface"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
        >
          {item.name}
        </Text>
        {item.selectedModifiers && item.selectedModifiers.length > 0 && (
          <View className="mt-1 gap-0.5">
            {item.selectedModifiers.map((mod) => (
              <Text
                key={mod.optionId}
                className="text-on-surface-variant text-[11px]"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                • {mod.optionName}
              </Text>
            ))}
          </View>
        )}
      </View>
      <View className="items-end">
        <Text
          className="font-bold text-sm text-primary"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
        >
          ${calculateItemTotal(item).toFixed(2)}
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
