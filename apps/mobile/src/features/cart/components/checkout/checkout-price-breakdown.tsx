import React from 'react';
import { View, Text } from 'react-native';
import { formatCurrency } from '@/src/lib/format-utils';
import type { CheckoutSummary } from '../../types';

interface CheckoutPriceBreakdownProps {
  summary: CheckoutSummary;
  appliedCouponCode?: string | null;
}

export function CheckoutPriceBreakdown({
  summary,
  appliedCouponCode,
}: CheckoutPriceBreakdownProps) {
  return (
    <View className="bg-surface-container-lowest rounded-2xl p-4 gap-3 border border-outline-variant/15">
      <View className="flex-row justify-between items-center">
        <Text
          className="text-on-surface-variant text-sm"
          style={{ fontFamily: 'Inter_400Regular' }}
        >
          Subtotal
        </Text>
        <Text
          className="text-on-surface text-sm"
          style={{ fontFamily: 'Inter_500Medium' }}
        >
          {formatCurrency(summary.subtotal)}
        </Text>
      </View>
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-1.5">
          <Text
            className="text-on-surface-variant text-sm"
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            Delivery Fee
          </Text>
        </View>
        <Text
          className="text-on-surface text-sm"
          style={{ fontFamily: 'Inter_500Medium' }}
        >
          {summary.delivery === 0 ? 'Free' : formatCurrency(summary.delivery)}
        </Text>
      </View>
      {summary.discount > 0 && (
        <View className="flex-row justify-between items-center">
          <Text
            className="text-primary text-sm"
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            {appliedCouponCode
              ? `Promo (${appliedCouponCode})`
              : 'Promo Discount'}
          </Text>
          <Text
            className="text-primary text-sm"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            -{formatCurrency(summary.discount)}
          </Text>
        </View>
      )}
    </View>
  );
}
