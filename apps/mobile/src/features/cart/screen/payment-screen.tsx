import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Banknote, PlusCircle, Smartphone } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { CheckoutHeader, PaymentMethodCard } from '../components';
import { useCheckoutStore } from '../store/checkout-store';
import type { PaymentScreenProps, PaymentMethod } from '../types';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const SAVED_CARDS: PaymentMethod[] = [
  {
    id: 'card-4242',
    brand: 'Visa',
    last4: '4242',
    expiry: '12/26',
    type: 'card',
  },
  {
    id: 'card-8812',
    brand: 'Mastercard',
    last4: '8812',
    expiry: '08/25',
    type: 'card',
  },
];

const GoogleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </Svg>
);

type PaymentOptionData = {
  id: string;
  label: string;
  tone: 'dark' | 'neutral' | 'soft' | 'surface';
  icon: React.ReactNode;
  method: PaymentMethod;
};

const OTHER_METHODS: PaymentOptionData[] = [
  {
    id: 'apple-pay',
    label: 'Apple Pay',
    tone: 'dark',
    icon: <Smartphone size={18} color="#ffffff" />,
    method: {
      id: 'apple-pay',
      brand: 'Apple Pay',
      last4: 'Apple Pay',
      type: 'apple-pay',
    },
  },
  {
    id: 'google-pay',
    label: 'Google Pay',
    tone: 'neutral',
    icon: <GoogleIcon />,
    method: {
      id: 'google-pay',
      brand: 'Google Pay',
      last4: 'Google Pay',
      type: 'google-pay',
    },
  },
  {
    id: 'cash',
    label: 'Cash on Delivery',
    tone: 'soft',
    icon: <Banknote size={18} color="#0d631b" />,
    method: {
      id: 'cash',
      brand: 'Cash',
      last4: 'Cash',
      type: 'cash',
    },
  },
];

export function PaymentScreen({
  onBack,
  onContinue,
  onAddPaymentMethod,
  onSelectPaymentMethod,
}: PaymentScreenProps) {
  const insets = useSafeAreaInsets();
  const { selectedPaymentMethod, setSelectedPaymentMethod } = useCheckoutStore();

  const headerHeight = useMemo(() => insets.top + 64, [insets.top]);
  const footerInset = Math.max(insets.bottom, 16);
  const footerHeight = 120 + footerInset;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handleSelect = (method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    onSelectPaymentMethod?.(method);
    if (onContinue) {
      onContinue(method);
    } else {
      router.back();
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      <View className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-primary/5" />
      <View className="absolute top-1/2 -right-28 w-72 h-72 rounded-full bg-secondary/5" />

      <CheckoutHeader onBack={handleBack} />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: headerHeight + 16,
          paddingBottom: footerHeight + 24,
          paddingHorizontal: 16,
          gap: 32,
        }}
      >
        {/* ── Saved Cards ─────────────────────────────────────────────── */}
        <View className="gap-4">
          <Text
            className="text-on-surface text-xl px-1"
            style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
          >
            Saved Cards
          </Text>
          <View className="gap-4">
            {SAVED_CARDS.map((card) => (
              <PaymentMethodCard
                key={card.id}
                type="card"
                label={`${card.brand} •••• ${card.last4}`}
                subtitle={card.expiry}
                selected={selectedPaymentMethod?.id === card.id}
                onPress={() => handleSelect(card)}
              />
            ))}

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onAddPaymentMethod}
              className="border-2 border-outline-variant rounded-xl items-center justify-center py-4 flex-row gap-2"
              style={{ borderStyle: 'dashed' }}
            >
              <PlusCircle size={20} color="#0d631b" />
              <Text
                className="text-primary text-sm"
                style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
              >
                Add New Card
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Other Payment Methods ───────────────────────────────────── */}
        <View className="gap-4">
          <Text
            className="text-on-surface text-xl px-1"
            style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
          >
            Other Methods
          </Text>
          <View className="gap-3">
            {OTHER_METHODS.map((option) => (
              <PaymentMethodCard
                key={option.id}
                label={option.label}
                icon={option.icon}
                tone={option.tone}
                selected={selectedPaymentMethod?.id === option.id}
                onPress={() => handleSelect(option.method)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
