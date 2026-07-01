import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// Type-only import is safe; the runtime require below is guarded
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, MapPin, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScrollView } from '@/src/components/keyboard-aware-scroll-view';
import { keyboardAvoidingBehavior } from '@/src/lib/keyboard';
import { useAddressSearch } from '../hooks';
import { useAddressStore } from '../store/address-store';

const DEFAULT_LNG = 106.6297;
const DEFAULT_LAT = 10.8231;
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// Guarded require: MapLibre's native module is only available after a native
// rebuild (`expo run:android` / `expo run:ios`). Falls back to null so the
// rest of the app keeps running in the current dev client.
let MLRNMap: React.ComponentType<any> | null = null;
let MLRNCamera: React.ComponentType<any> | null = null;
try {
  // Dynamic require is intentional: static import triggers TurboModuleRegistry
  // synchronously and crashes when the native module isn't compiled in yet.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ml = require('@maplibre/maplibre-react-native') as typeof import('@maplibre/maplibre-react-native');
  MLRNMap = ml.Map as unknown as React.ComponentType<any>;
  MLRNCamera = ml.Camera as unknown as React.ComponentType<any>;
} catch {
  // Native module not linked yet — show placeholder until app is rebuilt
}

export function AddLocationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const addressInputRef = useRef<TextInput>(null);
  const cameraRef = useRef<CameraRef>(null);
  const { selectedAddress, latitude, longitude, setSelectedAddress, addSavedAddress } =
    useAddressStore();

  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [note, setNote] = useState('');
  const [isAddressFocused, setIsAddressFocused] = useState(false);

  const {
    query: addressQuery,
    setQuery: setAddressQuery,
    results: addressResults,
    isSearching: isAddressSearching,
    error: addressSearchError,
    shouldSearch,
  } = useAddressSearch({ latitude, longitude });

  // Fly the camera to the selected address coordinates
  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      cameraRef.current?.flyTo({
        center: [longitude, latitude],
        zoom: 15,
        duration: 800,
      });
    }
  }, [latitude, longitude]);

  const showDropdown = isAddressFocused && (shouldSearch || isAddressSearching);

  const handleSelectAddress = (address: string, coords?: { latitude: number; longitude: number }) => {
    setSelectedAddress(address, coords ?? null);
    setAddressQuery(address);
    setIsAddressFocused(false);
    addressInputRef.current?.blur();
  };

  const handleClearAddress = () => {
    setAddressQuery('');
    setSelectedAddress('', null);
    addressInputRef.current?.focus();
  };

  const isFormValid =
    name.trim().length > 0 &&
    selectedAddress.length > 0 &&
    latitude !== null &&
    longitude !== null;

  const handleSave = () => {
    if (!isFormValid || latitude === null || longitude === null) return;

    const lowerName = name.trim().toLowerCase();
    const type = lowerName.includes('home')
      ? 'home'
      : lowerName.includes('work') || lowerName.includes('office')
      ? 'work'
      : 'other';

    const resolvedAddress = selectedAddress || addressQuery.trim();
    const finalAddress = details
      ? `${resolvedAddress} - ${details}`
      : resolvedAddress;

    addSavedAddress({
      type,
      label: name.trim(),
      address: finalAddress || 'Unknown Location',
      coords: {
        latitude: latitude ?? 0,
        longitude: longitude ?? 0,
      },
    });

    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={keyboardAvoidingBehavior}
      className="flex-1 bg-surface-container-lowest"
    >
      <View
        className="z-10 flex-row items-center justify-between bg-surface-container-lowest px-4 pb-3"
        style={{ paddingTop: Math.max(insets.top, 12) + 8 }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-container-low"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={24} color="#1a1c1c" />
        </TouchableOpacity>
        <Text className="flex-1 pr-10 text-center font-jakarta-sans text-xl font-bold text-on-surface">
          Add to Saved Places
        </Text>
      </View>

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="relative h-48 w-full overflow-hidden">
          {MLRNMap && MLRNCamera ? (
            <MLRNMap
              mapStyle={MAP_STYLE}
              style={{ flex: 1 }}
              compass={false}
              scaleBar={false}
              attribution
              attributionPosition={{ bottom: 4, right: 4 }}
              logo={false}
              dragPan={false}
              touchZoom={false}
              touchRotate={false}
              touchPitch={false}
              doubleTapZoom={false}
            >
              <MLRNCamera
                ref={cameraRef}
                initialViewState={{
                  center: [
                    longitude ?? DEFAULT_LNG,
                    latitude ?? DEFAULT_LAT,
                  ],
                  zoom: latitude !== null && longitude !== null ? 15 : 12,
                }}
              />
            </MLRNMap>
          ) : (
            <View className="flex-1 items-center justify-center bg-surface-container">
              <Text className="font-inter text-xs text-on-surface-variant">
                Map requires a native rebuild
              </Text>
            </View>
          )}

          {/* Centered pin marker overlay */}
          <View
            className="absolute inset-0 items-center justify-center"
            pointerEvents="none"
          >
            <View className="z-10 h-12 w-12 items-center justify-center rounded-full bg-error shadow-lg">
              <MapPin size={24} color="#ffffff" />
            </View>
            <View className="mt-1 h-3 w-3 scale-y-50 rounded-full bg-black/20" />
          </View>

          <LinearGradient
            colors={['transparent', '#ffffff']}
            className="absolute bottom-0 left-0 right-0 h-8"
            pointerEvents="none"
          />
        </View>

        <View className="gap-6 px-5 py-6">
          {/* Name field */}
          <View className="gap-2">
            <Text className="font-jakarta-sans text-base font-semibold text-on-surface">
              <Text className="text-error">*</Text> Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Gym / School"
              placeholderTextColor="#9ca3af"
              className="w-full rounded-xl border border-surface-variant bg-surface-container-lowest px-4 py-3.5 font-inter text-base text-on-surface focus:border-primary-container"
            />
            <Text className="pl-1 font-inter text-sm text-on-surface-variant">
              Label this address for easy reference
            </Text>
          </View>

          {/* Address search field */}
          <View className="gap-2">
            <Text className="font-jakarta-sans text-base font-semibold text-on-surface">
              <Text className="text-error">*</Text> Address
            </Text>

            {/* Search input */}
            <View className="relative">
              <View className="pointer-events-none absolute left-4 top-0 bottom-0 z-10 justify-center">
                <Search size={18} color="#40493d" />
              </View>
              <TextInput
                ref={addressInputRef}
                value={addressQuery}
                onChangeText={(text) => {
                  setAddressQuery(text);
                  if (selectedAddress && text !== selectedAddress) {
                    setSelectedAddress('', null);
                  }
                }}
                onFocus={() => setIsAddressFocused(true)}
                onBlur={() => {
                  // Small delay so tap on result registers before blur hides dropdown
                  setTimeout(() => setIsAddressFocused(false), 150);
                }}
                placeholder="Search for area, street name..."
                placeholderTextColor="#9ca3af"
                returnKeyType="search"
                className="h-14 w-full rounded-xl border border-surface-variant bg-surface-container-lowest pl-11 pr-11 font-inter text-base text-on-surface focus:border-primary-container"
              />
              {addressQuery.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearAddress}
                  className="absolute right-3 top-0 bottom-0 justify-center px-1"
                  accessibilityLabel="Clear address"
                >
                  <X size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            {/* Search results dropdown */}
            {showDropdown && (
              <View className="overflow-hidden rounded-xl border border-surface-variant bg-surface-container-lowest shadow-sm">
                {isAddressSearching ? (
                  <View className="flex-row items-center gap-2 px-4 py-3">
                    <ActivityIndicator size="small" color="#00490e" />
                    <Text className="font-inter text-sm text-on-surface-variant">
                      Searching addresses...
                    </Text>
                  </View>
                ) : addressSearchError ? (
                  <Text className="px-4 py-3 font-inter text-sm text-error">
                    {addressSearchError}
                  </Text>
                ) : addressResults.length === 0 ? (
                  <Text className="px-4 py-3 font-inter text-sm text-on-surface-variant">
                    No matches found.
                  </Text>
                ) : (
                  addressResults.map((result, index) => (
                    <TouchableOpacity
                      key={result.id}
                      onPress={() =>
                        handleSelectAddress(result.label, {
                          latitude: result.latitude,
                          longitude: result.longitude,
                        })
                      }
                      className={`flex-row items-start gap-3 px-4 py-3 active:bg-surface-container-low ${
                        index < addressResults.length - 1
                          ? 'border-b border-surface-container'
                          : ''
                      }`}
                    >
                      <MapPin size={18} color="#00490e" style={{ marginTop: 2 }} />
                      <View className="flex-1">
                        <Text
                          className="font-jakarta-sans text-sm font-semibold text-on-surface"
                          numberOfLines={1}
                        >
                          {result.label}
                        </Text>
                        {result.subtitle ? (
                          <Text
                            className="mt-0.5 font-inter text-xs text-on-surface-variant"
                            numberOfLines={1}
                          >
                            {result.subtitle}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {/* Selected address confirmation chip */}
            {selectedAddress.length > 0 && !isAddressFocused && (
              <View className="flex-row items-center gap-3 rounded-xl border border-surface-variant bg-surface-container-lowest p-4 shadow-sm">
                <View className="mr-1 shrink-0">
                  <View className="h-6 w-6 items-center justify-center rounded-full border-2 border-error bg-surface-container-lowest">
                    <View className="h-2.5 w-2.5 rounded-full bg-error" />
                  </View>
                </View>
                <View className="flex-1 overflow-hidden">
                  <Text
                    className="truncate font-jakarta-sans text-base font-bold text-on-surface"
                    numberOfLines={1}
                  >
                    {selectedAddress.split(',')[0]}
                  </Text>
                  <Text
                    className="mt-0.5 truncate font-inter text-sm text-on-surface-variant"
                    numberOfLines={1}
                  >
                    {selectedAddress}
                  </Text>
                </View>
              </View>
            )}

            <Text className="pl-1 font-inter text-sm text-on-surface-variant">
              Search and select your delivery address
            </Text>
          </View>

          {/* Address details */}
          <View className="gap-2">
            <Text className="font-jakarta-sans text-base font-semibold text-on-surface">
              Address details
            </Text>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="e.g. Floor, unit number"
              placeholderTextColor="#9ca3af"
              className="w-full rounded-xl border border-surface-variant bg-surface-container-lowest px-4 py-3.5 font-inter text-base text-on-surface focus:border-primary-container"
            />
            <Text className="pl-1 font-inter text-sm text-on-surface-variant">
              Enter details of the address for deliveries
            </Text>
          </View>

          {/* Note to driver */}
          <View className="gap-2">
            <Text className="font-jakarta-sans text-base font-semibold text-on-surface">
              Note to driver
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Meet me at the lobby"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={2}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
              className="w-full rounded-xl border border-surface-variant bg-surface-container-lowest px-4 py-3.5 font-inter text-base text-on-surface focus:border-primary-container"
            />
            <Text className="pl-1 font-inter text-sm text-on-surface-variant">
              Put delivery instructions or directions here
            </Text>
          </View>
        </View>
      </KeyboardAwareScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 z-20 border-t border-surface-container-high bg-surface-container-lowest p-5"
        style={{ paddingBottom: Math.max(insets.bottom, 20) }}
      >
        <TouchableOpacity
          onPress={handleSave}
          disabled={!isFormValid}
          className={`w-full items-center justify-center rounded-full py-4 shadow-sm transition-colors ${
            isFormValid ? 'bg-primary-container' : 'bg-surface-variant'
          }`}
        >
          <Text
            className={`font-jakarta-sans text-lg font-bold ${
              isFormValid ? 'text-on-primary' : 'text-on-surface-variant'
            }`}
          >
            Save Address
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
