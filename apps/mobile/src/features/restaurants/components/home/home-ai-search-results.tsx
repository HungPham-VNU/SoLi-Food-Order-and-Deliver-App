import React from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Search, Sparkles, Utensils } from 'lucide-react-native';
import { formatPrice } from '@/src/lib/format-utils';
import type {
  AiSearchAppliedFilter,
  AiSearchFollowUp,
  AiSearchItemResult,
  RestaurantSearchResult,
  UnifiedSearchTotals,
} from '../../types';
import { RestaurantSearchCard } from './home-search-results';

interface HomeAiSearchResultsProps {
  query: string;
  interpretation?: string;
  appliedFilters: AiSearchAppliedFilter[];
  restaurants: RestaurantSearchResult[];
  items: AiSearchItemResult[];
  total?: UnifiedSearchTotals;
  followUps: AiSearchFollowUp[];
  isFallback: boolean;
  isLoading: boolean;
  hasError: boolean;
  onRestaurantPress: (restaurantId: string) => void;
  onMenuItemPress: (itemId: string) => void;
  onFollowUpPress: (query: string) => void;
}

function AiItemCard({
  item,
  onPress,
}: {
  item: AiSearchItemResult;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm active:scale-[0.98] border border-surface-variant/20 flex-row"
    >
      <View className="w-24 h-28 flex-shrink-0">
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
      <View className="flex-1 p-3 justify-center gap-1.5">
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
        {item.matchReasons.length > 0 ? (
          <View className="flex-row flex-wrap gap-1 pt-1">
            {item.matchReasons.slice(0, 4).map((reason) => (
              <View
                key={`${item.id}-${reason}`}
                className="px-2 py-1 rounded-full bg-primary/10"
              >
                <Text
                  className="font-inter text-[11px] font-semibold text-primary"
                  numberOfLines={1}
                >
                  {reason}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function HomeAiSearchResults({
  query,
  interpretation,
  appliedFilters,
  restaurants,
  items,
  total,
  followUps,
  isFallback,
  isLoading,
  hasError,
  onRestaurantPress,
  onMenuItemPress,
  onFollowUpPress,
}: HomeAiSearchResultsProps) {
  const hasResults = restaurants.length > 0 || items.length > 0;

  return (
    <View className="px-4 pb-6">
      <View className="mb-4 gap-3">
        <View className="flex-row items-center gap-2">
          <Sparkles size={18} color="#00490e" />
          <Text
            className="font-jakarta-sans text-lg font-bold text-on-background flex-1"
            numberOfLines={2}
          >
            {interpretation ?? `AI results for "${query}"`}
          </Text>
        </View>
        {isFallback ? (
          <Text className="font-inter text-sm text-on-surface-variant">
            Showing regular results
          </Text>
        ) : null}
        {appliedFilters.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {appliedFilters.map((filter) => (
              <View
                key={`${filter.key}-${filter.label}`}
                className="px-3 py-1.5 rounded-full bg-surface-container border border-surface-variant/30"
              >
                <Text
                  className="font-inter text-xs font-semibold text-on-surface"
                  numberOfLines={1}
                >
                  {filter.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#00490e" />
      ) : hasError ? (
        <Text className="text-error text-center my-4">
          Error loading AI search results
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
          {items.length > 0 ? (
            <View>
              <Text className="font-jakarta-sans text-xl font-extrabold text-on-background mb-3">
                Best matches ({total?.items ?? items.length})
              </Text>
              <View className="gap-3">
                {items.map((item) => (
                  <AiItemCard
                    key={item.id}
                    item={item}
                    onPress={() => onMenuItemPress(item.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

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

          {followUps.length > 0 ? (
            <View>
              <Text className="font-jakarta-sans text-base font-bold text-on-background mb-3">
                Follow up
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {followUps.map((followUp) => (
                  <TouchableOpacity
                    key={`${followUp.label}-${followUp.query}`}
                    onPress={() => onFollowUpPress(followUp.query)}
                    className="px-3 py-2 rounded-full bg-primary/10"
                  >
                    <Text className="font-inter text-sm font-semibold text-primary">
                      {followUp.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

