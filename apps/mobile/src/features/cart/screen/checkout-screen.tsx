import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useCheckout } from '../hooks';
import {
  CheckoutHeader,
  CheckoutDeliverySection,
  CheckoutOrderSummary,
  CheckoutPriceBreakdown,
  CheckoutPromoSection,
  CheckoutPaymentSection,
  CheckoutBottomBar,
} from '../components';

export function SingleScreenCheckout() {
  const {
    insets,
    session,
    isLoading,
    isError,
    estimate,
    selectedAddress,
    selectedPaymentMethod,
    cartItems,
    summary,
    handleBack,
    handlePlaceOrder,
    isPlacingOrder,
  } = useCheckout();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#0d631b" />
      </View>
    );
  }

  if (isError || !summary) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        <Text className="text-on-surface text-center mb-4">
          Failed to load checkout data
        </Text>
        <TouchableOpacity
          onPress={handleBack}
          className="bg-primary px-6 py-2 rounded-full"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="dark-content" />

      <CheckoutHeader title="Checkout" onBack={handleBack} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 80,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: 16,
          gap: 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <CheckoutDeliverySection
          userName={session?.user.name || 'User'}
          address={selectedAddress}
          estimatedMinutes={estimate?.estimatedMinutes}
        />

        <CheckoutOrderSummary items={cartItems} />

        <CheckoutPriceBreakdown summary={summary} />

        <CheckoutPromoSection onApply={(code) => console.log('Applying promo:', code)} />

        <CheckoutPaymentSection
          paymentMethod={selectedPaymentMethod ?? undefined}
        />
      </ScrollView>

      <CheckoutBottomBar
        total={summary.total}
        onPlaceOrder={handlePlaceOrder}
        paddingBottom={Math.max(insets.bottom, 16)}
        isPlacingOrder={isPlacingOrder}
      />
    </View>
  );
}
