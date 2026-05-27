import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Search,
  Star,
  Clock,
  Truck,
  Pizza,
  Soup,
  Leaf,
  Croissant,
  Utensils,
  Heart,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAddressStore } from '@/src/features/location';
import { HomeTopBar } from '../components';
import {
  useDeliveryEstimates,
  useNearbyRestaurants,
} from '../api/restaurant-api';
import { FloatingCartButton } from '@/src/features/cart';
import { formatCurrency } from '@/src/lib/format-utils';

const CATEGORIES = [
  { id: 'all', name: 'All', Icon: Utensils },
  { id: 'italian', name: 'Italian', Icon: Pizza },
  { id: 'asian', name: 'Asian', Icon: Soup },
  { id: 'healthy', name: 'Healthy', Icon: Leaf },
  { id: 'bakery', name: 'Bakery', Icon: Croissant },
];

const SPECIAL_OFFERS = [
  {
    id: '1',
    title: '50% Off First Order',
    code: 'TASTY50',
    tag: 'Limited Time',
    tagBg: 'bg-primary',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDwlt7N_i3aWRp2VHbLgQmZ6k6gj96k-SslATcMloH8nym9v2Yix9HPc6kpFLatV7Li6BYTIFlz379nAENGr5h_ft3GEd5uPMNjkhjk0K0ZSrcaq-n5d9Ywt_0pbaeu72cLYCJOLoCaAi-OeGD4-6mfpcrt5AFTOm6iQSaX-gYFy-mzS1fCZMFNQXX4IxTYejhgv5Sds8DcCvua6PlcKoO_Jc8b6iiHogp9s-tIewrSensPEdNrOic8AhpvXiwHgIrgMXjOjqO6sL-z',
  },
  {
    id: '2',
    title: 'Top Rated Bowls',
    code: 'Healthy & Delicious',
    tag: 'Trending',
    tagBg: 'bg-secondary',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDPE2kvoWKkyBMIdyp4KqLer9OI7B_ZZa1GlQjw8e_8jGaRxZLiSi2IYdtJdkg3mjshv8V0VzXqOrTPow-FLGxnUDfWTlOKpBFle-9Q5CKJyYdn4AJ4XWIUN5cHItF59-Fj3V2lsr4oKaQ2sU7u0rAMXaejNmqNL-2G-kuQN0mce1J6gpyJFPfQVOtXhy1VC0odLDXzuO-hAhVlCA3cHRhR0oU91RNM_5UQO4vfU1z235ZekNO0MsTIEkh27oKYECOS8SLM7sMtdEJC',
  },
];

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { latitude, longitude } = useAddressStore();
  
  const hasCoordinates = latitude != null && longitude != null;

  const {
    data: restaurantsData,
    isLoading,
    error,
  } = useNearbyRestaurants({
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
  const deliveryEstimateResults = useDeliveryEstimates(
    restaurantIds,
    latitude,
    longitude,
  );

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
      >
        {/* Search Section */}
        <View className="px-4 mb-6">
          <View className="relative justify-center">
            <View className="absolute left-4 z-10 pointer-events-none">
              <Search size={20} color="#40493d" />
            </View>
            <TextInput
              className="w-full h-14 pl-12 pr-4 bg-surface-container-lowest border border-surface-variant rounded-full font-inter text-sm text-on-surface shadow-sm"
              placeholder="Search restaurants, dishes..."
              placeholderTextColor="#40493d"
            />
          </View>
        </View>

        {/* Categories Section */}
        <View className="mb-8">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="px-4"
            contentContainerStyle={{ gap: 16, paddingRight: 32 }}
          >
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  className="flex-col items-center gap-1.5 active:scale-95"
                >
                  <View
                    className={`w-16 h-16 rounded-2xl items-center justify-center shadow-md ${
                      isActive
                        ? 'bg-primary rotate-3'
                        : 'bg-surface-container-lowest border border-surface-variant'
                    }`}
                  >
                    <cat.Icon
                      size={30}
                      color={isActive ? '#ffffff' : '#00490e'}
                      fill={isActive ? '#ffffff' : 'none'}
                    />
                  </View>
                  <Text
                    className={`font-jakarta-sans text-sm font-bold mt-1 ${
                      isActive ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Special Offer Hero Carousel */}
        <View className="mb-10">
          <ScrollView
            horizontal
            snapToInterval={320}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            className="px-4"
            contentContainerStyle={{ gap: 16, paddingRight: 32 }}
          >
            {SPECIAL_OFFERS.map((offer) => (
              <TouchableOpacity
                key={offer.id}
                onPress={() => Alert.alert('Offer', `Offer clicked: ${offer.title}`)}
                className="w-80 h-48 rounded-3xl overflow-hidden shadow-lg relative active:scale-[0.98]"
              >
                <Image
                  source={{ uri: offer.imageUrl }}
                  className="w-full h-full"
                  contentFit="cover"
                />
                <View className="absolute inset-0 bg-black/40 p-5 justify-end">
                  <View
                    className={`${offer.tagBg} px-2.5 py-1 rounded-md self-start mb-2`}
                  >
                    <Text className="text-on-primary text-[10px] font-bold uppercase tracking-wide">
                      {offer.tag}
                    </Text>
                  </View>
                  <Text className="text-white font-jakarta-sans font-bold text-2xl leading-tight">
                    {offer.title}
                  </Text>
                  <Text className="text-white/90 font-inter text-sm mt-1">
                    {offer.id === '1' ? `Code: ${offer.code}` : offer.code}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Featured Restaurants Section */}
        <View className="px-4">
          <View className="flex-row justify-between items-end mb-6">
            <Text className="font-jakarta-sans text-2xl font-extrabold text-on-background tracking-tight">
              Featured Restaurants
            </Text>
            <TouchableOpacity>
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
          ) : error ? (
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
              {restaurants.map((restaurant, index) => {
                const imageUrl =
                  restaurant.coverImageUrl ?? restaurant.logoUrl ?? undefined;
                const deliveryEstimateQuery = deliveryEstimateResults[index];
                const deliveryEstimate = deliveryEstimateQuery?.data;
                const isDeliveryEstimateLoading =
                  deliveryEstimateQuery?.isLoading ||
                  deliveryEstimateQuery?.isFetching;
                const deliveryFee = deliveryEstimate?.deliveryFee;
                const isFreeDelivery = deliveryFee === 0;
                const deliveryTimeLabel =
                  deliveryEstimate?.estimatedMinutes != null
                    ? `${deliveryEstimate.estimatedMinutes} min`
                    : isDeliveryEstimateLoading
                      ? '...'
                      : 'N/A';
                const deliveryFeeLabel =
                  deliveryFee != null
                    ? isFreeDelivery
                      ? 'Free'
                      : formatCurrency(deliveryFee)
                    : isDeliveryEstimateLoading
                      ? '...'
                      : 'Unavailable';

                return (
                  <TouchableOpacity
                    key={restaurant.id}
                    onPress={() =>
                      router.push({
                        pathname: '/restaurant/[id]',
                        params: { id: restaurant.id },
                      })
                    }
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
                          {restaurant.rating
                            ? restaurant.rating.toFixed(1)
                            : 'New'}
                        </Text>
                        <Text className="font-inter text-xs text-on-surface-variant">
                          ({restaurant.reviewCount || 0}+)
                        </Text>
                      </View>
                      {isFreeDelivery && (
                        <View className="absolute top-3 left-3 bg-primary px-2.5 py-1 rounded-lg shadow-md">
                          <Text className="text-on-primary font-inter text-xs font-bold uppercase tracking-wider">
                            Free Delivery
                          </Text>
                        </View>
                      )}
                    </View>

                    <View className="p-4">
                      <View className="flex-row justify-between items-start mb-1">
                        <Text className="font-jakarta-sans font-extrabold text-xl text-on-background leading-tight">
                          {restaurant.name}
                        </Text>
                        <TouchableOpacity>
                          <Heart size={20} color="#40493d" />
                        </TouchableOpacity>
                      </View>
                      <Text className="font-inter text-sm text-on-surface-variant mb-3">
                        {restaurant.cuisineType || 'Cuisine'}
                        {restaurant.rating && restaurant.rating >= 4.5 ? ' • Gourmet' : ''}
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
                            isFreeDelivery
                              ? 'bg-primary/10'
                              : 'bg-surface-container'
                          }`}
                        >
                          <Truck
                            size={16}
                            color={
                              isFreeDelivery ? '#00490e' : '#1a1c1c'
                            }
                          />
                          <Text
                            className={`font-inter text-xs font-bold ${
                              isFreeDelivery
                                ? 'text-primary'
                                : 'text-on-surface'
                            }`}
                          >
                            {deliveryFeeLabel}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
      <FloatingCartButton />
    </View>
  );
}

export default HomeScreen;
