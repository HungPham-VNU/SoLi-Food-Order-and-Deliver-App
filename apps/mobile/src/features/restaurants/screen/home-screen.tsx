import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
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
import { TrendingProductCard, BottomNav, HomeTopBar } from '../components';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const homeImages = {
    banner:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDEAydfvb_RwKuGVoiWBAmVZ32xwiLP9xHMtHn2whqI0PKEhU7Q-tfnfGyPJu5SgYm8691I5cgNfiKvulJmI_DcfAETV9xex0q-z94DSPKtHADmgoMzVJMx7dFmSpyNZlQcYTrpWcaINQzDLvqiK1rTLS6Rk7U916Hl2XzXrN9KkbVdPLXkjbaEfPzdDVMoL746jlIrfs_jU-aWS1sUVwJiOc-A6E-blYjQwz-f3QV_DeHX8I6eg1kFUVyTAr7blKVOyRDYJzAGYe-p',
    broccoli:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDtEmU9jDk593mfx2xlxQ1an7t-f0x87YcXQ-XyXgQmbb1oGEAoNNfWixmZjzDaDbGT7JUTLictc9W4eEoJxMvXOAAnI6CbrV_Cvae0yWD2f5NB6focKolG3UQTRmcvbgaf1cW2ABbgUIGz3SnKvH3wWK73Xm1OZ69pD60sXsWqTIhlTPjpFMP5r-D3sxqjD1W5C0fM_7vO5mOimWwQPQxSbk7RyczkgGaV0ja2NLpd4s41eI5Z5aAsavCnfrBoWYIMoWPOIY7paENN',
    salmon:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCly3watQ-rlq7AM1QbBUdmplFMV4ZLiuoJGZXZgforRLaccyviNN6ur9cB1mvlCYdZF6tNFGsq3W5syqhl0RtNByh0MeXD9Z2ELqVEM-kZrhKUugmnDglJ3Q4cCA0nkguFShEGuB8ygANBYHb5T-NyMM0-Ogp8TnBRAj13xSfbShJWaDiaecX2hhQ85sXbZKbsKaNEdp6MBvctVA_W9LUkI57-gYf8nJ9lNSxIxGskMaV0KUMXZ8mEugOqycjjDE9zvHEDZ-0ghi02',
    oranges:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAjlXlyIiJTPQ3L60YhdFuHexUYqfDfB3sTMle7zCI-KY7_CRIQ8mSRNMatrRmVzyOYEpStgl4WurymBXJ_VlgW58HkBlVBHslBCiFmOsqnI2cIG-QXn6pePVxrjTcvjgvzTwlo021y3HRmU5LHkDy5jNmP-Woa0JADQUan8h_7oNQteY6scJ-ukqUoJAdHoGSwIFzBOtQFlXlRBUpEoekfMLugNweQ3TkxyvfNI69561UY4TXot8L3OkaqG0eG4NzfXLXPvXM5rooR',
    peppers:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAhiMzBCnCrPM88ANvoddbGlB-cJvrscRyDnPfW0VpAz6e98MGmq_VjcA5Rl9fxMuWS_iCfD4uF6lPAIhabzcgM-gNL99q7aSmV4PnNWdQuoQFf2QZE61lv5rzdany4dyh5jOggKUNMi_SZ3g-SVdSZBxz0MfHx6FzoX_ZsjOgIIUvs7Fug2YCU7T6lsXUaoz7BFyUjXxpnJWX9EZKgwD5Na2_QWN9_7UJeIqQCJadfCZxikMMrBssLFTDiS3feWjHZnJVPAvEhg-oS',
    freshFromFarm:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAwoqCQHBPd1w2eRe7igfOW3p7shNxsjt3JiAcWkHDkiV9sSvH1DdxwBgSmycz1tesT9tJussYHGppIDKv-ohYbFJbnlgYaMJnvBwKdsgv9bGC0VVOYCdPXOD6aSj2hflYXXBSSvUCBECdRmTuz-oZK_Y0AqKCb5GCTzsGfusOhNkTjmYe_ogvHDW4xn1bsf6Veo9uwkHo4642ldt9ByGndRcfzydmzUpMWTucBfLweMk2ZgmHqG4tsZ3u6Nh6wDmaathXFFzJBNW0w',
  };

  const handleProductPress = (productId: string) => {
    router.push({ pathname: '/product/[id]', params: { id: productId } });
  };

  return (
    <View className="flex-1 bg-surface font-inter text-on-surface">
      <HomeTopBar insetsTop={insets.top} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 70,
          paddingBottom: insets.bottom + 100,
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
          />
        </View>

        {/* Category Navigation */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-8 -mx-4 px-4"
          contentContainerStyle={{ gap: 16 }}
        >
          {/* Active Category */}
          <TouchableOpacity className="flex-col items-center gap-2 group active:scale-90">
            <View className="w-16 h-16 rounded-full bg-primary-fixed items-center justify-center shadow-sm">
              <Leaf size={32} color="#0d631b" />
            </View>
            <Text className="text-[11px] font-semibold font-inter text-primary">
              Vegetables
            </Text>
          </TouchableOpacity>
          {/* Inactive Categories */}
          <TouchableOpacity className="flex-col items-center gap-2 group active:scale-90">
            <View className="w-16 h-16 rounded-full bg-surface-container-lowest items-center justify-center">
              <Apple size={32} color="#40493d" />
            </View>
            <Text className="text-[11px] font-semibold font-inter text-on-surface-variant">
              Fruits
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-col items-center gap-2 group active:scale-90">
            <View className="w-16 h-16 rounded-full bg-surface-container-lowest items-center justify-center">
              <Fish size={32} color="#40493d" />
            </View>
            <Text className="text-[11px] font-semibold font-inter text-on-surface-variant">
              Seafood
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-col items-center gap-2 group active:scale-90">
            <View className="w-16 h-16 rounded-full bg-surface-container-lowest items-center justify-center">
              <Milk size={32} color="#40493d" />
            </View>
            <Text className="text-[11px] font-semibold font-inter text-on-surface-variant">
              Dairy
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-col items-center gap-2 group active:scale-90">
            <View className="w-16 h-16 rounded-full bg-surface-container-lowest items-center justify-center">
              <Croissant size={32} color="#40493d" />
            </View>
            <Text className="text-[11px] font-semibold font-inter text-on-surface-variant">
              Bakery
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-col items-center gap-2 group active:scale-90 pr-4">
            <View className="w-16 h-16 rounded-full bg-surface-container-lowest items-center justify-center">
              <Wine size={32} color="#40493d" />
            </View>
            <Text className="text-[11px] font-semibold font-inter text-on-surface-variant">
              Drinks
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Promotional Banner */}
        <View className="mt-8 relative w-full h-48 rounded-3xl overflow-hidden bg-primary-container">
          <Image
            source={{
              uri: homeImages.banner,
            }}
            className="absolute inset-0 w-full h-full opacity-60"
            contentFit="cover"
          />
          <View className="absolute inset-0 bg-primary/40 p-6 flex-col justify-center gap-2">
            <View className="bg-secondary-container px-2 py-1 rounded-full self-start">
              <Text className="text-on-secondary-container text-[10px] font-bold uppercase tracking-wider">
                Flash Sale
              </Text>
            </View>
            <Text className="font-jakarta-sans font-extrabold text-white text-2xl leading-tight max-w-[180px]">
              Up to 40% OFF Fresh Produce
            </Text>
            <Text className="text-primary-fixed text-sm font-medium">
              Daily essentials at market price.
            </Text>
            <TouchableOpacity className="mt-2 bg-white px-6 py-2 rounded-full self-start active:scale-95">
              <Text className="text-primary font-bold text-xs">Shop Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Trending Now Bento Grid */}
        <View className="mt-8">
          <View className="flex-row justify-between items-end mb-4">
            <Text className="font-jakarta-sans font-bold text-xl text-on-surface">
              Trending Now
            </Text>
            <TouchableOpacity>
              <Text className="text-primary font-bold text-xs tracking-wide">
                View All
              </Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row flex-wrap justify-between gap-y-4">
            <TrendingProductCard
              imageUrl={homeImages.broccoli}
              badge="-20%"
              category="Organic"
              name="Green Broccoli"
              unit="approx. 500g"
              price={3.5}
              originalPrice={4.4}
              onPress={() => handleProductPress('green-broccoli')}
            />
            <TrendingProductCard
              imageUrl={homeImages.salmon}
              category="Fresh Fish"
              name="Norwegian Salmon"
              unit="approx. 200g"
              price={8.9}
              onPress={() => handleProductPress('norwegian-salmon')}
            />
            <TrendingProductCard
              imageUrl={homeImages.oranges}
              category="Citrus"
              name="Valencia Oranges"
              unit="Pack of 4"
              price={5.2}
              onPress={() => handleProductPress('valencia-oranges')}
            />
            <TrendingProductCard
              imageUrl={homeImages.peppers}
              badge="-10%"
              category="Fresh"
              name="Bell Pepper Mix"
              unit="Bag of 3"
              price={4.1}
              originalPrice={4.55}
              onPress={() => handleProductPress('bell-pepper-mix')}
            />
          </View>
        </View>

        {/* Fresh Picks Recommendation */}
        <View className="mt-8 pb-8">
          <View className="bg-primary-fixed/20 rounded-3xl p-6 flex-row items-center gap-6 overflow-hidden relative">
            <View className="flex-1 space-y-2 z-10">
              <Text className="font-jakarta-sans font-extrabold text-primary-container text-lg">
                Fresh From Farm
              </Text>
              <Text className="text-primary-container/80 text-xs mt-1">
                Hand-picked daily, delivered within 2 hours of harvest.
              </Text>
              <TouchableOpacity className="flex-row items-center gap-1 mt-2">
                <Text className="text-primary-container font-bold text-xs">
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
                  uri: homeImages.freshFromFarm,
                }}
                className="w-full h-full"
                contentFit="contain"
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <BottomNav insetBottom={insets.bottom} activeTab="home" transparent />
    </View>
  );
}
