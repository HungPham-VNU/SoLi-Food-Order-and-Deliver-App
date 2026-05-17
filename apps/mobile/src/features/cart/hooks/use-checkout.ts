import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMyCart } from './use-cart';
import { useSession } from '@/src/lib/auth-client';
import { useAddressStore } from '@/src/features/location/store/address-store';
import { useCheckoutStore } from '../store/checkout-store';
import { useDeliveryEstimate } from '@/src/features/restaurants/api/restaurant-api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { checkoutCart } from '../api/cart-api';
import Toast from 'react-native-toast-message';
import * as Linking from 'expo-linking';
import * as Crypto from 'expo-crypto';
import type { CheckoutSummary, CartItem, CheckoutDto } from '../types';

const DISCOUNT_THRESHOLD = 500000; // 500k VND
const DISCOUNT_PERCENT = 10; // 10%
const DEFAULT_DELIVERY_FEE = 15000; // 15k VND

function computeOrderSummary(
  subtotal: number,
  deliveryFee: number = DEFAULT_DELIVERY_FEE,
  estimatedMinutes?: number,
): CheckoutSummary {
  const remaining = Math.max(0, DISCOUNT_THRESHOLD - subtotal);
  const discount =
    subtotal >= DISCOUNT_THRESHOLD ? subtotal * (DISCOUNT_PERCENT / 100) : 0;
  const total = subtotal - discount + deliveryFee;
  return {
    subtotal,
    discount,
    delivery: deliveryFee,
    total,
    discountThreshold: DISCOUNT_THRESHOLD,
    discountPercent: DISCOUNT_PERCENT,
    remainingForDiscount: remaining,
    estimatedMinutes,
  };
}

export function useCheckout() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { selectedAddress, latitude, longitude } = useAddressStore();
  const { data: session } = useSession();
  const { data: cart, isLoading, isError } = useMyCart();

  const { data: estimate } = useDeliveryEstimate(
    cart?.restaurantId,
    latitude,
    longitude,
  );

  const checkoutMutation = useMutation({
    mutationFn: (data: { dto: CheckoutDto; idempotencyKey?: string }) =>
      checkoutCart(data.dto, data.idempotencyKey),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      if (data.paymentMethod === 'vnpay' && data.paymentUrl) {
        Linking.openURL(data.paymentUrl);
      }
      Toast.show({
        type: 'success',
        text1: 'Order placed successfully!',
      });
      router.dismissAll();
      router.replace('/(customer)/(tabs)');
    },
    onError: (error: any) => {
      Toast.show({
        type: 'error',
        text1: 'Failed to place order',
        text2: error.message || 'Please try again',
      });
    },
  });

  const handleBack = () => {
    router.back();
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      Toast.show({ type: 'error', text1: 'Delivery address is required' });
      return;
    }
    if (!selectedPaymentMethod) {
      Toast.show({ type: 'error', text1: 'Payment method is required' });
      return;
    }
    const addressObj = selectedAddress as any;
    const dto: CheckoutDto = {
      deliveryAddress: {
        street: addressObj.street || (typeof selectedAddress === 'string' ? selectedAddress : ''),
        district: addressObj.district || '',
        city: addressObj.city || '',
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
      },
      paymentMethod: selectedPaymentMethod.id === 'vnpay' ? 'vnpay' : 'cod',
      note: '', // Could be wired up to a note input
    };

    const randomBytes = await Crypto.getRandomBytesAsync(16);
    const idempotencyKey = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    checkoutMutation.mutate({ dto, idempotencyKey });
  };
  const cartItems: CartItem[] =
    cart?.items.map((item) => ({
      id: item.cartItemId,
      name: item.itemName,
      price: item.unitPrice,
      quantity: item.quantity,
      // TODO: Populate imageUrl by fetching from a product catalog or menu API.
      // Currently CartItemResponse does not provide image data.
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=200&auto=format&fit=crop',
      selectedModifiers: item.selectedModifiers,
    })) || [];

  const { selectedPaymentMethod } = useCheckoutStore();

  const deliveryFee = estimate?.deliveryFee ?? DEFAULT_DELIVERY_FEE;
  const summary = computeOrderSummary(
    cart?.totalAmount || 0,
    deliveryFee,
    estimate?.estimatedMinutes,
  );

  return {
    insets,
    session,
    cart,
    isLoading,
    isError,
    estimate,
    selectedAddress,
    selectedPaymentMethod,
    cartItems,
    summary,
    handleBack,
    handlePlaceOrder,
    isPlacingOrder: checkoutMutation.isPending,
  };
}

