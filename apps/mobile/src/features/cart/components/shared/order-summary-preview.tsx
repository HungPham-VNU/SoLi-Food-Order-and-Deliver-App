import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';

interface OrderSummaryPreviewProps {
  previewImages: string[];
  remainingCount?: number;
  deliveryTimeLabel?: string;
  deliveryTimeValue?: string;
}

export function OrderSummaryPreview({
  previewImages,
  remainingCount,
  deliveryTimeLabel = 'EST. DELIVERY',
  deliveryTimeValue = 'Today, 4pm - 6pm',
}: OrderSummaryPreviewProps) {
  return (
    <View className="mt-6 rounded-[24px] bg-surface-container-low/70 p-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          {previewImages.map((uri, index) => (
            <View
              key={`${uri}-${index}`}
              className="w-10 h-10 rounded-full border-4 border-surface-container-low overflow-hidden"
              style={{ marginLeft: index === 0 ? 0 : -12 }}
            >
              <Image
                source={{ uri }}
                className="w-full h-full"
                contentFit="cover"
              />
            </View>
          ))}
          {!!remainingCount && remainingCount > 0 && (
            <View
              className="w-10 h-10 rounded-full border-4 border-surface-container-low bg-primary-fixed-dim items-center justify-center"
              style={{ marginLeft: -12 }}
            >
              <Text
                className="text-[10px]"
                style={{ fontFamily: 'Inter_700Bold', color: '#002204' }}
              >
                +{remainingCount}
              </Text>
            </View>
          )}
        </View>
        <View className="items-end">
          <Text
            className="text-on-surface-variant text-[10px] tracking-widest uppercase"
            style={{ fontFamily: 'Inter_700Bold' }}
          >
            {deliveryTimeLabel}
          </Text>
          <Text
            className="text-primary text-sm"
            style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
          >
            {deliveryTimeValue}
          </Text>
        </View>
      </View>
    </View>
  );
}
