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
  Clock,
  Truck,
  Plus,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { formatCurrency } from '@/src/lib/format-utils';
import { RestaurantMenuScreenProps } from '../types';
import { useRestaurant, useRestaurantCategories, useRestaurantMenu } from '../api';
import { useMyCart } from '@/src/features/cart';
import { useRouter } from 'expo-router';

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

  const { 
    data: restaurant, 
    isLoading: isLoadingRest, 
    error: restError,
    isError: isErrorRest 
  } = useRestaurant(restaurantId);
  
  const { 
    data: menuData, 
    isLoading: isLoadingMenu, 
    error: menuError,
    isError: isErrorMenu 
  } = useRestaurantMenu(restaurantId);
  
  const { 
    data: categories, 
    isLoading: isLoadingCats, 
    error: catsError,
    isError: isErrorCats 
  } = useRestaurantCategories(restaurantId);

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
    const errorMsg = restError?.message || menuError?.message || catsError?.message || 'Restaurant not found';
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        <Text className="text-on-surface text-center mb-4">{errorMsg}</Text>
        <TouchableOpacity onPress={onBack} className="bg-primary px-6 py-2 rounded-full">
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
        await onFavoriteToggle(restaurantId);
      }
    } catch (err) {
      setIsFavorited(previousState);
      Alert.alert('Error', 'Failed to update favorite status');
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const itemCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

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
          <Image
            source={{ uri: (restaurant.coverImageUrl || restaurant.logoUrl) ?? undefined }}
            className="w-full h-full"
            contentFit="cover"
          />
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
                  {restaurant.rating ? restaurant.rating.toFixed(1) : 'New'} (
                  {restaurant.reviewCount || '0'}+)
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Clock size={14} color="#ffffff" />
                <Text className="text-white text-sm font-medium">
                  {restaurant.deliveryTime || '—'}
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Truck size={14} color="#ffffff" />
                <Text className="text-white text-sm font-medium">
                  {restaurant.deliveryFee === 0 ? 'Free' : (restaurant.deliveryFee ? `+${restaurant.deliveryFee}` : '—')}
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
            {filteredItems.map((item) => (
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
                      {item.imageUrl && (
                        <Image
                          source={{ uri: item.imageUrl }}
                          className="w-full h-full"
                          contentFit="cover"
                          transition={200}
                          cachePolicy="memory-disk"
                        />
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
                  disabled={isAddingToCart}
                  className={`absolute bottom-4 right-4 w-10 h-10 rounded-full items-center justify-center shadow-md active:scale-90 ${
                    isAddingToCart ? 'bg-primary/60' : 'bg-primary'
                  }`}
                >
                  {isAddingToCart ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Plus size={24} color="#ffffff" />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

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
            onPress={() => router.push('/(customer)/cart')}
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
