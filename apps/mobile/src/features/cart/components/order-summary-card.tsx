import React from 'react';
import { View, Text } from 'react-native';
import { Tag } from 'lucide-react-native';
import { formatCurrency } from '@/src/lib/format-utils';
import type { OrderSummary } from '../types';

interface OrderSummaryCardProps {
  summary: OrderSummary;
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View className="flex-row justify-between items-center">
      <Text
        className={
          highlight ? 'text-primary text-sm' : 'text-on-surface-variant text-sm'
        }
        style={{ fontFamily: 'Inter_400Regular' }}
      >
        {label}
      </Text>
      <Text
        className={
          highlight ? 'text-primary text-sm' : 'text-on-surface text-sm'
        }
        style={{ fontFamily: 'Inter_600SemiBold' }}
      >
        {value}
      </Text>
    </View>
  );
}

export function OrderSummaryCard({ summary }: OrderSummaryCardProps) {
  const hasDiscount = summary.discount > 0;

  return (
    <View className="bg-surface-container-lowest rounded-[20px] p-5 gap-3 shadow-sm">
      <Text
        className="text-on-surface text-base"
        style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
      >
        Order Summary
      </Text>

      {/* Discount nudge banner */}
      {summary.remainingForDiscount != null &&
        summary.remainingForDiscount > 0 && (
          <View className="flex-row items-center gap-2 bg-secondary-fixed/30 rounded-xl px-3 py-2 border border-secondary/20">
            <Tag size={14} color="#8b5000" />
            <Text
              className="text-secondary text-xs flex-1"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              Add{' '}
              <Text style={{ fontFamily: 'Inter_600SemiBold' }}>
                {formatCurrency(summary.remainingForDiscount)}
              </Text>{' '}
              more for a{' '}
              <Text style={{ fontFamily: 'Inter_600SemiBold' }}>
                {summary.discountPercent}% discount!
              </Text>
            </Text>
          </View>
        )}

      <View className="h-px bg-surface-container" />

      <SummaryRow label="Subtotal" value={formatCurrency(summary.subtotal)} />
      {hasDiscount && (
        <SummaryRow
          label="Discount"
          value={`-${formatCurrency(summary.discount)}`}
          highlight
        />
      )}
      <SummaryRow
        label="Delivery"
        value={
          summary.delivery === 0 ? 'Free' : formatCurrency(summary.delivery)
        }
      />
      {summary.estimatedMinutes != null && (
        <View className="flex-row items-center gap-1.5 -mt-1">
          <Text
            className="text-on-surface-variant text-[11px]"
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            Estimated arrival in{' '}
            <Text className="text-secondary" style={{ fontFamily: 'Inter_600SemiBold' }}>
              {summary.estimatedMinutes} mins
            </Text>
          </Text>
        </View>
      )}

      <View className="h-px bg-surface-container" />

      {/* Total row */}
      <View className="flex-row justify-between items-center mt-1">
        <Text
          className="text-on-surface text-base"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
        >
          Total
        </Text>
        <Text
          className="text-primary text-xl"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
        >
          {formatCurrency(summary.total)}
        </Text>
      </View>
    </View>
  );
}
