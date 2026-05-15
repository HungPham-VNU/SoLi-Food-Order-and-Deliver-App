import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShoppingBasket } from 'lucide-react-native';

import { NutritionCell } from '../nutrition-cell';
import { QuantitySelector } from '../quantity-selector';
import type { Product } from '@/src/features/restaurants/types';

interface ProductInfoCardProps {
  product: Product;
  quantity: number;
  onDecrement: () => void;
  onIncrement: () => void;
  onAddToCart?: () => void;
}

export function ProductInfoCard({
  product,
  quantity,
  onDecrement,
  onIncrement,
  onAddToCart,
}: ProductInfoCardProps) {
  return (
    <View
      className="mx-6 -mt-8 bg-surface-container-lowest rounded-3xl p-6 z-10"
      style={{
        shadowColor: '#1a1c1c',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 30,
        elevation: 4,
      }}
    >
      <View className="flex-row items-start justify-between mb-4">
        <View className="flex-1 mr-4">
          <Text
            className="text-on-surface text-3xl tracking-tight"
            style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}
          >
            {product.name}
          </Text>
          <Text
            className="text-primary text-sm mt-1"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            {product.subtitle}
          </Text>
        </View>
        <View className="items-end">
          <Text
            className="text-secondary text-2xl"
            style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}
          >
            ${product.price.toFixed(2)}
          </Text>
          <Text
            className="text-outline text-xs mt-0.5"
            style={{ fontFamily: 'Inter_500Medium' }}
          >
            {product.priceUnit}
          </Text>
        </View>
      </View>

      <Text
        className="text-on-surface-variant leading-relaxed mb-8"
        style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 14,
          lineHeight: 22,
        }}
      >
        {product.description}
      </Text>

      <View className="flex-row gap-x-3 mb-8">
        <NutritionCell label="Calories" value={product.nutrition.calories} />
        <NutritionCell label="Fat" value={product.nutrition.fat} />
        <NutritionCell label="Carbs" value={product.nutrition.carbs} />
        <NutritionCell label="Protein" value={product.nutrition.protein} />
      </View>

      <View className="flex-row items-center gap-x-4">
        <QuantitySelector
          quantity={quantity}
          onDecrement={onDecrement}
          onIncrement={onIncrement}
        />

        <TouchableOpacity
          onPress={onAddToCart}
          className="flex-1 rounded-full overflow-hidden"
          style={{
            shadowColor: '#0d631b',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <LinearGradient
            colors={['#0d631b', '#2e7d32']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 56,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingHorizontal: 20,
            }}
          >
            <ShoppingBasket size={20} color="#ffffff" />
            <Text
              className="text-white text-base"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
            >
              Add to Cart
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
