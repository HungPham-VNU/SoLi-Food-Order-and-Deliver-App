import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Tag } from 'lucide-react-native';
import { router } from 'expo-router';
import { useCheckout } from '../hooks';
import { useCheckoutStore } from '../store/checkout-store';
import { useValidateCoupon } from '@/src/features/promotions';
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
    isLoading,
    isError,
    estimate,
    selectedPaymentMethod,
    cartItems,
    summary,
    cart,
    appliedCouponCode,
    discountPreview,
    handleBack,
    handlePlaceOrder,
    isPlacingOrder,
  } = useCheckout();

  const { selectedPromotion, setAppliedCouponCode } = useCheckoutStore();

  const validateCouponMutation = useValidateCoupon();
  const selectedPromotionForCart =
    cart?.restaurantId && selectedPromotion?.restaurantId === cart.restaurantId
      ? selectedPromotion
      : null;
  const selectedPromotions = selectedPromotionForCart
    ? [selectedPromotionForCart]
    : [];

  const handleApplyPromo = (code: string) => {
    if (!cart?.restaurantId) return;
    validateCouponMutation.mutate(
      {
        code,
        restaurantId: cart.restaurantId,
        itemsSubtotal: cart.totalAmount,
        shippingFee: estimate?.deliveryFee ?? 15000,
      },
      {
        onSuccess: (result) => {
          if (result.applicable) {
            setAppliedCouponCode(code.toUpperCase());
          } else {
            validateCouponMutation.reset();
          }
        },
      },
    );
  };

  const handleClearPromo = () => {
    setAppliedCouponCode(null);
    validateCouponMutation.reset();
  };

  const handleBrowsePromo = () => {
    if (!cart?.restaurantId) return;
    router.navigate({
      pathname: '/(customer)/checkout/promo-picker',
      params: {
        restaurantId: cart.restaurantId,
        cartSubtotal: String(cart.totalAmount),
      },
    });
  };

  const couponError = (() => {
    if (!validateCouponMutation.isError && !validateCouponMutation.data) return null;
    if (validateCouponMutation.isError) {
      const err = validateCouponMutation.error as any;
      return err?.message || 'Invalid coupon code';
    }
    if (validateCouponMutation.data && !validateCouponMutation.data.applicable) {
      return validateCouponMutation.data.reason || 'Coupon code is not applicable';
    }
    return null;
  })();

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
          estimatedMinutes={estimate?.estimatedMinutes}
        />

        <CheckoutOrderSummary items={cartItems} />

        <CheckoutPriceBreakdown
          summary={summary}
          appliedCouponCode={appliedCouponCode}
        />

        {selectedPromotionForCart && (
          <View className="bg-primary/8 rounded-2xl p-4 gap-2 border border-primary/20">
            <View className="flex-row items-center gap-2">
              <Tag size={16} color="#0d631b" />
              <Text
                className="text-primary text-sm"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                Selected Deal
              </Text>
            </View>
            {selectedPromotions.map((promo) => (
              <Text
                key={promo.id}
                className="text-on-surface text-xs"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                • {promo.name}
              </Text>
            ))}
          </View>
        )}

        <CheckoutPromoSection
          onApply={handleApplyPromo}
          onClear={handleClearPromo}
          onBrowse={handleBrowsePromo}
          isValidating={validateCouponMutation.isPending}
          appliedCode={appliedCouponCode}
          appliedDiscount={discountPreview?.discountAmount}
          error={couponError}
        />

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
