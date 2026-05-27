import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Minus, Plus, Trash2, Utensils } from 'lucide-react-native';
import { formatCurrency } from '@/src/lib/format-utils';
import type { CartItem } from '../../types';
import { calculateItemTotal } from '../../utils/price-calculations';

interface CartItemCardProps {
  item: CartItem;
  onPress?: (menuItemId: string) => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
}

export function CartItemCard({
  item,
  onPress,
  onIncrement,
  onDecrement,
  onRemove,
}: CartItemCardProps) {
  return (
    <Pressable
      onPress={onPress ? () => onPress(item.menuItemId) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${item.name}`}
      className="flex-row items-center bg-surface-container-lowest rounded-[20px] p-3 gap-3 shadow-sm active:scale-[0.98]"
    >
      {/* Product image */}
      <View className="w-20 h-20 rounded-2xl overflow-hidden bg-surface-container">
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            className="w-full h-full"
            contentFit="cover"
          />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Utensils size={24} color="#707a6c" />
          </View>
        )}
      </View>

      {/* Info + controls */}
      <View className="flex-1 gap-2">
        {/* Name row */}
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-2">
            <Text
              className="text-on-surface text-sm"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
              numberOfLines={1}
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
                    {mod.price > 0 ? ` (+${formatCurrency(mod.price)})` : ''}
                  </Text>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => onRemove(item.id)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={16} color="#707a6c" />
          </TouchableOpacity>
        </View>

        {/* Price + stepper row */}
        <View className="flex-row justify-between items-center">
          <Text
            className="text-primary text-base"
            style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
          >
            {formatCurrency(calculateItemTotal(item))}
          </Text>

          {/* Quantity stepper */}
          <View className="flex-row items-center gap-2 bg-surface-container rounded-full px-1 py-1">
            <TouchableOpacity
              onPress={() => onDecrement(item.id)}
              activeOpacity={0.7}
              className="w-7 h-7 rounded-full bg-primary-fixed/60 items-center justify-center"
            >
              <Minus size={14} color="#0d631b" />
            </TouchableOpacity>
            <Text
              className="text-on-surface text-sm min-w-[16px] text-center"
              style={{ fontFamily: 'Inter_600SemiBold' }}
            >
              {item.quantity}
            </Text>
            <TouchableOpacity
              onPress={() => onIncrement(item.id)}
              activeOpacity={0.7}
              className="w-7 h-7 rounded-full bg-primary items-center justify-center"
            >
              <Plus size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
