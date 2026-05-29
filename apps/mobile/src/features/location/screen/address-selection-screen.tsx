import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Clock3,
  FileEdit,
  Home,
  LocateFixed,
  Map,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Search,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAddressSearch, useCurrentLocation } from '../hooks';
import { useAddressStore } from '../store/address-store';

type LocationTab = 'recent' | 'saved';

type LocationListItem = {
  id: string;
  title: string;
  subtitle: string;
  address: string;
  coords?: { latitude: number; longitude: number } | null;
};

interface LocationRowProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconClassName?: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

const DEFAULT_RECENT_LOCATIONS: LocationListItem[] = [
  {
    id: 'bcons-plaza',
    title: 'Bcons Plaza Apartment',
    subtitle: '0.08km - Thong Nhat, Dong Hoa Ward',
    address: 'Bcons Plaza Apartment, Thong Nhat, Dong Hoa Ward',
  },
  {
    id: 'mien-dong-station',
    title: 'Mien Dong New Coach Station',
    subtitle: '2.98km - Xa Lo Ha Noi, Long Binh',
    address: 'Mien Dong New Coach Station, Xa Lo Ha Noi, Long Binh',
  },
  {
    id: 'national-university',
    title: 'National University Station',
    subtitle: '3.14km - Song Hanh Xa Lo Ha Noi',
    address: 'National University Station, Song Hanh Xa Lo Ha Noi',
  },
  {
    id: 'm-one-south-saigon',
    title: 'M-One South Saigon',
    subtitle: '18km - Huynh Tan Phat, District 7',
    address: 'M-One South Saigon, Huynh Tan Phat, District 7',
  },
];

function LocationRow({
  title,
  subtitle,
  icon,
  iconClassName = 'bg-surface-container',
  onPress,
  disabled,
  testID,
}: LocationRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-start gap-4 rounded-3xl bg-surface-container-lowest p-4 active:bg-surface-container-low"
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
    >
      <View
        className={`h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
      >
        {icon}
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="font-jakarta-sans text-base font-semibold text-on-surface"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          className="mt-0.5 text-sm text-on-surface-variant"
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
      <View className="p-1">
        <MoreVertical size={20} color="#40493d" />
      </View>
    </TouchableOpacity>
  );
}

export function AddressSelectionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const searchInputRef = useRef<TextInput>(null);
  const [activeTab, setActiveTab] = useState<LocationTab>('recent');
  const {
    setSelectedAddress,
    latitude,
    longitude,
    savedAddresses,
    recentSearches,
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

  const handleChooseOnMap = () => {
    Alert.alert('Choose on Map', 'Map picker feature coming soon!');
  };

  const recentLocations: LocationListItem[] =
    recentSearches.length > 0
      ? recentSearches.map((search) => ({
          id: search.id,
          title: search.address,
          subtitle: 'Recent search',
          address: search.address,
          coords: search.coords,
        }))
      : DEFAULT_RECENT_LOCATIONS;

  return (
    <View className="flex-1 bg-surface">
      <View
        className="z-10 bg-surface px-4 pb-3"
        style={{ paddingTop: Math.max(insets.top, 12) + 8 }}
      >
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-container-low"
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID="back-button"
          >
            <ArrowLeft size={24} color="#40493d" />
          </TouchableOpacity>
          <Text className="font-jakarta-sans text-lg font-bold text-on-surface">
            Select Location
          </Text>
          <TouchableOpacity
            onPress={() => searchInputRef.current?.focus()}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-container-low"
            accessibilityRole="button"
            accessibilityLabel="Focus search"
          >
            <Search size={22} color="#40493d" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="z-10 bg-surface px-4 pb-4 pt-2">
        <View className="relative justify-center">
          <View className="pointer-events-none absolute left-4 z-10">
            <MapPin size={21} color="#00490e" fill="#00490e" />
          </View>
          <TextInput
            ref={searchInputRef}
            className="h-14 w-full rounded-full border-2 border-primary-fixed bg-surface-container-lowest px-12 text-sm font-medium text-on-surface"
            placeholder="Search for area, street name..."
            placeholderTextColor="#40493d"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
        </View>
      </View>

      <View className="z-10 mt-2 border-b border-surface-container-highest bg-surface px-2 pb-2">
        <View className="flex-row gap-4">
          {(['recent', 'saved'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                className="relative px-2 pb-2"
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  className={`font-jakarta-sans text-base font-semibold ${
                    isActive ? 'text-primary' : 'text-on-surface-variant'
                  }`}
                >
                  {tab === 'recent' ? 'Recent' : 'Saved'}
                </Text>
                {isActive && (
                  <View className="absolute bottom-[-9px] left-0 h-[3px] w-full rounded-t-full bg-primary" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 24) + 120,
          gap: 8,
        }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <LocationRow
          title={isLocating ? 'Fetching your location' : 'Current location'}
          subtitle={
            isLocating
              ? 'This may take a moment'
              : 'Using GPS for exact location...'
          }
          icon={
            isLocating ? (
              <ActivityIndicator size="small" color="#00490e" />
            ) : (
              <LocateFixed size={22} color="#00490e" />
            )
          }
          iconClassName="bg-primary-fixed/20"
          onPress={handleUseCurrentLocation}
          disabled={isLocating}
          testID="use-current-location"
        />

        {locationError ? (
          <Text className="px-4 py-1 text-xs text-error" selectable>
            {locationError}
          </Text>
        ) : null}

        <View className="mx-4 my-2 h-px bg-surface-container-high" />

        {shouldSearch ? (
          <View className="gap-2">
            {isSearching ? (
              <View className="flex-row items-center gap-2 px-4 py-3">
                <ActivityIndicator size="small" color="#00490e" />
                <Text className="text-sm text-on-surface-variant">
                  Searching addresses...
                </Text>
              </View>
            ) : null}
            {searchError ? (
              <Text className="px-4 text-xs text-error" selectable>
                {searchError}
              </Text>
            ) : null}
            {!isSearching && !searchError && searchResults.length === 0 ? (
              <Text className="px-4 py-3 text-sm text-on-surface-variant">
                No matches found.
              </Text>
            ) : null}
            {searchResults.map((result) => (
              <LocationRow
                key={result.id}
                title={result.label}
                subtitle={result.subtitle || 'Search result'}
                icon={<MapPin size={21} color="#40493d" />}
                onPress={() =>
                  handleSelectAddress(result.label, {
                    latitude: result.latitude,
                    longitude: result.longitude,
                  })
                }
              />
            ))}
          </View>
        ) : activeTab === 'recent' ? (
          <View className="gap-2">
            {recentLocations.map((location) => (
              <LocationRow
                key={location.id}
                title={location.title}
                subtitle={location.subtitle}
                icon={<Clock3 size={21} color="#40493d" fill="#40493d" />}
                onPress={() =>
                  handleSelectAddress(location.address, location.coords ?? null)
                }
              />
            ))}
          </View>
        ) : (
          <View className="mt-2 gap-2">
            <TouchableOpacity
              onPress={() => router.push('/(customer)/add-location')}
              className="flex-row items-center gap-4 rounded-xl border border-transparent p-4 active:border-surface-container-highest active:bg-surface-container-lowest"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-fixed/30">
                <Plus size={20} color="#0d631b" />
              </View>
              <Text className="flex-1 font-jakarta-sans text-base font-semibold text-primary-container">
                Add new
              </Text>
            </TouchableOpacity>

            <View className="mx-4 my-2 h-px border-t-2 border-surface-container" />

            <TouchableOpacity
              onPress={() => {}}
              className="relative flex-row items-start gap-4 overflow-hidden rounded-xl border border-surface-container-low bg-surface-container-lowest p-4 active:bg-surface-container-lowest"
              style={{
                boxShadow: '0 2px 12px 0 rgba(26,28,28,0.03)',
              }}
            >
              <View className="mt-1 h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-low">
                <Home size={20} color="#0d631b" fill="#0d631b" />
              </View>
              <View className="min-w-0 flex-1 pr-8">
                <Text className="mb-1 font-jakarta-sans text-lg font-bold text-on-surface">
                  Home
                </Text>
                <Text
                  className="mb-3 font-inter text-sm leading-relaxed text-on-surface-variant"
                  numberOfLines={2}
                >
                  66km • 21 Do Luong St., 21 Do Luong, Phuoc Thang Ward, Ho Chi
                  Minh...
                </Text>
                <View className="mt-2 flex-col gap-2">
                  <View className="flex-row items-center gap-2">
                    <Building2 size={16} color="#40493d" />
                    <Text className="font-inter text-sm text-on-surface-variant">
                      Floor / unit no.
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <FileEdit size={16} color="#40493d" />
                    <Text className="font-inter text-sm text-on-surface-variant">
                      Note to driver
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity className="absolute right-4 top-4 rounded-full p-2 active:bg-surface-container">
                <Pencil size={20} color="#40493d" />
              </TouchableOpacity>
            </TouchableOpacity>

            <View className="mx-4 my-2 h-px border-t-2 border-surface-container" />

            <TouchableOpacity
              onPress={() => {}}
              className="flex-row items-center gap-4 rounded-xl border border-transparent p-4 active:border-surface-container-highest active:bg-surface-container-lowest"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-container">
                <Briefcase size={20} color="#0d631b" fill="#0d631b" />
              </View>
              <Text className="flex-1 font-jakarta-sans text-base font-semibold text-primary-container">
                Add work
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <LinearGradient
        colors={['rgba(249,249,249,0)', '#f9f9f9']}
        pointerEvents="none"
        className="absolute bottom-0 left-0 right-0 h-32"
      />

      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0 items-center px-6"
        style={{ bottom: Math.max(insets.bottom, 24) }}
      >
        <TouchableOpacity
          onPress={handleChooseOnMap}
          className="flex-row items-center gap-2 rounded-full border border-surface-container bg-surface-container-lowest px-6 py-3.5 active:bg-surface-container-low"
          style={{
            boxShadow: '0 8px 32px rgba(26, 28, 28, 0.12)',
          }}
          accessibilityRole="button"
          accessibilityLabel="Choose on Map"
        >
          <Map size={21} color="#1a1c1c" />
          <Text className="font-jakarta-sans text-sm font-bold text-on-surface">
            Choose on Map
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
