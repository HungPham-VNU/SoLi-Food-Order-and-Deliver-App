import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';

interface TrendingProductCardProps {
  imageUrl: string;
  badge?: string;
  category: string;
  name: string;
  description?: string;
  unit: string;
  price: number;
  originalPrice?: number;
  onAdd?: () => void;
  onPress?: () => void;
}

export function TrendingProductCard({
  imageUrl,
  badge,
  category,
  name,
  description,
  unit,
  price,
  originalPrice,
  onAdd,
  onPress,
}: TrendingProductCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.92}
      className="w-[48%] bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm"
    >
      <View className="h-40 bg-surface-container overflow-hidden">
        <Image
          source={{ uri: imageUrl }}
          className="w-full h-full"
          contentFit="cover"
        />
        {badge && (
          <View className="absolute top-3 left-3 bg-secondary px-2 py-0.5 rounded-full">
            <Text className="text-white text-[10px] font-bold">{badge}</Text>
          </View>
        )}
      </View>
      <View className="p-4 flex-col gap-1 flex-1">
        <Text className="text-[10px] text-outline font-bold uppercase">
          {category}
        </Text>
        <Text className="font-jakarta-sans font-bold text-sm text-on-surface">
          {name}
        </Text>
        {description && (
          <Text 
            numberOfLines={2} 
            className="text-[11px] text-on-surface-variant leading-4"
          >
            {description}
          </Text>
        )}
        <Text className="text-[10px] text-outline mt-1">{unit}</Text>
        <View className="mt-auto pt-3 flex-row items-center justify-between">
          <View className="flex-col">
            <Text className="text-secondary font-bold text-base">
              ${price.toFixed(2)}
            </Text>
            {originalPrice && (
              <Text className="text-[10px] text-outline line-through">
                ${originalPrice.toFixed(2)}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={onAdd}
            className="bg-primary w-10 h-10 rounded-2xl items-center justify-center active:scale-90"
          >
            <Plus size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}
