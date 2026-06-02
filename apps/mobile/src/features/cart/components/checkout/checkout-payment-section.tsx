import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { PaymentMethod } from '../../types';

interface CheckoutPaymentSectionProps {
  paymentMethod?: PaymentMethod;
}

export function CheckoutPaymentSection({
  paymentMethod,
}: CheckoutPaymentSectionProps) {
  const brand = paymentMethod?.brand ?? 'Select Method';
  const last4 = paymentMethod?.last4 ?? '';

  const renderBrandIcon = () => {
    if (paymentMethod?.color) {
      return (
        <View
          className="w-full h-full"
          style={{ backgroundColor: paymentMethod.color }}
        />
      );
    }

    const lowerBrand = brand.toLowerCase();
    if (lowerBrand === 'mastercard') {
      return (
        <>
          <View
            className="w-3.5 h-3.5 rounded-full bg-red-500/80"
            style={{ marginRight: -6 }}
          />
          <View className="w-3.5 h-3.5 rounded-full bg-yellow-500/80" />
        </>
      );
    }

    if (lowerBrand === 'visa') {
      return (
        <Text
          className="text-[10px] text-blue-800 italic"
          style={{ fontFamily: 'Inter_700Bold' }}
        >
          VISA
        </Text>
      );
    }

    if (lowerBrand === 'apple pay' || lowerBrand === 'google pay') {
      return (
        <Text
          className="text-[8px] text-on-surface text-center"
          style={{ fontFamily: 'Inter_700Bold' }}
        >
          {brand === 'Apple Pay' ? 'APPLE' : 'GOOGLE'}
        </Text>
      );
    }

    return (
      <View className="w-full h-full bg-primary/20 items-center justify-center">
        <Text
          className="text-[8px] text-primary"
          style={{ fontFamily: 'Inter_700Bold' }}
        >
          {brand.substring(0, 4).toUpperCase()}
        </Text>
      </View>
    );
  };

  return (
    <View className="bg-surface-container-lowest rounded-2xl p-4 gap-4 overflow-hidden border border-outline-variant/15">
      <View className="flex-row justify-between items-center">
        <Text
          className="text-on-surface text-base"
          style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
        >
          Payment Method
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.navigate('/(customer)/payment-methods')}
        >
          <Text
            className="text-primary text-sm"
            style={{ fontFamily: 'Inter_500Medium' }}
          >
            Change
          </Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center gap-3">
        <View className="w-10 h-6 bg-surface-container rounded-sm items-center justify-center border border-outline-variant/30 flex-row overflow-hidden">
          {renderBrandIcon()}
        </View>
        <View>
          <Text
            className="text-sm text-on-surface"
            style={{ fontFamily: 'Inter_500Medium' }}
          >
            {brand}
          </Text>
          {!!last4 && last4 !== brand && (
            <Text
              className="text-xs text-on-surface-variant mt-0.5"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              {last4}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
