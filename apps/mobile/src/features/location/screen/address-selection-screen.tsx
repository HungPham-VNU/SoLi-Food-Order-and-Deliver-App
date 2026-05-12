import React from 'react';
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
import { Search, Navigation, ChevronRight, Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAddressStore } from '../store/address-store';
import { useAddressSearch, useCurrentLocation } from '../hooks';
import { IMAGE_ASSETS } from '@/src/lib/constants';
import {
  AddressSelectionHeader,
  SearchResultItem,
  SavedAddressItem,
  RecentSearchItem,
} from '../components';

export function AddressSelectionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { 
    setSelectedAddress, 
    latitude, 
    longitude,
    savedAddresses,
    recentSearches 
  } = useAddressStore();
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchResults,
    isSearching,
    error: searchError,
    shouldSearch,
    clearError: clearSearchError,
  } = useAddressSearch({ latitude, longitude });
  const {
    isLocating,
    error: locationError,
    locate: locateCurrentLocation,
    clearError: clearLocationError,
  } = useCurrentLocation();

  const handleSelectAddress = (
    address: string,
    coords?: { latitude: number; longitude: number } | null,
  ) => {
    setSelectedAddress(address, coords);
    clearLocationError();
    clearSearchError();
    router.back();
  };

  const handleUseCurrentLocation = async () => {
    const result = await locateCurrentLocation();
    if (!result) {
      return;
    }

    setSelectedAddress(result.label, result.coords);
    router.back();
  };

  const handleAddNewAddress = () => {
    Alert.alert('Action', 'Add new address feature coming soon!');
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
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: 24,
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
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {shouldSearch ? (
          <View className="mb-8">
            {isSearching ? (
              <View className="flex-row items-center gap-2 py-2">
                <ActivityIndicator size="small" color="#00490e" />
                <Text className="text-xs text-on-surface-variant">
                  Searching addresses...
                </Text>
              </View>
            ) : null}
            {searchError ? (
              <Text className="text-xs text-red-600 mb-2">{searchError}</Text>
            ) : null}
            {!isSearching && !searchError && searchResults.length === 0 ? (
              <Text className="text-xs text-on-surface-variant mb-2">
                No matches found.
              </Text>
            ) : null}
            <View className="gap-2">
              {searchResults.map((result) => (
                <SearchResultItem
                  key={result.id}
                  title={result.label}
                  subtitle={result.subtitle}
                  onPress={() =>
                    handleSelectAddress(result.label, {
                      latitude: result.latitude,
                      longitude: result.longitude,
                    })
                  }
                />
              ))}
            </View>
          </View>
        ) : null}

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
              {isLocating
                ? 'This may take a moment'
                : 'Using GPS for better accuracy'}
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
            source={{
              uri: IMAGE_ASSETS.mapVisualization,
            }}
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
            <Text className="font-jakarta-sans font-bold text-lg text-on-surface">
              Saved Addresses
            </Text>
            <TouchableOpacity>
              <Text className="text-primary text-sm font-bold">View All</Text>
            </TouchableOpacity>
          </View>

          <View className="gap-4">
            {savedAddresses.map((addr) => (
              <SavedAddressItem
                key={addr.id}
                type={addr.type}
                label={addr.label}
                address={addr.address}
                onPress={() => handleSelectAddress(addr.address, addr.coords)}
              />
            ))}
          </View>
        </View>

        {/* Recent Searches */}
        <View className="mb-8">
          <Text className="font-jakarta-sans font-bold text-lg text-on-surface mb-4">
            Recent Searches
          </Text>
          <View className="gap-2">
            {recentSearches.map((search) => (
              <RecentSearchItem
                key={search.id}
                address={search.address}
                onPress={() => handleSelectAddress(search.address, search.coords)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View
        className="absolute bottom-0 left-0 w-full p-6 bg-white/90 backdrop-blur-xl border-t border-surface-variant/20"
        style={{ paddingBottom: Math.max(insets.bottom, 24) }}
      >
        <TouchableOpacity 
          onPress={handleAddNewAddress}
          className="w-full bg-primary h-14 rounded-full flex-row items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98]"
        >
          <Plus size={24} color="#ffffff" />
          <Text className="text-on-primary font-bold text-base">
            Add New Address
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
