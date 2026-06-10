import React, { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingCartButton } from '@/src/features/cart';
import { useAddressStore } from '@/src/features/location';
import {
  CategoryRail,
  FeaturedRestaurantsSection,
  HomeSearchBar,
  HomeSearchResults,
  HomeTopBar,
  SpecialOffersCarousel,
} from '../components';
import {
  useDeliveryEstimates,
  useNearbyRestaurants,
  useUnifiedSearch,
} from '../api';
import { useDebouncedValue } from '../hooks';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, 400).trim();
  const { latitude, longitude } = useAddressStore();

  const hasCoordinates = latitude != null && longitude != null;
  const isSearchActive = debouncedQuery.length > 0;

  const {
    data: restaurantsData,
    isLoading,
    error,
    refetch: refetchNearby,
    isRefetching: isRefetchingNearby,
  } = useNearbyRestaurants({
    latitude,
    longitude,
  });

  const {
    data: searchData,
    isLoading: isSearchLoading,
    error: searchError,
    refetch: refetchSearch,
    isRefetching: isRefetchingSearch,
  } = useUnifiedSearch({
    q: debouncedQuery,
    latitude,
    longitude,
  });

  const restaurants = useMemo(
    () => restaurantsData?.restaurants ?? [],
    [restaurantsData?.restaurants],
  );
  const restaurantIds = useMemo(
    () => restaurants.map((restaurant) => restaurant.id),
    [restaurants],
  );
  const deliveryEstimateMap = useDeliveryEstimates(
    restaurantIds,
    latitude,
    longitude,
  );

  const onRefresh = React.useCallback(() => {
    void refetchNearby();
    void refetchSearch();
  }, [refetchNearby, refetchSearch]);

  const handleRestaurantPress = React.useCallback(
    (restaurantId: string) => {
      router.navigate({
        pathname: '/restaurant/[id]',
        params: { id: restaurantId },
      });
    },
    [router],
  );

  const handleMenuItemPress = React.useCallback(
    (itemId: string) => {
      router.navigate({
        pathname: '/restaurant/menu-item/[id]',
        params: { id: itemId },
      });
    },
    [router],
  );

  const handleOfferPress = React.useCallback((offerTitle: string) => {
    Alert.alert('Offer', `Offer clicked: ${offerTitle}`);
  }, []);

  const refreshing = isRefetchingNearby || isRefetchingSearch;

  return (
    <View className="flex-1 bg-background font-inter text-on-surface">
      <HomeTopBar insetsTop={insets.top} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 80,
          paddingBottom: insets.bottom + 80,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#00490e']}
            tintColor="#00490e"
          />
        }
      >
        <HomeSearchBar query={searchQuery} onChangeQuery={setSearchQuery} />

        {isSearchActive ? (
          <HomeSearchResults
            query={debouncedQuery}
            restaurants={searchData?.restaurants ?? []}
            items={searchData?.items ?? []}
            total={searchData?.total}
            isLoading={isSearchLoading}
            hasError={Boolean(searchError)}
            onRestaurantPress={handleRestaurantPress}
            onMenuItemPress={handleMenuItemPress}
          />
        ) : (
          <>
            <CategoryRail
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
            <SpecialOffersCarousel onOfferPress={handleOfferPress} />
            <FeaturedRestaurantsSection
              restaurants={restaurants}
              deliveryEstimateMap={deliveryEstimateMap}
              hasCoordinates={hasCoordinates}
              isLoading={isLoading}
              hasError={Boolean(error)}
              onRestaurantPress={handleRestaurantPress}
            />
          </>
        )}
      </ScrollView>

      <FloatingCartButton />
    </View>
  );
}

export default HomeScreen;
