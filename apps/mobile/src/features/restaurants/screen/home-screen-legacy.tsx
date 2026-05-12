import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Search,
  Leaf,
  Apple,
  Fish,
  Milk,
  Croissant,
  Wine,
  ArrowRight,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TrendingProductCard, HomeTopBar } from '../components';
import { IMAGE_ASSETS } from '@/src/lib/constants';

const CATEGORIES = [
  { id: 'vegetables', name: 'Vegetables', Icon: Leaf },
  { id: 'fruits', name: 'Fruits', Icon: Apple },
  { id: 'seafood', name: 'Seafood', Icon: Fish },
  { id: 'dairy', name: 'Dairy', Icon: Milk },
  { id: 'bakery', name: 'Bakery', Icon: Croissant },
  { id: 'drinks', name: 'Drinks', Icon: Wine },
];

const TRENDING_PRODUCTS = [
  {
    id: 'green-broccoli',
    imageUrl: IMAGE_ASSETS.broccoli,
    badge: '-20%',
    category: 'Organic',
    name: 'Green Broccoli',
    unit: 'approx. 500g',
    price: 3.5,
    originalPrice: 4.4,
  },
  {
    id: 'norwegian-salmon',
    imageUrl: IMAGE_ASSETS.salmon,
    category: 'Fresh Fish',
    name: 'Norwegian Salmon',
    unit: 'approx. 200g',
    price: 8.9,
  },
  {
    id: 'valencia-oranges',
    imageUrl: IMAGE_ASSETS.oranges,
    category: 'Citrus',
    name: 'Valencia Oranges',
    unit: 'Pack of 4',
    price: 5.2,
  },
  {
    id: 'bell-pepper-mix',
    imageUrl: IMAGE_ASSETS.peppers,
    badge: '-10%',
    category: 'Fresh',
    name: 'Bell Pepper Mix',
    unit: 'Bag of 3',
    price: 4.1,
    originalPrice: 4.55,
  },
];

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('vegetables');
  const [bannerLoadError, setBannerLoadError] = useState(false);

  const handleProductPress = (productId: string) => {
    router.push({ pathname: '/product/[id]', params: { id: productId } });
  };

  const handleSelectCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId);
  };

  const handleViewAll = () => {
    Alert.alert('Navigate', 'Navigating to full list...');
  };

  const handleShopNow = () => {
    Alert.alert('Shop', 'Opening shop section...');
  };

  const handleLearnMore = () => {
    Alert.alert('Learn More', 'Showing farm information...');
  };

  return (
    <View className="flex-1 bg-surface">
      <HomeTopBar insetsTop={insets.top} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 70,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Section */}
        <View className="mt-4 relative justify-center">
          <View className="absolute left-4 z-10 pointer-events-none">
            <Search size={20} color="#707a6c" />
          </View>
          <TextInput
            className="w-full h-12 pl-12 pr-4 bg-surface-container-high rounded-xl font-inter text-sm text-on-surface"
            placeholder="Search fresh groceries..."
            placeholderTextColor="#707a6c"
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel="Search groceries"
            accessibilityHint="Enter product name to search for fresh groceries"
          />
        </View>

        {/* Category Navigation */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-8 -mx-4 px-4"
          contentContainerStyle={{ gap: 16 }}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategoryId === cat.id;
            return (
              <TouchableOpacity 
                key={cat.id}
                onPress={() => handleSelectCategory(cat.id)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${cat.name}`}
                accessible={true}
                accessibilityState={{ selected: isActive }}
                className="flex-col items-center gap-2 active:opacity-70"
              >
                <View className={`w-16 h-16 rounded-full items-center justify-center shadow-sm ${
                  isActive ? 'bg-primary-fixed' : 'bg-surface-container-lowest'
                }`}>
                  <cat.Icon size={32} color={isActive ? "#0d631b" : "#40493d"} />
                </View>
                <Text className={`text-[11px] font-semibold font-inter ${
                  isActive ? 'text-primary' : 'text-on-surface-variant'
                }`}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Promotional Banner */}
        <View className="mt-8 relative w-full h-48 rounded-3xl overflow-hidden bg-primary-container">
          <Image
            source={{
              uri: bannerLoadError ? IMAGE_ASSETS.placeholder : IMAGE_ASSETS.banner,
            }}
            onError={() => setBannerLoadError(true)}
            className="absolute inset-0 w-full h-full opacity-60"
            contentFit="cover"
            accessible={true}
            accessibilityLabel="Promotional banner showing discount on fresh produce"
          />
          <View className="absolute inset-0 bg-primary/40 p-6 flex-col justify-center gap-2">
            <View className="bg-secondary-container px-2 py-1 rounded-full self-start">
              <Text className="text-on-secondary-container text-[10px] font-bold uppercase tracking-wider font-inter">
                Flash Sale
              </Text>
            </View>
            <Text className="font-jakarta-sans font-extrabold text-white text-2xl leading-tight max-w-[180px]">
              Up to 40% OFF Fresh Produce
            </Text>
            <Text className="text-primary-fixed text-sm font-medium font-inter">
              Daily essentials at market price.
            </Text>
            <TouchableOpacity 
              onPress={handleShopNow}
              accessibilityRole="button"
              accessibilityLabel="Shop Now, open shop"
              className="mt-2 bg-white px-6 py-2 rounded-full self-start active:opacity-80"
            >
              <Text className="text-primary font-bold text-xs font-inter">Shop Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Trending Now Bento Grid */}
        <View className="mt-8">
          <View className="flex-row justify-between items-end mb-4">
            <Text className="font-jakarta-sans font-bold text-xl text-on-surface">
              Trending Now
            </Text>
            <TouchableOpacity
              onPress={handleViewAll}
              accessibilityRole="button"
              accessibilityLabel="View all trending products"
            >
              <Text className="text-primary font-bold text-xs tracking-wide">
                View All
              </Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row flex-wrap justify-between gap-y-4">
            {TRENDING_PRODUCTS.map((product) => (
              <TrendingProductCard
                key={product.id}
                {...product}
                onPress={() => handleProductPress(product.id)}
              />
            ))}
          </View>
        </View>

        {/* Fresh Picks Recommendation */}
        <View className="mt-8 pb-8">
          <View className="bg-primary-fixed/20 rounded-3xl p-6 flex-row items-center gap-6 overflow-hidden relative">
            <View className="flex-1 gap-2 z-10">
              <Text className="font-jakarta-sans font-extrabold text-primary-container text-lg">
                Fresh From Farm
              </Text>
              <Text className="text-primary-container/80 text-xs mt-1 font-inter">
                Hand-picked daily, delivered within 2 hours of harvest.
              </Text>
              <TouchableOpacity 
                onPress={handleLearnMore}
                accessibilityRole="button"
                accessibilityLabel="Learn more about our fresh from farm restaurant partnership"
                accessible={true}
                className="flex-row items-center gap-1 mt-2"
              >
                <Text className="text-primary-container font-bold text-xs font-inter">
                  Learn more
                </Text>
                <ArrowRight size={14} color="#2e7d32" />
              </TouchableOpacity>
            </View>
            <View
              className="w-24 h-24 relative z-10"
              style={{ transform: [{ rotate: '12deg' }] }}
            >
              <Image
                source={{
                  uri: IMAGE_ASSETS.freshFromFarm,
                }}
                className="w-full h-full"
                contentFit="contain"
                accessibilityLabel="Fresh From Farm produce basket"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
