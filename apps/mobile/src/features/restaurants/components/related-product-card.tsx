import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Plus } from 'lucide-react-native';
import type { RelatedProduct } from '@/src/features/restaurants/types';

interface RelatedProductCardProps {
  product: RelatedProduct;
  onAdd?: (productId: string) => void;
}

export function RelatedProductCard({
  product,
  onAdd,
}: RelatedProductCardProps) {
  return (
    <View
      className="w-40 bg-surface-container-lowest rounded-3xl p-3 flex-col"
      style={{
        shadowColor: '#1a1c1c',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {/* Image */}
      <View className="h-32 bg-surface-container rounded-2xl mb-3 overflow-hidden">
        <Image
          source={{ uri: product.imageUrl }}
          className="w-full h-full"
          resizeMode="cover"
        />
      </View>

      {/* Name */}
      <Text
        className="text-on-surface text-sm"
        style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
        numberOfLines={1}
      >
        {product.name}
      </Text>

      {/* Description */}
      {product.description && (
        <Text
          className="text-on-surface-variant text-[10px] mt-1"
          style={{ fontFamily: 'Inter_400Regular' }}
          numberOfLines={2}
        >
          {product.description}
        </Text>
      )}

      {/* Price + Add */}
      <View className="flex-row items-center justify-between mt-2">
        <Text
          className="text-secondary text-sm"
          style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}
        >
          ${product.price.toFixed(2)}
        </Text>
        <TouchableOpacity
          onPress={() => onAdd?.(product.id)}
          activeOpacity={0.75}
          className="w-8 h-8 bg-surface-container-high rounded-full items-center justify-center"
        >
          <Plus size={16} color="#0d631b" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
