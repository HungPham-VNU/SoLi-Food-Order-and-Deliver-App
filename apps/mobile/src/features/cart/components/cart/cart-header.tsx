import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

interface CartHeaderProps {
  insetsTop: number;
  onBack?: () => void;
  restaurantName?: string | null;
  distanceKm?: number;
  estimatedMinutes?: number;
}

function formatDistance(distanceKm?: number) {
  if (distanceKm == null) return undefined;

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }

  return `${distanceKm.toFixed(1)} km away`;
}

function formatRestaurantMeta(distanceKm?: number, estimatedMinutes?: number) {
  const distanceLabel = formatDistance(distanceKm);
  const estimateLabel =
    estimatedMinutes != null ? `${estimatedMinutes} min delivery` : undefined;

  return [distanceLabel, estimateLabel].filter(Boolean).join(' / ');
}

export function CartHeader({
  insetsTop,
  onBack,
  restaurantName,
  distanceKm,
  estimatedMinutes,
}: CartHeaderProps) {
  const title = restaurantName || 'Your Cart';
  const subtitle = restaurantName
    ? formatRestaurantMeta(distanceKm, estimatedMinutes)
    : undefined;

  return (
    <View
      className="absolute top-0 left-0 right-0 z-50 bg-surface/90"
      style={{ paddingTop: insetsTop + 8 }}
    >
      <View className="flex-row items-center justify-between px-4 pb-3 gap-3">
        <View className="flex-row items-center gap-3 flex-1">
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.7}
            className="w-10 h-10 rounded-full bg-surface-container items-center justify-center"
          >
            <ArrowLeft size={20} color="#00490e" />
          </TouchableOpacity>

          <View className="flex-1">
            <Text
              className="text-primary text-[17px]"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                className="text-on-surface-variant text-xs"
                style={{ fontFamily: 'Inter_500Medium' }}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <View className="h-px bg-surface-container-highest/70" />
    </View>
  );
}
