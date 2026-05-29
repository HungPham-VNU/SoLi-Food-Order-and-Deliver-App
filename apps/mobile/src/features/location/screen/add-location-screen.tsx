import React, { useState } from 'react';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAddressStore } from '../store/address-store';

export function AddLocationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { selectedAddress, latitude, longitude, addSavedAddress } =
    useAddressStore();

  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [note, setNote] = useState('');

  const isFormValid = name.trim().length > 0;

  const handleSave = () => {
    if (!isFormValid) return;
    
    // Determine the type
    const lowerName = name.trim().toLowerCase();
    const type = lowerName.includes('home')
      ? 'home'
      : lowerName.includes('work') || lowerName.includes('office')
      ? 'work'
      : 'other';
      
    // Combine details into the address if available
    const finalAddress = details
      ? `${selectedAddress} - ${details}`
      : selectedAddress;

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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 80 }}
        showsVerticalScrollIndicator={false}
      >
        <ImageBackground
          source={{
            uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD66an3copWVOE-ph-lqxJ8R5dqKYsFP-AfzjzCpOM24Sdex-dMOdWcUWMVB_udWx7HvTkm_BGsdBGZXzoV8d_VXtQJEE5YzjIhgUDbT33P8iMb2LtYC0T3UfC80vQHiN-pNWueNakz3eKihyT-0VHko-tOyAj4t0ON-ARv1I2qdzsO41HlUBrlbELKgeyiwJpWq8Ze23z_1vuOVMnAROJUQ0xdDs9MZnlykoiVEGunTPA_WNwwOscin7IUNQmMwbyrX2DQflTFDC5n',
          }}
          className="relative h-48 w-full"
        >
          <View className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center">
            <View className="z-10 h-12 w-12 items-center justify-center rounded-full bg-error shadow-lg">
              <MapPin size={24} color="#ffffff" fill="#ffffff" />
            </View>
            <View className="mt-1 h-3 w-3 scale-y-50 rounded-full bg-black/20" />
          </View>
          <LinearGradient
            colors={['transparent', '#ffffff']}
            className="absolute bottom-0 left-0 right-0 h-8"
          />
        </ImageBackground>

        <View className="gap-6 px-5 py-6">
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

          <View className="gap-2">
            <Text className="font-jakarta-sans text-base font-semibold text-on-surface">
              <Text className="text-error">*</Text> Address
            </Text>
            <View className="flex-row items-center rounded-xl border border-surface-variant bg-surface-container-lowest p-4 shadow-sm">
              <View className="mr-4 shrink-0">
                <View className="h-6 w-6 items-center justify-center rounded-full border-2 border-error bg-surface-container-lowest">
                  <View className="h-2.5 w-2.5 rounded-full bg-error" />
                </View>
              </View>
              <View className="flex-1 overflow-hidden">
                <Text
                  className="truncate font-jakarta-sans text-base font-bold text-on-surface"
                  numberOfLines={1}
                >
                  {selectedAddress ? selectedAddress.split(',')[0] : 'Pick Up/Drop Off Gate'}
                </Text>
                <Text
                  className="mt-0.5 truncate font-inter text-sm text-on-surface-variant"
                  numberOfLines={1}
                >
                  {selectedAddress || 'Thống Nhất, P.Đông Hòa, TP.Hồ Chí Minh'}
                </Text>
              </View>
            </View>
          </View>

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
      </ScrollView>

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
