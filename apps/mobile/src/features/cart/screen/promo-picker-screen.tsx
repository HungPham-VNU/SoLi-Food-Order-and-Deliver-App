import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle, XCircle, Tag, Gift } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActivePromotions } from '@/src/features/promotions';
import type { PromotionResponseDto } from '@/src/features/promotions';
import { formatCurrency } from '@/src/lib/format-utils';
import { CheckoutHeader } from '../components';
import { useCheckoutStore } from '../store/checkout-store';

function getDiscountLabel(promo: PromotionResponseDto): string {
  switch (promo.type) {
    case 'percentage':
      return `${promo.discountValue}% off`;
    case 'fixed_amount':
      return `${formatCurrency(promo.discountValue)} off`;
    case 'free_delivery':
      return 'Free delivery';
    case 'reduced_delivery':
      return `Delivery ${formatCurrency(promo.discountValue)} off`;
    default:
      return 'Special offer';
  }
}

function isApplicable(promo: PromotionResponseDto, subtotal: number): boolean {
  if (promo.maxTotalUses != null && promo.currentTotalUses >= promo.maxTotalUses) {
    return false;
  }
  if (promo.minOrderAmount != null && subtotal < promo.minOrderAmount) {
    return false;
  }
  return true;
}

function getUnapplicableReason(promo: PromotionResponseDto, subtotal: number): string {
  if (promo.maxTotalUses != null && promo.currentTotalUses >= promo.maxTotalUses) {
    return 'Limit reached';
  }
  if (promo.minOrderAmount != null && subtotal < promo.minOrderAmount) {
    const needed = promo.minOrderAmount - subtotal;
    return `Add ${formatCurrency(needed)} more to qualify`;
  }
  return 'Not available';
}

export function PromoPickerScreen() {
  const { restaurantId, cartSubtotal } = useLocalSearchParams<{
    restaurantId: string;
    cartSubtotal: string;
  }>();

  const insets = useSafeAreaInsets();
  const subtotal = cartSubtotal ? parseFloat(cartSubtotal) : 0;

  const { data: promotions, isLoading } = useActivePromotions(restaurantId);
  const { selectedPromotion, setSelectedPromotion } = useCheckoutStore();

  const handleSelect = (promo: PromotionResponseDto) => {
    if (!restaurantId) return;
    setSelectedPromotion({
      id: promo.id,
      restaurantId,
      name: promo.name,
      description: promo.description,
    });
    router.back();
  };

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="dark-content" />
      <CheckoutHeader title="Available Deals" onBack={() => router.back()} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 80,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View className="items-center justify-center py-16">
            <ActivityIndicator size="large" color="#0d631b" />
          </View>
        ) : !promotions || promotions.length === 0 ? (
          <View className="items-center justify-center py-16 gap-4">
            <View className="w-16 h-16 rounded-full bg-surface-container-high items-center justify-center">
              <Gift size={32} color="#40493d" />
            </View>
            <Text
              className="text-on-surface-variant text-center"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              No deals available for this restaurant
            </Text>
          </View>
        ) : (
          promotions.map((promo) => {
            const applicable = isApplicable(promo, subtotal);
            const isCouponCode = promo.trigger === 'coupon_code';
            const isSelected = selectedPromotion?.id === promo.id;

            return (
              <TouchableOpacity
                key={promo.id}
                activeOpacity={applicable && !isCouponCode ? 0.75 : 1}
                disabled={!applicable || isCouponCode}
                onPress={() => handleSelect(promo)}
                className={`bg-surface-container-lowest rounded-2xl p-4 border ${
                  isSelected
                    ? 'border-primary'
                    : applicable && !isCouponCode
                    ? 'border-primary/30'
                    : 'border-outline-variant/15'
                } ${!applicable ? 'opacity-50' : ''}`}
              >
                {/* Top row: name + discount badge */}
                <View className="flex-row items-start justify-between gap-3 mb-3">
                  <View className="flex-1 gap-0.5">
                    <Text
                      className="text-on-surface text-sm"
                      style={{ fontFamily: 'Inter_600SemiBold' }}
                    >
                      {promo.name}
                    </Text>
                    {promo.description ? (
                      <Text
                        className="text-on-surface-variant text-xs"
                        style={{ fontFamily: 'Inter_400Regular' }}
                      >
                        {promo.description}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    className={`px-3 py-1.5 rounded-full flex-shrink-0 ${
                      applicable ? 'bg-primary/10' : 'bg-surface-container-high'
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        applicable ? 'text-primary' : 'text-on-surface-variant'
                      }`}
                      style={{ fontFamily: 'Inter_600SemiBold' }}
                    >
                      {getDiscountLabel(promo)}
                    </Text>
                  </View>
                </View>

                {/* Bottom row: min order + status */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <Tag size={12} color={applicable ? '#0d631b' : '#40493d'} />
                    <Text
                      className="text-on-surface-variant text-xs"
                      style={{ fontFamily: 'Inter_400Regular' }}
                    >
                      {promo.minOrderAmount
                        ? `Min. order ${formatCurrency(promo.minOrderAmount)}`
                        : 'No minimum order'}
                    </Text>
                  </View>

                  {!applicable ? (
                    <View className="flex-row items-center gap-1">
                      <XCircle size={12} color="#b3261e" />
                      <Text
                        className="text-error text-xs"
                        style={{ fontFamily: 'Inter_400Regular' }}
                      >
                        {getUnapplicableReason(promo, subtotal)}
                      </Text>
                    </View>
                  ) : isCouponCode ? (
                    <View className="flex-row items-center gap-1">
                      <Tag size={12} color="#40493d" />
                      <Text
                        className="text-on-surface-variant text-xs"
                        style={{ fontFamily: 'Inter_400Regular' }}
                      >
                        Enter code manually
                      </Text>
                    </View>
                  ) : (
                    <View className="flex-row items-center gap-1">
                      <CheckCircle size={12} color="#0d631b" />
                      <Text
                        className="text-primary text-xs"
                        style={{ fontFamily: 'Inter_500Medium' }}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
