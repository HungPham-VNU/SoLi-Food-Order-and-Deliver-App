import React from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { MapPin, Search, Star, Utensils } from 'lucide-react-native';
import { formatPrice } from '@/src/lib/format-utils';
import type {
  RestaurantSearchResult,
  SearchItemResult,
  UnifiedSearchTotals,
} from '../../types';
import {
  getRestaurantImageUrl,
  getRestaurantRating,
} from './restaurant-card-utils';

interface HomeSearchResultsProps {
  query: string;
  restaurants: RestaurantSearchResult[];
  items: SearchItemResult[];
  total?: UnifiedSearchTotals;
  isLoading: boolean;
  hasError: boolean;
  onRestaurantPress: (restaurantId: string) => void;
  onMenuItemPress: (itemId: string) => void;
}

function RestaurantSearchCard({
  restaurant,
  onPress,
}: {
  restaurant: RestaurantSearchResult;
  onPress: () => void;
}) {
  const imageUrl = getRestaurantImageUrl(restaurant);
  const rating = getRestaurantRating(restaurant);
  const reviewCount = restaurant.reviewCount ?? 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm active:scale-[0.98] border border-surface-variant/20 flex-row"
    >
      <View className="w-24 h-24 flex-shrink-0">
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
            <Utensils size={28} color="#707a6c" />
          </View>
        )}
      </View>
      <View className="flex-1 p-3 justify-center gap-1">
        <View className="flex-row items-center justify-between">
          <Text
            className="font-jakarta-sans font-bold text-base text-on-background flex-1 mr-2"
            numberOfLines={1}
          >
            {restaurant.name}
          </Text>
          <View
            className={`px-2 py-0.5 rounded-full ${
              restaurant.isOpen ? 'bg-primary/10' : 'bg-error/10'
            }`}
          >
            <Text
              className={`font-inter text-xs font-semibold ${
                restaurant.isOpen ? 'text-primary' : 'text-error'
              }`}
            >
              {restaurant.isOpen ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          {restaurant.cuisineType ? (
            <Text
              className="font-inter text-xs text-on-surface-variant flex-shrink"
              numberOfLines={1}
            >
              {restaurant.cuisineType}
            </Text>
          ) : null}
          <View className="flex-row items-center gap-1">
            <Star size={12} color="#8b5000" fill="#8b5000" />
            <Text className="font-inter text-xs font-semibold text-on-surface">
              {rating ? rating.toFixed(1) : 'New'}
            </Text>
            {reviewCount > 0 ? (
              <Text className="font-inter text-xs text-on-surface-variant">
                ({reviewCount}+)
              </Text>
            ) : null}
          </View>
        </View>
        <View className="flex-row items-center gap-1">
          <MapPin size={12} color="#707a6c" />
          <Text
            className="font-inter text-xs text-on-surface-variant flex-1"
            numberOfLines={1}
          >
            {restaurant.distanceKm != null
              ? `${restaurant.distanceKm.toFixed(1)} km away`
              : restaurant.address}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SearchItemCard({
  item,
  onPress,
}: {
  item: SearchItemResult;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm active:scale-[0.98] border border-surface-variant/20 flex-row"
    >
      <View className="w-24 h-24 flex-shrink-0">
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            className="w-full h-full"
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View className="w-full h-full bg-surface-container items-center justify-center">
            <Utensils size={28} color="#707a6c" />
          </View>
        )}
      </View>
      <View className="flex-1 p-3 justify-center gap-1">
        <Text
          className="font-jakarta-sans font-bold text-base text-on-background"
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text className="font-inter text-sm font-semibold text-primary">
          {formatPrice(item.price)} VND
        </Text>
        <Text
          className="font-inter text-xs text-on-surface-variant"
          numberOfLines={1}
        >
          {[item.categoryName, item.restaurant.name]
            .filter(Boolean)
            .join(' - ')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function HomeSearchResults({
  query,
  restaurants,
  items,
  total,
  isLoading,
  hasError,
  onRestaurantPress,
  onMenuItemPress,
}: HomeSearchResultsProps) {
  const hasResults = restaurants.length > 0 || items.length > 0;

  return (
    <View className="px-4 pb-6">
      <Text className="font-jakarta-sans text-lg font-bold text-on-surface-variant mb-4">
        Results for {`"${query}"`}
      </Text>

      {isLoading ? (
        <ActivityIndicator size="large" color="#00490e" />
      ) : hasError ? (
        <Text className="text-error text-center my-4">
          Error loading search results
        </Text>
      ) : !hasResults ? (
        <View className="items-center justify-center my-10 gap-3">
          <Search size={48} color="#707a6c" />
          <Text className="text-on-surface-variant font-medium text-center">
            No results found for {`"${query}"`}
          </Text>
        </View>
      ) : (
        <View className="gap-6">
          {restaurants.length > 0 ? (
            <View>
              <Text className="font-jakarta-sans text-xl font-extrabold text-on-background mb-3">
                Restaurants ({total?.restaurants ?? restaurants.length})
              </Text>
              <View className="gap-4">
                {restaurants.map((restaurant) => (
                  <RestaurantSearchCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    onPress={() => onRestaurantPress(restaurant.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {items.length > 0 ? (
            <View>
              <Text className="font-jakarta-sans text-xl font-extrabold text-on-background mb-3">
                Food Items ({total?.items ?? items.length})
              </Text>
              <View className="gap-3">
                {items.map((item) => (
                  <SearchItemCard
                    key={item.id}
                    item={item}
                    onPress={() => onMenuItemPress(item.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
