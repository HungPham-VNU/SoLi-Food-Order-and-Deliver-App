import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MapPinPlus, Navigation } from 'lucide-react-native';
import {
  CheckoutHeader,
  DeliveryAddressCard,
  OrderSummaryPreview,
} from '../components';
import type { DeliveryAddressScreenProps } from '../types';
import type { DeliveryAddressOption } from '../components/delivery-address-card';
import { useAddressStore } from '@/src/features/location/store/address-store';
import { useCurrentLocation } from '@/src/features/location/hooks/use-current-location';

const ORDER_PREVIEW_IMAGES = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB9afqEW_EHwkLZwswWeZrsP2Dq-jjLX78dA9Hh9tfe3VqjVRYT-Dkv_reqJhkMwEpwUT2kg6Xguk5dbYoTviXDgkC3mii0CpcBNaWF1rfiGE-JUZHFAiBoYm0_eLLYCBEZkY3F_9fSP0lPpXvEO-ePwSOzhIPOX5rwS2Fsj7tmP_SyDXODRwDh81QiWStBmiWdgIAbjmkv_pFIJtR12n0TUJPH_Bd7CJ5tm8ucPwIiXC3wohz1F2c3FpXyzuMIdEvWtuVXxXGfvYSZ',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDZuTPCjmUB3A7ncwxLTzkYhfPUeovVGovdB0ukXKPzSySPoo6r-wH-f3fEW_2SvsgffZyqXcnc5hiHMwz01MvurRXey7ibncfdbSe0qB8klYyVVyDaqMNza-Z-YjmHg3LxBHSE7njpc4x3Ml932-u0yZ7Gywx2cZ8_dAnyGYFZfNZbhtmKb9_BwKwb1uBBjXabTePXAbnGkmyn3gfwdPUaMnvzo3w5vWBIJG2TBRa_nZ3tIE1go4h8OEV-BxKUuZwf6yCoFivxJYps',
];

export function DeliveryAddressScreen({
  onBack,
  onContinue,
  onAddNewAddress,
  onEditAddress,
  onSelectAddress,
}: DeliveryAddressScreenProps) {
  const insets = useSafeAreaInsets();
  const { savedAddresses, setSelectedAddress, selectedAddress } =
    useAddressStore();
  const { locate, isLocating } = useCurrentLocation();

  const addressOptions = useMemo((): DeliveryAddressOption[] => {
    return savedAddresses.map((addr) => ({
      id: addr.id,
      label: addr.label,
      isDefault: addr.type === 'home',
      lines: [addr.address],
      phone: addr.phone || '',
    }));
  }, [savedAddresses]);

  const [selectedId, setSelectedId] = useState(
    addressOptions.find((opt) => opt.lines[0] === selectedAddress)?.id ?? '',
  );

  const headerHeight = useMemo(() => insets.top + 64, [insets.top]);
  const footerInset = Math.max(insets.bottom, 16);
  const footerHeight = 112 + footerInset;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const selected = savedAddresses.find((addr) => addr.id === id);
    if (selected) {
      setSelectedAddress(selected.address, selected.coords);
    }
    onSelectAddress?.(id);
  };

  const handleUseCurrentLocation = async () => {
    const result = await locate();
    if (result) {
      setSelectedAddress(result.label, result.coords);
      setSelectedId('current'); // Temporary ID for current location visual
      if (onContinue) {
        onContinue();
      } else {
        router.back();
      }
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      <CheckoutHeader onBack={handleBack} />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: headerHeight + 16,
          paddingBottom: footerHeight + 24,
          paddingHorizontal: 16,
          gap: 18,
        }}
      >
        <View className="gap-2">
          <Text
            className="text-on-surface text-2xl"
            style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}
          >
            Where should we send your harvest?
          </Text>
          <Text
            className="text-on-surface-variant text-sm"
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            Select a saved address or add a new delivery location.
          </Text>
        </View>

        <View className="gap-4">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleUseCurrentLocation}
            disabled={isLocating}
            className="flex-row items-center gap-3 bg-primary/5 p-4 rounded-2xl border border-primary/10"
          >
            <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
              {isLocating ? (
                <ActivityIndicator size="small" color="#0d631b" />
              ) : (
                <Navigation size={20} color="#0d631b" />
              )}
            </View>
            <View className="flex-1">
              <Text
                className="text-on-surface text-base"
                style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
              >
                Use Current Location
              </Text>
              <Text
                className="text-on-surface-variant text-xs"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                {isLocating ? 'Locating...' : 'Using GPS for precise delivery'}
              </Text>
            </View>
          </TouchableOpacity>

          {addressOptions.map((address) => (
            <DeliveryAddressCard
              key={address.id}
              address={address}
              selected={selectedId === address.id}
              onSelect={() => handleSelect(address.id)}
              onEdit={
                onEditAddress ? () => onEditAddress(address.id) : undefined
              }
            />
          ))}

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={onAddNewAddress}
            className="border-2 border-outline-variant rounded-[20px] items-center justify-center py-5 gap-2"
            style={{ borderStyle: 'dashed' }}
          >
            <MapPinPlus size={26} color="#707a6c" />
            <Text
              className="text-on-surface-variant text-sm"
              style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
            >
              Add New Address
            </Text>
          </TouchableOpacity>
        </View>

        <OrderSummaryPreview
          previewImages={ORDER_PREVIEW_IMAGES}
          remainingCount={4}
        />
      </ScrollView>
    </View>
  );
}
