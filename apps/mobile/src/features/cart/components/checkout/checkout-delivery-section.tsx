import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronDown, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAddressStore } from '@/src/features/location/store/address-store';

interface CheckoutDeliverySectionProps {
  estimatedMinutes?: number;
}

export function CheckoutDeliverySection({
  estimatedMinutes,
}: CheckoutDeliverySectionProps) {
  const { selectedAddress } = useAddressStore();

  return (
    <View className="bg-surface-container-lowest rounded-2xl p-4 gap-4 overflow-hidden border border-outline-variant/15">
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.navigate('/(customer)/address-selection')}
        className="flex-col items-start gap-0.5"
      >
        <Text
          className="text-[10px] uppercase tracking-widest text-on-surface-variant leading-none"
          style={{ fontFamily: 'Inter_700Bold' }}
        >
          Deliver to
        </Text>
        <View className="flex-row items-center gap-1">
          <Text
            numberOfLines={1}
            className="text-on-surface text-lg leading-tight flex-shrink"
            style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
          >
            {selectedAddress || 'Select address'}
          </Text>
          <ChevronDown size={18} color="#00490e" />
        </View>
      </TouchableOpacity>

      <View className="flex-row items-center self-start gap-1.5 bg-primary-fixed/30 px-3 py-1.5 rounded-full">
        <Clock size={14} color="#005312" />
        <Text
          className="text-on-primary-fixed-variant text-xs"
          style={{ fontFamily: 'Inter_600SemiBold' }}
        >
          {estimatedMinutes
            ? `Arrives in ${estimatedMinutes} mins`
            : 'Estimating time...'}
        </Text>
      </View>
    </View>
  );
}
