import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Briefcase,
  Clock3,
  Home,
  LocateFixed,
  Map,
  MapPin,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScrollView } from '@/src/components/keyboard-aware-scroll-view';
import { keyboardAvoidingBehavior } from '@/src/lib/keyboard';
import { useAddressSearch, useCurrentLocation } from '../hooks';
import type { SavedAddress } from '../store/address-store';
import { useAddressStore } from '../store/address-store';

type LocationTab = 'recent' | 'saved';

interface LocationRowProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconClassName?: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

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
    </TouchableOpacity>
  );
}

function SavedAddressIcon({ type }: { type: SavedAddress['type'] }) {
  if (type === 'home') return <Home size={20} color="#0d631b" />;
  if (type === 'work') return <Briefcase size={20} color="#0d631b" />;
  return <Star size={20} color="#0d631b" />;
}

function SavedAddressRow({
  item,
  onPress,
  onEdit,
  onDelete,
}: {
  item: SavedAddress;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View
      className="relative overflow-hidden rounded-xl border border-surface-container-low bg-surface-container-lowest"
      style={{
        shadowColor: 'rgba(26,28,28,1)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 12,
        elevation: 1,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        className="flex-row items-start gap-4 p-4 pr-20 active:bg-surface-container-low"
        accessibilityRole="button"
        accessibilityLabel={`${item.label}: ${item.address}`}
      >
        <View className="mt-1 h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed/20">
          <SavedAddressIcon type={item.type} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="mb-0.5 font-jakarta-sans text-base font-bold text-on-surface">
            {item.label}
          </Text>
          <Text
            className="font-inter text-sm leading-relaxed text-on-surface-variant"
            numberOfLines={2}
          >
            {item.address}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Action buttons */}
      <View className="absolute right-3 top-3 flex-row gap-1">
        <TouchableOpacity
          onPress={onEdit}
          className="rounded-full p-2 active:bg-surface-container"
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.label}`}
        >
          <Pencil size={18} color="#40493d" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          className="rounded-full p-2 active:bg-error/10"
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.label}`}
        >
          <Trash2 size={18} color="#ba1a1a" />
        </TouchableOpacity>
      </View>
    </View>
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
    addRecentSearch,
    removeSavedAddress,
    clearRecentSearches,
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
    subtitle?: string,
    label?: string,
  ) => {
    setSelectedAddress(address, coords);
    addRecentSearch(address, coords, subtitle, label);
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
    addRecentSearch(result.label, result.coords);
    router.back();
  };

  const handleChooseOnMap = () => {
    Alert.alert('Choose on Map', 'Map picker feature coming soon!');
  };

  const handleDeleteSaved = (id: string, label: string) => {
    Alert.alert(
      'Remove Saved Address',
      `Remove "${label}" from your saved places?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeSavedAddress(id),
        },
      ],
    );
  };

  const handleEditSaved = (_id: string) => {
    // Navigate to add-location with pre-filled data (future enhancement)
    router.navigate('/(customer)/add-location');
  };

  const handleClearRecent = () => {
    Alert.alert('Clear Recent', 'Clear all recent searches?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearRecentSearches },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={keyboardAvoidingBehavior}
      className="flex-1 bg-surface"
    >
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
            <MapPin size={21} color="#00490e" />
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

      <View className="z-10 mt-2 border-b border-surface-container-highest bg-surface pb-2">
        <View className="flex-row">
          {(['recent', 'saved'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                className="relative flex-1 items-center pb-2"
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

      <KeyboardAwareScrollView
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
                  handleSelectAddress(
                    result.label,
                    {
                      latitude: result.latitude,
                      longitude: result.longitude,
                    },
                    result.subtitle || undefined,
                  )
                }
              />
            ))}
          </View>
        ) : activeTab === 'recent' ? (
          <View className="gap-2">
            {recentSearches.length > 0 ? (
              <>
                <View className="flex-row items-center justify-between px-1">
                  <Text className="font-jakarta-sans text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Recent
                  </Text>
                  <TouchableOpacity
                    onPress={handleClearRecent}
                    accessibilityRole="button"
                    accessibilityLabel="Clear recent searches"
                  >
                    <Text className="font-inter text-xs text-primary">
                      Clear all
                    </Text>
                  </TouchableOpacity>
                </View>
                {recentSearches.map((search) => {
                  let title: string;
                  let subtitle: string;
                  if (search.label) {
                    title = search.label;
                    subtitle = search.address;
                  } else if (search.subtitle) {
                    title = search.address;
                    subtitle = search.subtitle;
                  } else {
                    const commaIdx = search.address.indexOf(',');
                    title =
                      commaIdx !== -1
                        ? search.address.slice(0, commaIdx).trim()
                        : search.address;
                    subtitle =
                      commaIdx !== -1
                        ? search.address.slice(commaIdx + 1).trim()
                        : 'Recent search';
                  }
                  return (
                    <LocationRow
                      key={search.id}
                      title={title}
                      subtitle={subtitle}
                      icon={<Clock3 size={21} color="#40493d" />}
                      onPress={() =>
                        handleSelectAddress(search.address, search.coords)
                      }
                    />
                  );
                })}
              </>
            ) : (
              <View className="items-center py-12 gap-3">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-surface-container">
                  <Clock3 size={28} color="#9ca3af" />
                </View>
                <Text className="font-jakarta-sans text-base font-semibold text-on-surface-variant">
                  No recent searches
                </Text>
                <Text className="text-center font-inter text-sm text-on-surface-variant">
                  Addresses you pick will appear here
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View className="mt-2 gap-2">
            {/* Add new saved place */}
            <TouchableOpacity
              onPress={() => router.navigate('/(customer)/add-location' as any)}
              className="flex-row items-center gap-4 rounded-xl border border-transparent p-4 active:border-surface-container-highest active:bg-surface-container-lowest"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-fixed/30">
                <Plus size={20} color="#0d631b" />
              </View>
              <Text className="flex-1 font-jakarta-sans text-base font-semibold text-primary-container">
                Add new saved place
              </Text>
            </TouchableOpacity>

            {savedAddresses.length > 0 ? (
              <>
                <View className="mx-4 my-2 h-px border-t-2 border-surface-container" />
                {savedAddresses.map((item) => (
                  <SavedAddressRow
                    key={item.id}
                    item={item}
                    onPress={() =>
                      handleSelectAddress(
                        item.address,
                        item.coords,
                        undefined,
                        item.label,
                      )
                    }
                    onEdit={() => handleEditSaved(item.id)}
                    onDelete={() => handleDeleteSaved(item.id, item.label)}
                  />
                ))}
              </>
            ) : (
              <View className="items-center py-12 gap-3">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-surface-container">
                  <MapPin size={28} color="#9ca3af" />
                </View>
                <Text className="font-jakarta-sans text-base font-semibold text-on-surface-variant">
                  No saved places yet
                </Text>
                <Text className="text-center font-inter text-sm text-on-surface-variant">
                  Tap &quot;Add new saved place&quot; to get started
                </Text>
              </View>
            )}
          </View>
        )}
      </KeyboardAwareScrollView>

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
    </KeyboardAvoidingView>
  );
}
