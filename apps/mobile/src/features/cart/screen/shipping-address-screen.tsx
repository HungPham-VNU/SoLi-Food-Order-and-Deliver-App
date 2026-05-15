import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MapPinPlus } from 'lucide-react-native';
import {
  CheckoutHeader,
  CheckoutFooter,
  CheckoutProgress,
  ShippingAddressCard,
  OrderSummaryPreview,
} from '../components';
import type { ShippingAddressScreenProps } from '../types';
import type { ShippingAddressOption } from '../components/shipping-address-card';

const ADDRESS_OPTIONS: ShippingAddressOption[] = [
  {
    id: 'home',
    label: 'Home',
    isDefault: true,
    lines: ['1242 Orchard Lane', 'Green Valley, CA 90210'],
    phone: '(555) 012-3456',
  },
  {
    id: 'studio',
    label: 'Creative Studio',
    lines: ['88 Artisans Way, Suite 400', 'Downtown District, CA 90211'],
    phone: '(555) 098-7654',
  },
];

const ORDER_PREVIEW_IMAGES = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB9afqEW_EHwkLZwswWeZrsP2Dq-jjLX78dA9Hh9tfe3VqjVRYT-Dkv_reqJhkMwEpwUT2kg6Xguk5dbYoTviXDgkC3mii0CpcBNaWF1rfiGE-JUZHFAiBoYm0_eLLYCBEZkY3F_9fSP0lPpXvEO-ePwSOzhIPOX5rwS2Fsj7tmP_SyDXODRwDh81QiWStBmiWdgIAbjmkv_pFIJtR12n0TUJPH_Bd7CJ5tm8ucPwIiXC3wohz1F2c3FpXyzuMIdEvWtuVXxXGfvYSZ',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDZuTPCjmUB3A7ncwxLTzkYhfPUeovVGovdB0ukXKPzSySPoo6r-wH-f3fEW_2SvsgffZyqXcnc5hiHMwz01MvurRXey7ibncfdbSe0qB8klYyVVyDaqMNza-Z-YjmHg3LxBHSE7njpc4x3Ml932-u0yZ7Gywx2cZ8_dAnyGYFZfNZbhtmKb9_BwKwb1uBBjXabTePXAbnGkmyn3gfwdPUaMnvzo3w5vWBIJG2TBRa_nZ3tIE1go4h8OEV-BxKUuZwf6yCoFivxJYps',
];

const ORDER_TOTAL = 42.85;

export function ShippingAddressScreen({
  onBack,
  onContinue,
  onAddNewAddress,
  onEditAddress,
  onSelectAddress,
}: ShippingAddressScreenProps) {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState(ADDRESS_OPTIONS[0]?.id ?? '');

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
    onSelectAddress?.(id);
  };

  const handleContinue = () => {
    if (onContinue) {
      onContinue(selectedId);
    } else {
      router.push('/(customer)/checkout/payment');
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
          {ADDRESS_OPTIONS.map((address) => (
            <ShippingAddressCard
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

      <CheckoutFooter
        total={ORDER_TOTAL}
        actionLabel="Continue to Payment"
        onAction={handleContinue}
      />
    </View>
  );
}
