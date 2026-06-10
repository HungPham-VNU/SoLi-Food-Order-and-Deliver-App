import React from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Clock, Heart, Star, Truck, Utensils } from 'lucide-react-native';
import type { RestaurantSearchResult } from '../../types';
import {
  type DeliveryEstimateQueryState,
  getDeliveryEstimateLabels,
  getRestaurantImageUrl,
  getRestaurantRating,
} from './restaurant-card-utils';

interface FeaturedRestaurantsSectionProps {
  restaurants: RestaurantSearchResult[];
  deliveryEstimateMap: ReadonlyMap<string, DeliveryEstimateQueryState>;
  hasCoordinates: boolean;
  isLoading: boolean;
  hasError: boolean;
  onRestaurantPress: (restaurantId: string) => void;
  onSeeAllPress?: () => void;
}

function FeaturedRestaurantCard({
  restaurant,
  deliveryEstimateQuery,
  onPress,
}: {
  restaurant: RestaurantSearchResult;
  deliveryEstimateQuery?: DeliveryEstimateQueryState;
  onPress: () => void;
}) {
  const imageUrl = getRestaurantImageUrl(restaurant);
  const rating = getRestaurantRating(restaurant);
  const reviewCount = restaurant.reviewCount ?? 0;
  const { deliveryFeeLabel, deliveryTimeLabel, isFreeDelivery } =
    getDeliveryEstimateLabels(deliveryEstimateQuery);

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm active:scale-[0.98] border border-surface-variant/20"
    >
      <View className="h-40 w-full relative">
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            className="w-full h-full"
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View className="w-full h-full bg-surface-container items-center justify-center">
            <Utensils size={40} color="#707a6c" />
          </View>
        )}
        <View className="absolute top-3 right-3 bg-surface-container-lowest/95 px-2.5 py-1 rounded-full flex-row items-center gap-1 shadow-md">
          <Star size={16} color="#8b5000" fill="#8b5000" />
          <Text className="font-jakarta-sans text-sm font-bold text-on-background">
            {rating ? rating.toFixed(1) : 'New'}
          </Text>
          {reviewCount > 0 ? (
            <Text className="font-inter text-xs text-on-surface-variant">
              ({reviewCount}+)
            </Text>
          ) : null}
        </View>
        {isFreeDelivery ? (
          <View className="absolute top-3 left-3 bg-primary px-2.5 py-1 rounded-lg shadow-md">
            <Text className="text-on-primary font-inter text-xs font-bold uppercase tracking-wider">
              Free Delivery
            </Text>
          </View>
        ) : null}
      </View>

      <View className="p-4">
        <View className="flex-row justify-between items-start mb-1">
          <Text
            className="font-jakarta-sans font-extrabold text-xl text-on-background leading-tight flex-1 pr-3"
            numberOfLines={2}
          >
            {restaurant.name}
          </Text>
          <TouchableOpacity>
            <Heart size={20} color="#40493d" />
          </TouchableOpacity>
        </View>
        <Text className="font-inter text-sm text-on-surface-variant mb-3">
          {restaurant.cuisineType || 'Cuisine'}
          {rating && rating >= 4.5 ? ' - Gourmet' : ''}
        </Text>

        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1.5 bg-surface-container px-2.5 py-1.5 rounded-lg">
            <Clock size={16} color="#1a1c1c" />
            <Text className="font-inter text-xs font-semibold text-on-surface">
              {deliveryTimeLabel}
            </Text>
          </View>
          <View
            className={`flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${
              isFreeDelivery ? 'bg-primary/10' : 'bg-surface-container'
            }`}
          >
            <Truck size={16} color={isFreeDelivery ? '#00490e' : '#1a1c1c'} />
            <Text
              className={`font-inter text-xs font-bold ${
                isFreeDelivery ? 'text-primary' : 'text-on-surface'
              }`}
            >
              {deliveryFeeLabel}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function FeaturedRestaurantsSection({
  restaurants,
  deliveryEstimateMap,
  hasCoordinates,
  isLoading,
  hasError,
  onRestaurantPress,
  onSeeAllPress,
}: FeaturedRestaurantsSectionProps) {
  return (
    <View className="px-4">
      <View className="flex-row justify-between items-end mb-6">
        <Text className="font-jakarta-sans text-2xl font-extrabold text-on-background tracking-tight">
          Featured Restaurants
        </Text>
        <TouchableOpacity onPress={onSeeAllPress}>
          <Text className="text-primary text-sm font-bold">See all</Text>
        </TouchableOpacity>
      </View>

      {!hasCoordinates ? (
        <View className="items-center justify-center my-10">
          <Text className="text-on-surface-variant font-medium">
            Select an address to see nearby restaurants
          </Text>
        </View>
      ) : isLoading ? (
        <ActivityIndicator size="large" color="#00490e" />
      ) : hasError ? (
        <Text className="text-error text-center my-4">
          Error loading restaurants
        </Text>
      ) : restaurants.length === 0 ? (
        <View className="items-center justify-center my-10">
          <Utensils size={48} color="#707a6c" />
          <Text className="text-on-surface-variant font-medium mt-4">
            No restaurants available
          </Text>
        </View>
      ) : (
        <View className="flex-col gap-5">
          {restaurants.map((restaurant) => (
            <FeaturedRestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              deliveryEstimateQuery={deliveryEstimateMap.get(restaurant.id)}
              onPress={() => onRestaurantPress(restaurant.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
