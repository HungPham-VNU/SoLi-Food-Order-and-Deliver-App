import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import {
  ArrowLeft,
  Heart,
  Star,
  StarHalf,
  Clock,
  Truck,
  Plus,
  Ban,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { formatCurrency } from '@/src/lib/format-utils';
import { useAddressStore } from '@/src/features/location';
import {
  useRestaurantReviews,
  type PublicReviewItem,
} from '@/src/features/review';
import { type Restaurant, RestaurantMenuScreenProps } from '../types';
import {
  useDeliveryEstimate,
  useRestaurant,
  useRestaurantCategories,
  useRestaurantMenu,
} from '../api';
import { useMyCart } from '@/src/features/cart';
import { useRouter } from 'expo-router';

const REVIEW_PAGE_SIZE = 3;
const STAR_VALUES = [1, 2, 3, 4, 5] as const;

function formatReviewCount(count: number) {
  if (count <= 0) return 'No reviews yet';
  if (count === 1) return 'Based on 1 review';
  return `Based on ${count.toLocaleString('en-US')} reviews`;
}

function getDisplayRating(restaurant: Restaurant, reviews: PublicReviewItem[]) {
  const projectedRating =
    typeof restaurant.averageRating === 'number' && restaurant.averageRating > 0
      ? restaurant.averageRating
      : restaurant.rating;

  if (typeof projectedRating === 'number' && projectedRating > 0) {
    return projectedRating;
  }

  if (reviews.length === 0) {
    return null;
  }

  return (
    reviews.reduce((total, review) => total + review.stars, 0) / reviews.length
  );
}

function RatingStars({ rating, size = 16 }: { rating: number; size?: number }) {
  const cappedRating = Math.max(0, Math.min(5, rating));
  const fullStars = Math.floor(cappedRating);
  const remainder = cappedRating - fullStars;
  const roundedFullStars = fullStars + (remainder >= 0.75 ? 1 : 0);
  const hasHalfStar = remainder >= 0.25 && remainder < 0.75;

  return (
    <View className="flex-row items-center gap-0.5">
      {STAR_VALUES.map((value) => {
        if (value <= roundedFullStars) {
          return (
            <Star key={value} size={size} color="#ffb05f" fill="#ffb05f" />
          );
        }

        if (hasHalfStar && value === fullStars + 1) {
          return (
            <StarHalf key={value} size={size} color="#ffb05f" fill="#ffb05f" />
          );
        }

        return (
          <Star key={value} size={size} color="#bfcaba" fill="transparent" />
        );
      })}
    </View>
  );
}

function CustomerReviewCard({ review }: { review: PublicReviewItem }) {
  const comment = review.comment?.trim();

  return (
    <View className="bg-surface-container-lowest rounded-3xl p-5 gap-3">
      <RatingStars rating={review.stars} size={15} />

      {comment ? (
        <Text className="font-inter text-sm leading-5 text-on-surface-variant">
          {comment}
        </Text>
      ) : (
        <Text className="font-inter text-sm leading-5 text-on-surface-variant">
          No comment provided.
        </Text>
      )}
    </View>
  );
}

function CustomerReviewsSection({ restaurant }: { restaurant: Restaurant }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useRestaurantReviews(restaurant.id, REVIEW_PAGE_SIZE);

  const reviews = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data?.pages],
  );
  const totalReviews = data?.pages[0]?.total ?? restaurant.reviewCount ?? 0;
  const displayRating = getDisplayRating(restaurant, reviews);

  return (
    <View className="px-6 pb-4 gap-6">
      <Text className="font-jakarta-sans text-2xl font-bold text-on-surface">
        Customer Reviews
      </Text>

      <View className="bg-surface-container-low rounded-3xl p-6 flex-row items-center justify-between gap-4">
        <View className="flex-1">
          <View className="flex-row items-baseline gap-2">
            <Text className="font-jakarta-sans text-4xl font-extrabold text-on-surface">
              {displayRating ? displayRating.toFixed(1) : 'New'}
            </Text>
            {displayRating ? (
              <Text className="font-inter text-on-surface-variant font-medium">
                / 5.0
              </Text>
            ) : null}
          </View>
          {displayRating ? (
            <View className="mt-1">
              <RatingStars rating={displayRating} size={20} />
            </View>
          ) : null}
          <Text className="font-inter text-sm text-on-surface-variant mt-2">
            {formatReviewCount(totalReviews)}
          </Text>
        </View>
        <View className="bg-primary-fixed rounded-2xl px-4 py-3 items-center min-w-20">
          <Text className="font-jakarta-sans text-xl font-extrabold text-primary">
            {totalReviews.toLocaleString('en-US')}
          </Text>
          <Text className="font-inter text-xs font-semibold text-primary">
            reviews
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="bg-surface-container-lowest rounded-3xl p-6 items-center">
          <ActivityIndicator size="small" color="#0d631b" />
        </View>
      ) : isError ? (
        <View className="bg-error-container rounded-3xl p-6 gap-4">
          <Text className="font-inter text-sm font-semibold text-on-error-container">
            Reviews are unavailable right now.
          </Text>
          <TouchableOpacity
            onPress={() => void refetch()}
            className="self-start bg-primary rounded-full px-5 py-2.5"
          >
            <Text className="font-jakarta-sans font-bold text-on-primary">
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : reviews.length > 0 ? (
        <View className="gap-4">
          {reviews.map((review) => (
            <CustomerReviewCard key={review.id} review={review} />
          ))}
        </View>
      ) : (
        <View className="bg-surface-container-lowest rounded-3xl p-6">
          <Text className="font-inter text-sm text-on-surface-variant">
            No customer reviews yet.
          </Text>
        </View>
      )}

      {hasNextPage ? (
        <TouchableOpacity
          onPress={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full py-3 rounded-3xl border-2 border-primary/20 items-center active:scale-95"
        >
          {isFetchingNextPage ? (
            <ActivityIndicator size="small" color="#0d631b" />
          ) : (
            <Text className="font-jakarta-sans font-bold text-primary">
              {reviews.length <= REVIEW_PAGE_SIZE
                ? 'View All Reviews'
                : 'Load More Reviews'}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function RestaurantMenuScreen({
  restaurantId,
  onBack,
  onFavoriteToggle,
  onItemPress,
  onAddItem,
  isAddingToCart,
}: RestaurantMenuScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [isFavorited, setIsFavorited] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const { latitude, longitude } = useAddressStore();

  const {
    data: restaurant,
    isLoading: isLoadingRest,
    error: restError,
    isError: isErrorRest,
  } = useRestaurant(restaurantId);

  const {
    data: menuData,
    isLoading: isLoadingMenu,
    error: menuError,
    isError: isErrorMenu,
  } = useRestaurantMenu(restaurantId);

  const {
    data: categories,
    isLoading: isLoadingCats,
    error: catsError,
    isError: isErrorCats,
  } = useRestaurantCategories(restaurantId);

  const {
    data: deliveryEstimate,
    isLoading: isDeliveryEstimateLoading,
    isFetching: isDeliveryEstimateFetching,
  } = useDeliveryEstimate(restaurantId, latitude, longitude);

  const { data: cart } = useMyCart();

  // Sync favorited state from server
  React.useEffect(() => {
    if (restaurant) {
      setIsFavorited(!!(restaurant as any).isFavorited);
    }
  }, [restaurant]);

  const filteredItems = useMemo(() => {
    const items = menuData?.data || [];
    if (activeCategoryId === 'all') return items;
    return items.filter((item) => item.categoryId === activeCategoryId);
  }, [menuData?.data, activeCategoryId]);

  const isLoading = isLoadingRest || isLoadingMenu || isLoadingCats;
  const isError = isErrorRest || isErrorMenu || isErrorCats;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#0d631b" />
      </View>
    );
  }

  if (isError || !restaurant) {
    const errorMsg =
      restError?.message ||
      menuError?.message ||
      catsError?.message ||
      'Restaurant not found';
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        <Text className="text-on-surface text-center mb-4">{errorMsg}</Text>
        <TouchableOpacity
          onPress={onBack}
          className="bg-primary px-6 py-2 rounded-full"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleToggleFavorite = async () => {
    if (isTogglingFavorite) return;

    const previousState = isFavorited;
    setIsFavorited(!previousState);
    setIsTogglingFavorite(true);

    try {
      if (onFavoriteToggle) {
        onFavoriteToggle(restaurantId);
      }
    } catch (err) {
      setIsFavorited(previousState);
      Alert.alert('Error', 'Failed to update favorite status');
      console.error('Error toggling favorite:', err);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const itemCount =
    cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const restaurantImageUrl = restaurant.coverImageUrl || restaurant.logoUrl;
  const restaurantRating =
    typeof restaurant.averageRating === 'number' && restaurant.averageRating > 0
      ? restaurant.averageRating
      : restaurant.rating;
  const restaurantReviewCount = restaurant.reviewCount ?? 0;
  const isDeliveryEstimatePending =
    isDeliveryEstimateLoading || isDeliveryEstimateFetching;
  const rawDeliveryTime = restaurant.deliveryTime?.trim();
  const deliveryTimeLabel =
    deliveryEstimate?.estimatedMinutes != null
      ? `${deliveryEstimate.estimatedMinutes} min`
      : rawDeliveryTime
        ? rawDeliveryTime
        : isDeliveryEstimatePending
          ? '...'
          : '-';
  const deliveryFee = deliveryEstimate?.deliveryFee ?? restaurant.deliveryFee;
  const deliveryFeeLabel =
    deliveryFee != null
      ? deliveryFee === 0
        ? 'Free'
        : formatCurrency(deliveryFee)
      : isDeliveryEstimatePending
        ? '...'
        : '-';

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="light-content" />

      {/* Top App Bar */}
      <View
        className="absolute top-0 w-full z-50 flex-row items-center justify-between px-6"
        style={{ paddingTop: insets.top, height: insets.top + 60 }}
      >
        <TouchableOpacity
          onPress={onBack}
          className="bg-white/20 backdrop-blur-md p-2 rounded-full active:scale-95"
        >
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>

        <Text className="font-jakarta-sans font-bold text-white text-lg tracking-tight">
          {restaurant.name}
        </Text>

        <TouchableOpacity
          onPress={handleToggleFavorite}
          disabled={isTogglingFavorite}
          className="bg-white/20 backdrop-blur-md p-2 rounded-full active:scale-95"
        >
          <Heart
            size={24}
            color="#ffffff"
            fill={isFavorited ? '#ffffff' : 'none'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View className="relative w-full h-80">
          {restaurantImageUrl ? (
            <Image
              source={{ uri: restaurantImageUrl }}
              className="w-full h-full"
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View className="w-full h-full bg-primary" />
          )}
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.6)',
              'rgba(0,0,0,0.2)',
              'transparent',
              'rgba(0,0,0,0.7)',
            ]}
            locations={[0, 0.2, 0.5, 1]}
            className="absolute inset-0"
          />
          <View className="absolute bottom-0 left-0 right-0 p-6">
            <Text className="font-jakarta-sans text-3xl font-extrabold text-white mb-2">
              {restaurant.name}
            </Text>
            <View className="flex-row items-center gap-4">
              <View className="flex-row items-center gap-1">
                <Star size={14} color="#ffb05f" fill="#ffb05f" />
                <Text className="text-white text-sm font-medium">
                  {restaurantRating ? restaurantRating.toFixed(1) : 'New'} (
                  {restaurantReviewCount}+)
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Clock size={14} color="#ffffff" />
                <Text className="text-white text-sm font-medium">
                  {deliveryTimeLabel}
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Truck size={14} color="#ffffff" />
                <Text className="text-white text-sm font-medium">
                  {deliveryFeeLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Category Nav */}
        <View className="mt-6 px-6">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-6 px-6 pb-2"
            contentContainerStyle={{ gap: 12 }}
          >
            <TouchableOpacity
              onPress={() => setActiveCategoryId('all')}
              className={`px-6 py-2 rounded-full active:scale-95 ${
                activeCategoryId === 'all'
                  ? 'bg-primary-fixed shadow-sm'
                  : 'bg-surface-container-high'
              }`}
            >
              <Text
                className={`font-jakarta-sans font-semibold text-sm ${
                  activeCategoryId === 'all'
                    ? 'text-primary'
                    : 'text-on-surface-variant'
                }`}
              >
                All
              </Text>
            </TouchableOpacity>
            {categories?.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setActiveCategoryId(cat.id)}
                className={`px-6 py-2 rounded-full active:scale-95 ${
                  activeCategoryId === cat.id
                    ? 'bg-primary-fixed shadow-sm'
                    : 'bg-surface-container-high'
                }`}
              >
                <Text
                  className={`font-jakarta-sans font-semibold text-sm ${
                    activeCategoryId === cat.id
                      ? 'text-primary'
                      : 'text-on-surface-variant'
                  }`}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Menu Items */}
        <View className="px-6 py-8">
          <Text className="font-jakarta-sans text-2xl font-bold text-on-surface mb-6">
            {activeCategoryId === 'all'
              ? 'Full Menu'
              : categories?.find((c) => c.id === activeCategoryId)?.name ||
                'Menu'}
          </Text>
          <View className="flex-col gap-6">
            {filteredItems.map((item) => {
              const isSoldOut = item.status === 'out_of_stock';

              return (
                <View
                  key={item.id}
                  className="relative bg-surface-container-lowest rounded-3xl shadow-sm border border-surface-variant/20"
                >
                  <TouchableOpacity
                    onPress={() => onItemPress?.(item.id)}
                    className="p-4 active:scale-[0.98]"
                  >
                    <View className="flex-row justify-between items-start mb-4">
                      <View className="flex-1 pr-4">
                        {isSoldOut ? (
                          <View className="mb-2 self-start rounded-full bg-error-container px-3 py-1">
                            <Text className="font-jakarta-sans text-xs font-bold uppercase tracking-wide text-error">
                              Sold out
                            </Text>
                          </View>
                        ) : null}
                        <Text className="font-jakarta-sans text-lg font-bold text-on-surface mb-1">
                          {item.name}
                        </Text>
                        <Text
                          numberOfLines={2}
                          className="font-inter text-sm text-on-surface-variant leading-5"
                        >
                          {item.description}
                        </Text>
                      </View>
                      <View className="w-24 h-24 rounded-2xl bg-surface-container overflow-hidden border border-outline-variant/15">
                        {item.imageUrl ? (
                          <Image
                            source={{ uri: item.imageUrl }}
                            className="w-full h-full"
                            contentFit="cover"
                            transition={200}
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <View className="w-full h-full items-center justify-center">
                            <Text className="text-xs font-medium text-on-surface-variant">
                              No image
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="font-jakarta-sans font-bold text-lg text-secondary">
                        {formatCurrency(item.price ?? 0)}
                      </Text>
                      <View className="w-10 h-10" />
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onAddItem?.(item.id)}
                    disabled={isAddingToCart || isSoldOut}
                    accessibilityLabel={
                      isSoldOut
                        ? `${item.name} is sold out`
                        : `Add ${item.name}`
                    }
                    className={`absolute bottom-4 right-4 w-10 h-10 rounded-full items-center justify-center shadow-md active:scale-90 ${
                      isAddingToCart || isSoldOut
                        ? 'bg-outline/50'
                        : 'bg-primary'
                    }`}
                  >
                    {isSoldOut ? (
                      <Ban size={22} color="#ffffff" />
                    ) : isAddingToCart ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Plus size={24} color="#ffffff" />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        <CustomerReviewsSection restaurant={restaurant} />

        {/* Spacer for bottom nav */}
        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      {/* Sticky Bottom View Cart Bar */}
      {cart && cart.items && cart.items.length > 0 && (
        <View
          className="absolute bottom-0 w-full z-50 bg-surface/90 backdrop-blur-xl pb-8 pt-4 px-6 shadow-lg rounded-t-xl border-t border-surface-container-high/50"
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <TouchableOpacity
            onPress={() => router.navigate('/(customer)/cart')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#00490e', '#0d631b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="w-full h-14 rounded-full flex-row items-center justify-between px-6"
              style={{ borderRadius: 9999 }}
            >
              <View className="flex-row items-center gap-3">
                <View className="bg-white/20 rounded-lg p-1.5">
                  <Text className="text-white font-jakarta-sans font-bold text-sm">
                    {itemCount}
                  </Text>
                </View>
                <Text className="text-white font-jakarta-sans font-bold text-lg">
                  View Cart
                </Text>
              </View>
              <Text className="text-white font-jakarta-sans font-bold text-lg">
                {formatCurrency(cart.totalAmount)}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
