import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import {
  Search,
  Navigation,
  ChevronRight,
  Plus,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAddressStore } from '../store/address-store';
import {
  AddressSelectionHeader,
  SavedAddressItem,
  RecentSearchItem,
} from '../components';

export function AddressSelectionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setSelectedAddress } = useAddressStore();
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleSelectAddress = (address: string) => {
    setSelectedAddress(address);
    setLocationError(null);
    router.back();
  };

  const handleUseCurrentLocation = async () => {
    if (isLocating) {
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;

      let label = 'Current Location';
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        if (place) {
          const parts = [
            place.name,
            place.street,
            place.city,
            place.region,
            place.postalCode,
          ].filter(Boolean);
          if (parts.length > 0) {
            label = parts.join(', ');
          }
        }
      } catch {
        // Reverse geocoding can fail; keep the fallback label.
      }

      setSelectedAddress(label, { latitude, longitude });
      router.back();
    } catch {
      setLocationError('Unable to get current location.');
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AddressSelectionHeader 
        onBack={() => router.back()} 
        insetsTop={insets.top} 
      />

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ 
          paddingTop: insets.top + 70, 
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 24 
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Section */}
        <View className="mb-8">
          <View className="relative justify-center">
            <View className="absolute left-4 z-10 pointer-events-none">
              <Search size={20} color="#40493d" />
            </View>
            <TextInput 
              className="w-full h-14 pl-12 pr-4 bg-surface-container-high rounded-xl font-jakarta-sans font-medium text-sm text-on-surface"
              placeholder="Search for area, street, or landmark"
              placeholderTextColor="#40493d"
            />
          </View>
        </View>

        {/* Current Location Button */}
        <TouchableOpacity 
          onPress={handleUseCurrentLocation}
          disabled={isLocating}
          className="flex-row items-center gap-4 p-5 bg-surface-container-lowest rounded-2xl mb-2 shadow-sm active:bg-surface-container"
        >
          <View className="bg-primary-fixed p-3 rounded-full shadow-sm">
            {isLocating ? (
              <ActivityIndicator size="small" color="#00490e" />
            ) : (
              <Navigation size={24} color="#00490e" fill="#00490e" />
            )}
          </View>
          <View className="flex-1">
            <Text className="font-bold text-on-surface font-jakarta-sans">
              {isLocating ? 'Fetching your location' : 'Use current location'}
            </Text>
            <Text className="text-sm text-on-surface-variant">
              {isLocating ? 'This may take a moment' : 'Using GPS for better accuracy'}
            </Text>
          </View>
          <ChevronRight size={20} color="#bfcaba" />
        </TouchableOpacity>
        {locationError ? (
          <Text className="text-xs text-red-600 mb-8">{locationError}</Text>
        ) : (
          <View className="mb-8" />
        )}

        {/* Map Visualization */}
        <View className="mb-10 h-40 w-full rounded-2xl overflow-hidden relative shadow-sm border border-surface-variant/10">
          <Image 
            source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuBhzmhZKCUolF2XW75TN31tPXR3P6XddNn-Q5QoXW1Q18LTMrjJrBH4G96BNKcwqpTJWIajE0yAoL29FcQoGgmcxjJ6PimsFLHyeRyiF05iH6SWiR7heKDtrSnWdYCD7pc5fl3k9IBuFeKioKVZt7zU4qTpzPqmXXrKSbf6TyIEPPquFOh_ztp0miFrwsHFk5BItRZfJMOD9oTVa5yAjiO46wMHPj6rf4Is6DLNkpGqKtdhz-qYlNMc9yZDOe2IalF3Z3_HeIJfcho8" }}
            className="w-full h-full opacity-90"
            contentFit="cover"
          />
          <View className="absolute inset-0 bg-black/10" />
          <View className="absolute bottom-4 left-4 bg-white/90 px-3 py-1.5 rounded-full shadow-sm flex-row items-center gap-2">
            <View className="w-2 h-2 bg-primary rounded-full" />
            <Text className="text-[10px] font-bold tracking-wider uppercase text-on-surface">
              Live Coverage Area
            </Text>
          </View>
        </View>

        {/* Saved Addresses */}
        <View className="mb-10">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-jakarta-sans font-bold text-lg text-on-surface">Saved Addresses</Text>
            <TouchableOpacity>
              <Text className="text-primary text-sm font-bold">View All</Text>
            </TouchableOpacity>
          </View>

          <View className="gap-4">
            <SavedAddressItem 
              type="home"
              label="Home"
              address="1242 Orchard Lane, Green Valley"
              onPress={() => handleSelectAddress('1242 Orchard Lane')}
            />
            <View className="h-4" />
            <SavedAddressItem 
              type="work"
              label="Creative Studio"
              address="88 Artisans Way, Suite 400"
              onPress={() => handleSelectAddress('88 Artisans Way')}
            />
          </View>
        </View>

        {/* Recent Searches */}
        <View className="mb-8">
          <Text className="font-jakarta-sans font-bold text-lg text-on-surface mb-4">Recent Searches</Text>
          <View className="gap-2">
            <RecentSearchItem 
              address="241 Maple Avenue, North Hills"
              onPress={() => handleSelectAddress('241 Maple Avenue')}
            />
            <RecentSearchItem 
              address="Farmers Market Plaza, Downtown"
              onPress={() => handleSelectAddress('Farmers Market Plaza')}
            />
          </View>
        </View>
      </ScrollView>

      {/* Fixed Footer */}
      <View 
        className="fixed bottom-0 left-0 w-full p-6 bg-white/90 backdrop-blur-xl border-t border-surface-variant/20"
        style={{ paddingBottom: Math.max(insets.bottom, 24) }}
      >
        <TouchableOpacity className="w-full bg-primary h-14 rounded-full flex-row items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98]">
          <Plus size={24} color="#ffffff" />
          <Text className="text-on-primary font-bold text-base">Add New Address</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
