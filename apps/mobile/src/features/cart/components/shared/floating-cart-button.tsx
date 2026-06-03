import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ShoppingCart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMyCart } from '../../hooks';

export function FloatingCartButton() {
  const { data: cart } = useMyCart();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!cart?.items || cart.items.length === 0) {
    return null;
  }

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View
      className="absolute right-6 z-50"
      style={{ bottom: insets.bottom + 16 }}
    >
      <TouchableOpacity
        className="bg-primary-container w-14 h-14 rounded-2xl items-center justify-center shadow-lg shadow-black/30 elevation-8"
        activeOpacity={0.8}
        onPress={() => router.navigate('/(customer)/cart')}
        accessibilityRole="button"
        accessible={true}
        accessibilityLabel={`Cart, ${itemCount} items`}
        accessibilityHint="Opens your shopping cart"
        accessibilityState={{ busy: false }}
        testID="floating-cart-button"
      >
        <View className="relative">
          <ShoppingCart size={28} color="#ffffff" />
          <View className="absolute -top-2 -right-2 bg-error rounded-full min-w-[20px] h-5 justify-center items-center px-1 border-2 border-primary-container">
            <Text className="text-white text-[10px] font-bold font-jakarta-sans">
              {itemCount}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}
