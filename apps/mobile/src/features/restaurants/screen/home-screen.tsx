import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from '@/src/components/keyboard-aware-scroll-view';
import { FloatingCartButton } from '@/src/features/cart';
import { useAddressStore } from '@/src/features/location';
import {
  CategoryRail,
  FeaturedRestaurantsSection,
  HomeAiSearchResults,
  HomeSearchBar,
  HomeSearchResults,
  HomeTopBar,
  SpecialOffersCarousel,
} from '../components';
import {
  useAiSearch,
  useDeliveryEstimates,
  useInfiniteNearbyRestaurants,
  useInfiniteUnifiedSearch,
} from '../api';
import { useDebouncedValue } from '../hooks';
import { useSearchModeStore } from '../store';
import { keyboardAvoidingBehavior } from '@/src/lib/keyboard';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [submittedAiQuery, setSubmittedAiQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { mode: searchMode, toggleMode: toggleSearchMode } =
    useSearchModeStore();
  const debouncedQuery = useDebouncedValue(searchQuery, 400).trim();
  const { latitude, longitude } = useAddressStore();

  const hasCoordinates = latitude != null && longitude != null;
  const isAiSearchMode = searchMode === 'ai';
  const isClassicSearchActive = debouncedQuery.length > 0;
  const isAiSearchActive = submittedAiQuery.length > 0;
  const isSearchActive = isAiSearchMode
    ? isAiSearchActive
    : isClassicSearchActive;

  const {
    data: restaurantsData,
    isLoading,
    error,
    refetch: refetchNearby,
    isRefetching: isRefetchingNearby,
    fetchNextPage: fetchNextNearby,
    hasNextPage: hasNextNearby,
    isFetchingNextPage: isFetchingNextNearby,
  } = useInfiniteNearbyRestaurants({
    latitude,
    longitude,
    tag: selectedCategory !== 'all' ? selectedCategory : undefined,
  });

  const {
    data: searchData,
    isLoading: isSearchLoading,
    error: searchError,
    refetch: refetchSearch,
    isRefetching: isRefetchingSearch,
    fetchNextPage: fetchNextSearch,
    hasNextPage: hasNextSearch,
    isFetchingNextPage: isFetchingNextSearch,
  } = useInfiniteUnifiedSearch({
    q: debouncedQuery,
    latitude,
    longitude,
    tag: selectedCategory !== 'all' ? selectedCategory : undefined,
    enabled: isClassicSearchActive && !isAiSearchMode,
  });

  const {
    data: aiSearchData,
    isPending: isAiSearchLoading,
    error: aiSearchError,
    mutate: runAiSearch,
  } = useAiSearch({
    latitude,
    longitude,
  });

  const handleSearchQueryChange = React.useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSubmittedAiQuery('');
    }
  }, []);

  const handleSearchSubmit = React.useCallback(() => {
    if (!isAiSearchMode) return;

    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setSubmittedAiQuery('');
      return;
    }

    setSubmittedAiQuery(trimmedQuery);
    runAiSearch(trimmedQuery);
  }, [isAiSearchMode, runAiSearch, searchQuery]);

  const handleToggleSearchMode = React.useCallback(() => {
    setSubmittedAiQuery('');
    toggleSearchMode();
  }, [toggleSearchMode]);

  const restaurants = useMemo(
    () => restaurantsData?.pages.flatMap((page) => page.restaurants) ?? [],
    [restaurantsData],
  );
  
  const searchRestaurants = useMemo(
    () => searchData?.pages.flatMap((page) => page.restaurants) ?? [],
    [searchData],
  );

  const searchItems = useMemo(
    () => searchData?.pages.flatMap((page) => page.items) ?? [],
    [searchData],
  );

  const searchTotal = searchData?.pages[0]?.total;
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
    if (isAiSearchMode) {
      if (!isAiSearchActive) {
        void refetchNearby();
      }
      return;
    }

    if (!isClassicSearchActive) {
      void refetchNearby();
      return;
    }

    void refetchSearch();
  }, [
    isAiSearchActive,
    isAiSearchMode,
    isClassicSearchActive,
    refetchNearby,
    refetchSearch,
  ]);

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

  const handleScroll = React.useCallback(
    (event: any) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const paddingToBottom = 500;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
        if (isSearchActive && !isAiSearchMode && hasNextSearch && !isFetchingNextSearch) {
          fetchNextSearch();
        } else if (!isSearchActive && hasNextNearby && !isFetchingNextNearby) {
          fetchNextNearby();
        }
      }
    },
    [
      isSearchActive,
      isAiSearchMode,
      hasNextSearch,
      isFetchingNextSearch,
      fetchNextSearch,
      hasNextNearby,
      isFetchingNextNearby,
      fetchNextNearby,
    ],
  );

  return (
    <KeyboardAvoidingView
      behavior={keyboardAvoidingBehavior}
      className="flex-1 bg-background font-inter text-on-surface"
    >
      <HomeTopBar insetsTop={insets.top} />

      <KeyboardAwareScrollView
        className="flex-1"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: insets.top + 80,
          paddingBottom: insets.bottom + 80,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          isAiSearchActive && isAiSearchMode ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#00490e']}
              tintColor="#00490e"
            />
          )
        }
      >
        <HomeSearchBar
          query={searchQuery}
          onChangeQuery={handleSearchQueryChange}
          onSubmitQuery={handleSearchSubmit}
          mode={searchMode}
          onToggleMode={handleToggleSearchMode}
        />

        {isSearchActive && isAiSearchMode ? (
          <HomeAiSearchResults
            query={submittedAiQuery}
            interpretation={aiSearchData?.interpretation}
            appliedFilters={aiSearchData?.appliedFilters ?? []}
            restaurants={aiSearchData?.restaurants ?? []}
            items={aiSearchData?.items ?? []}
            total={aiSearchData?.total}
            followUps={aiSearchData?.followUps ?? []}
            isFallback={aiSearchData?.mode === 'classic_fallback'}
            isLoading={isAiSearchLoading}
            hasError={Boolean(aiSearchError)}
            onRestaurantPress={handleRestaurantPress}
            onMenuItemPress={handleMenuItemPress}
            onFollowUpPress={handleSearchQueryChange}
          />
        ) : isSearchActive ? (
          <HomeSearchResults
            query={debouncedQuery}
            restaurants={searchRestaurants}
            items={searchItems}
            total={searchTotal}
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
      </KeyboardAwareScrollView>

      <FloatingCartButton />
    </KeyboardAvoidingView>
  );
}

export default HomeScreen;
