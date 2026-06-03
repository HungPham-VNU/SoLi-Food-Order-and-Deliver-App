import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMyCart } from './use-cart';
import { useAddressStore } from '@/src/features/location/store/address-store';
import { useCheckoutStore } from '../store/checkout-store';
import { useDeliveryEstimate } from '@/src/features/restaurants/api/restaurant-api';
import { usePreviewDiscount } from '@/src/features/promotions/hooks/use-preview-discount';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { checkoutCart } from '../api/cart-api';
import { orderKeys } from '@/src/features/orders/hooks/use-order-history';
import Toast from 'react-native-toast-message';
import * as Crypto from 'expo-crypto';
import type { CheckoutSummary, CartItem, CheckoutDto } from '../types';
import { trackMobileEvent } from '@/src/lib/analytics';
import { captureMobileException, Sentry } from '@/src/lib/observability';
import {
  buildVNPayStatusRouteParams,
  openVNPayPaymentSession,
  VNPAY_STATUS_ROUTE,
  type VNPayPaymentSessionResult,
} from '@/src/features/payment';

const DEFAULT_DELIVERY_FEE = 15000; // 15k VND

async function createCheckoutIdempotencyKey(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function computeOrderSummary(
  subtotal: number,
  deliveryFee: number = DEFAULT_DELIVERY_FEE,
  discountAmount: number = 0,
  estimatedMinutes?: number,
): CheckoutSummary {
  const total = subtotal - discountAmount + deliveryFee;
  return {
    subtotal,
    discount: discountAmount,
    delivery: deliveryFee,
    total,
    estimatedMinutes,
  };
}

export function useCheckout() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { selectedAddress, latitude, longitude } = useAddressStore();
  const { data: cart, isLoading, isError } = useMyCart();

  const { data: estimate } = useDeliveryEstimate(
    cart?.restaurantId,
    latitude,
    longitude,
  );

  const {
    selectedPaymentMethod,
    appliedCouponCode,
    checkoutIdempotencyKey,
    setCheckoutIdempotencyKey,
    clearCheckoutIdempotencyKey,
  } = useCheckoutStore();

  const deliveryFee = estimate?.deliveryFee ?? DEFAULT_DELIVERY_FEE;

  const { data: discountPreview } = usePreviewDiscount(
    cart?.restaurantId,
    cart?.totalAmount,
    deliveryFee,
    appliedCouponCode,
  );

  const checkoutMutation = useMutation({
    mutationFn: (data: { dto: CheckoutDto; idempotencyKey?: string }) =>
      checkoutCart(data.dto, data.idempotencyKey),
    onError: (error: any) => {
      trackMobileEvent('order_create_failed', {
        code: 'CHECKOUT_ERROR',
      });
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
    if (cartItems.length === 0) {
      Toast.show({ type: 'error', text1: 'Your cart is empty' });
      return;
    }
    if (!selectedAddress) {
      Toast.show({ type: 'error', text1: 'Delivery address is required' });
      return;
    }
    if (!selectedPaymentMethod) {
      Toast.show({ type: 'error', text1: 'Payment method is required' });
      return;
    }
    // Guard: selectedAddress may be set without coordinates (e.g. manual text entry).
    // The API requires valid lat/lng - reject early with a clear message.
    if (latitude == null || longitude == null) {
      Toast.show({
        type: 'error',
        text1: 'Could not determine delivery coordinates',
        text2: 'Please re-select your address.',
      });
      return;
    }
    const dto: CheckoutDto = {
      deliveryAddress: {
        latitude,
        longitude,
      },
      paymentMethod: selectedPaymentMethod.id === 'vnpay' ? 'vnpay' : 'cod',
      note: '',
      couponCode: appliedCouponCode ?? undefined,
    };

    const idempotencyKey =
      checkoutIdempotencyKey ?? (await createCheckoutIdempotencyKey());
    if (!checkoutIdempotencyKey) {
      setCheckoutIdempotencyKey(idempotencyKey);
    }

    trackMobileEvent('checkout_submitted', {
      payment_method: dto.paymentMethod,
      item_count: cartItems.length,
      total_amount: summary.total,
    });
    await Sentry.startSpan(
      {
        name: 'checkout.place_order',
        op: 'ui.action',
        attributes: {
          'checkout.payment_method': dto.paymentMethod,
          'checkout.item_count': cartItems.length,
        },
      },
      async () => {
        const data = await checkoutMutation.mutateAsync({
          dto,
          idempotencyKey,
        });
        clearCheckoutIdempotencyKey();

        trackMobileEvent('order_created', {
          order_id: data.orderId,
          payment_method: data.paymentMethod,
          total_amount: data.totalAmount,
          item_count: cartItems.length,
          discount_amount: data.discountAmount,
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['cart'] }),
          queryClient.invalidateQueries({ queryKey: orderKeys.all }),
        ]);

        if (data.paymentMethod === 'vnpay') {
          let session: VNPayPaymentSessionResult | undefined;

          if (data.paymentUrl) {
            try {
              session = await openVNPayPaymentSession(data.paymentUrl);
            } catch (error) {
              captureMobileException(error, {
                source: 'checkout_vnpay_open_session',
                orderId: data.orderId,
              });
              Toast.show({
                type: 'error',
                text1: 'Could not open VNPay',
                text2: 'You can continue payment from the status screen.',
              });
              session = {
                type: 'error',
                params: {},
              };
            }
          }

          router.dismissAll();
          router.navigate({
            pathname: VNPAY_STATUS_ROUTE as any,
            params: buildVNPayStatusRouteParams({
              orderId: data.orderId,
              paymentUrl: data.paymentUrl,
              fallbackStatus: data.status,
              session,
              browserResult: data.paymentUrl
                ? undefined
                : 'missing_payment_url',
            }),
          });
          return;
        }

        Toast.show({
          type: 'success',
          text1: 'Order placed successfully!',
        });
        router.dismissAll();
        router.replace('/(customer)/(tabs)');
      },
    );
  };

  const cartItems: CartItem[] = (cart?.items ?? []).map((item) => ({
    id: item.cartItemId,
    menuItemId: item.menuItemId,
    name: item.itemName,
    price: item.unitPrice,
    quantity: item.quantity,
    imageUrl: item.imageUrl ?? '',
    selectedModifiers: item.selectedModifiers ?? [],
  }));

  const discountAmount = discountPreview?.discountAmount ?? 0;
  const summary = computeOrderSummary(
    cart?.totalAmount || 0,
    deliveryFee,
    discountAmount,
    estimate?.estimatedMinutes,
  );

  return {
    insets,
    cart,
    isLoading,
    isError,
    estimate,
    selectedAddress,
    selectedPaymentMethod,
    appliedCouponCode,
    cartItems,
    summary,
    discountPreview,
    handleBack,
    handlePlaceOrder,
    isPlacingOrder: checkoutMutation.isPending,
  };
}
