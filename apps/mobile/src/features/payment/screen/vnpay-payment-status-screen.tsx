import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  XCircle,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { formatCurrency } from '@/src/lib/format-utils';
import { captureMobileException } from '@/src/lib/observability';
import {
  orderKeys,
  useMyOrderDetail,
} from '@/src/features/orders/hooks/use-order-history';
import type { OrderDetail, OrderStatus } from '@/src/features/orders/types';
import { addItemToCart, clearCart } from '@/src/features/cart/api/cart-api';
import { cartKeys } from '@/src/features/cart/hooks/use-cart';
import type { CartResponse } from '@/src/features/cart/types';
import { cancelVNPayPayment } from '../api/payment-api';
import {
  buildVNPayStatusRouteParams,
  openVNPayPaymentSession,
  VNPAY_STATUS_ROUTE,
} from '../utils/vnpay-payment-session';

const SUCCESS_STATUSES: OrderStatus[] = [
  'paid',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'delivering',
  'delivered',
];

const TERMINAL_STATUSES: OrderStatus[] = ['cancelled', 'refunded'];

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function isSuccessStatus(status?: OrderStatus): boolean {
  return !!status && SUCCESS_STATUSES.includes(status);
}

function isTerminalStatus(status?: OrderStatus): boolean {
  return !!status && TERMINAL_STATUSES.includes(status);
}

function shouldPoll(status?: OrderStatus): boolean {
  return !isSuccessStatus(status) && !isTerminalStatus(status);
}

function getStatusCopy(input: {
  orderStatus?: OrderStatus;
  returnStatus: string;
  browserResult: string;
  signatureValid: string;
}) {
  if (isSuccessStatus(input.orderStatus)) {
    return {
      tone: 'success' as const,
      title: 'Payment confirmed',
      message: 'Your payment was received and the order is moving ahead.',
      icon: CheckCircle2,
    };
  }

  if (isTerminalStatus(input.orderStatus)) {
    return {
      tone: 'failed' as const,
      title:
        input.orderStatus === 'refunded'
          ? 'Payment refunded'
          : 'Order cancelled',
      message:
        input.orderStatus === 'refunded'
          ? 'The payment was refunded for this order.'
          : 'The order is no longer active. Check your orders for details.',
      icon: XCircle,
    };
  }

  if (input.browserResult === 'cancel') {
    return {
      tone: 'pending' as const,
      title: 'Payment not finished',
      message: 'You left VNPay before the payment was confirmed.',
      icon: CreditCard,
    };
  }

  if (input.returnStatus === 'completed') {
    return {
      tone: 'pending' as const,
      title: 'Finalizing order',
      message:
        'VNPay has returned successfully. We are waiting for the order status to update.',
      icon: Clock3,
    };
  }

  if (input.signatureValid === 'false') {
    return {
      tone: 'failed' as const,
      title: 'Return link could not be verified',
      message: 'We are checking your order status from the server.',
      icon: XCircle,
    };
  }

  return {
    tone: 'pending' as const,
    title: 'Confirming payment',
    message: 'We are waiting for VNPay confirmation from the server.',
    icon: Clock3,
  };
}

function getToneClasses(tone: 'success' | 'pending' | 'failed') {
  if (tone === 'success') {
    return {
      iconBg: 'bg-primary/10',
      iconColor: '#0d631b',
      labelBg: '#e7f6e9',
      labelColor: '#0d631b',
    };
  }

  if (tone === 'failed') {
    return {
      iconBg: 'bg-error/10',
      iconColor: '#ba1a1a',
      labelBg: '#ffedea',
      labelColor: '#ba1a1a',
    };
  }

  return {
    iconBg: 'bg-secondary-container/20',
    iconColor: '#8b5000',
    labelBg: '#fff3d9',
    labelColor: '#8b5000',
  };
}

async function restoreCheckoutCartFromOrder(
  order: OrderDetail,
): Promise<CartResponse | null> {
  await clearCart();

  let restoredCart: CartResponse | null = null;
  const failedItems: string[] = [];

  for (const item of order.items) {
    try {
      restoredCart = await addItemToCart({
        menuItemId: item.menuItemId,
        restaurantId: order.restaurantId,
        restaurantName: order.restaurantName,
        itemName: item.itemName,
        imageUrl: item.imageUrl,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        selectedModifiers: item.modifiers.map((modifier) => ({
          groupId: modifier.groupId,
          optionId: modifier.optionId,
        })),
        optimisticSelectedModifiers: item.modifiers.map((modifier) => ({
          groupId: modifier.groupId,
          groupName: modifier.groupName,
          optionId: modifier.optionId,
          optionName: modifier.optionName,
          price: modifier.price,
        })),
      });
    } catch {
      failedItems.push(item.itemName.trim() || item.menuItemId);
    }
  }

  if (failedItems.length > 0) {
    throw new Error(
      `Could not restore checkout items: ${failedItems.join(', ')}.`,
    );
  }

  return restoredCart;
}

export function VNPayPaymentStatusScreen() {
  const params = useLocalSearchParams<{
    orderId?: string;
    txnRef?: string;
    status?: string;
    signatureValid?: string;
    vnpResponseCode?: string;
    browserResult?: string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isOpeningPayment, setIsOpeningPayment] = useState(false);
  const [isCancellingPayment, setIsCancellingPayment] = useState(false);

  const orderId = firstParam(params.orderId);
  const txnRef = firstParam(params.txnRef);
  const returnStatus = firstParam(params.status);
  const signatureValid = firstParam(params.signatureValid);
  const vnpResponseCode = firstParam(params.vnpResponseCode);
  const browserResult = firstParam(params.browserResult);

  const {
    data: order,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useMyOrderDetail(orderId, {
    enabled: !!orderId,
    // Stop the automatic refetch interval when:
    //  - the order has reached a success or terminal status (no further updates expected), OR
    //  - the query is in an error state (network failure) — React Query's own
    //    retry logic will attempt recovery; adding a parallel interval would cause
    //    duplicate in-flight requests and confuse the UX.
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      return shouldPoll(query.state.data?.status) ? 2_000 : false;
    },
    refetchIntervalInBackground: true,
  });

  const copy = useMemo(
    () =>
      getStatusCopy({
        orderStatus: order?.status,
        returnStatus,
        browserResult,
        signatureValid,
      }),
    [browserResult, order?.status, returnStatus, signatureValid],
  );
  const tone = getToneClasses(copy.tone);
  const Icon = copy.icon;
  const goHome = () => {
    router.navigate('/(customer)/(tabs)');
  };

  const handleCancelPayment = async () => {
    if (!order || isCancellingPayment) return;

    setIsCancellingPayment(true);

    // --- Step 1: Cancel the VNPay payment transaction and pending order ---
    try {
      await cancelVNPayPayment(order.orderId);
    } catch (error) {
      captureMobileException(error, {
        source: 'vnpay_status_cancel_payment',
        orderId: order.orderId,
      });
      Toast.show({
        type: 'error',
        text1: 'Could not cancel payment',
        text2: 'Please refresh and try again.',
      });
      void refetch();
      setIsCancellingPayment(false);
      return;
    }

    // --- Step 2: Restore cart and navigate to checkout ---
    try {
      const restoredCart = await restoreCheckoutCartFromOrder(order);
      queryClient.setQueryData<CartResponse | null>(
        cartKeys.myCart(),
        restoredCart,
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cartKeys.all }),
        queryClient.invalidateQueries({ queryKey: orderKeys.all }),
      ]);

      Toast.show({
        type: 'success',
        text1: 'Payment cancelled',
        text2: 'Your checkout details were restored.',
      });

      router.replace('/(customer)/checkout');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not restore checkout details.';
      captureMobileException(error, {
        source: 'vnpay_status_restore_checkout',
        orderId: order.orderId,
      });
      await queryClient.invalidateQueries({ queryKey: cartKeys.all });
      Toast.show({
        type: 'error',
        text1: 'Payment cancelled',
        text2: message,
      });
    } finally {
      setIsCancellingPayment(false);
    }
  };

  const handleContinuePayment = async () => {
    if (!order?.paymentUrl || isOpeningPayment) return;

    setIsOpeningPayment(true);
    try {
      const session = await openVNPayPaymentSession(order.paymentUrl);
      router.replace({
        pathname: VNPAY_STATUS_ROUTE as any,
        params: buildVNPayStatusRouteParams({
          orderId: order.orderId,
          paymentUrl: order.paymentUrl,
          fallbackStatus: order.status,
          session,
        }),
      });
    } catch (error) {
      captureMobileException(error, {
        source: 'vnpay_status_continue_payment',
        orderId: order.orderId,
      });
      Toast.show({
        type: 'error',
        text1: 'Could not open VNPay',
        text2: 'Please try again.',
      });
    } finally {
      setIsOpeningPayment(false);
    }
  };

  const hasSuccessfulVNPayReturn =
    returnStatus === 'completed' || vnpResponseCode === '00';
  const canContinuePayment =
    order?.status === 'pending' &&
    !!order.paymentUrl &&
    !hasSuccessfulVNPayReturn &&
    !isOpeningPayment &&
    !isCancellingPayment;
  const canCancelPayment =
    order?.paymentMethod === 'vnpay' &&
    order?.status === 'pending' &&
    !hasSuccessfulVNPayReturn &&
    !isOpeningPayment;
  const shouldBlockExit =
    (order?.paymentMethod === 'vnpay' && order?.status === 'pending') ||
    (!!orderId && !order && !isError && returnStatus !== 'completed');

  useEffect(() => {
    if (!shouldBlockExit) return;

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );

    return () => subscription.remove();
  }, [shouldBlockExit]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <StatusBar barStyle="dark-content" />

      <View className="h-16 flex-row items-center border-b border-outline-variant/15 bg-surface/90 px-4">
        {shouldBlockExit ? (
          <View className="h-10 w-10" />
        ) : (
          <TouchableOpacity
            onPress={goHome}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-container-low"
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft size={24} color="#0d631b" />
          </TouchableOpacity>
        )}
        <Text className="flex-1 pr-10 text-center font-jakarta-sans text-lg font-bold text-primary-container">
          Payment
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 28,
          paddingBottom: insets.bottom + 32,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center gap-5 rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6">
          <View
            className={`h-20 w-20 items-center justify-center rounded-full ${tone.iconBg}`}
          >
            {isLoading && !order ? (
              <ActivityIndicator color={tone.iconColor} />
            ) : (
              <Icon size={42} color={tone.iconColor} strokeWidth={2.4} />
            )}
          </View>

          <View className="items-center gap-2">
            <Text className="text-center font-jakarta-sans text-2xl font-bold text-on-surface">
              {copy.title}
            </Text>
            <Text className="text-center font-inter text-sm leading-5 text-on-surface-variant">
              {copy.message}
            </Text>
          </View>

          <View
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: tone.labelBg }}
          >
            <Text
              className="font-inter text-xs font-bold uppercase"
              style={{ color: tone.labelColor }}
            >
              {order?.status || returnStatus || 'pending'}
            </Text>
          </View>
        </View>

        <View className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-5">
          <Text className="mb-4 font-jakarta-sans text-lg font-bold text-on-surface">
            Order summary
          </Text>

          {isError ? (
            <Text className="font-inter text-sm text-error">
              Could not load this order. Please refresh or open your order list.
            </Text>
          ) : !order && isLoading ? (
            <View className="items-center py-6">
              <ActivityIndicator color="#0d631b" />
            </View>
          ) : (
            <View className="gap-3">
              <View className="flex-row justify-between gap-4">
                <Text className="font-inter text-sm text-on-surface-variant">
                  Order
                </Text>
                <Text className="flex-1 text-right font-inter text-sm font-semibold text-on-surface">
                  {order?.orderId
                    ? `#${order.orderId.slice(0, 8).toUpperCase()}`
                    : orderId
                      ? `#${orderId.slice(0, 8).toUpperCase()}`
                      : 'Unavailable'}
                </Text>
              </View>
              <View className="flex-row justify-between gap-4">
                <Text className="font-inter text-sm text-on-surface-variant">
                  Restaurant
                </Text>
                <Text className="flex-1 text-right font-inter text-sm font-semibold text-on-surface">
                  {order?.restaurantName ?? 'Checking...'}
                </Text>
              </View>
              <View className="flex-row justify-between gap-4">
                <Text className="font-inter text-sm text-on-surface-variant">
                  Total
                </Text>
                <Text className="font-inter text-sm font-semibold text-on-surface">
                  {order ? formatCurrency(order.totalAmount) : 'Checking...'}
                </Text>
              </View>
              {!!txnRef && (
                <View className="flex-row justify-between gap-4">
                  <Text className="font-inter text-sm text-on-surface-variant">
                    Transaction
                  </Text>
                  <Text className="flex-1 text-right font-inter text-xs font-semibold text-on-surface">
                    {txnRef.slice(0, 8).toUpperCase()}
                  </Text>
                </View>
              )}
              {!!vnpResponseCode && (
                <View className="flex-row justify-between gap-4">
                  <Text className="font-inter text-sm text-on-surface-variant">
                    VNPay code
                  </Text>
                  <Text className="font-inter text-sm font-semibold text-on-surface">
                    {vnpResponseCode}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View className="gap-3">
          {canContinuePayment && (
            <TouchableOpacity
              onPress={handleContinuePayment}
              activeOpacity={0.86}
              accessibilityRole="button"
              accessibilityLabel="Continue VNPay payment"
              className="h-14 flex-row items-center justify-center gap-2 rounded-full bg-primary"
            >
              {isOpeningPayment ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <CreditCard size={20} color="#ffffff" />
                  <Text className="font-inter text-base font-bold text-on-primary">
                    Continue payment
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {canCancelPayment && (
            <TouchableOpacity
              onPress={handleCancelPayment}
              disabled={isCancellingPayment}
              activeOpacity={0.86}
              accessibilityRole="button"
              accessibilityLabel="Cancel payment"
              className={`h-14 flex-row items-center justify-center gap-2 rounded-full bg-error ${
                isCancellingPayment ? 'opacity-70' : ''
              }`}
            >
              {isCancellingPayment ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <XCircle size={20} color="#ffffff" />
                  <Text className="font-inter text-base font-bold text-white">
                    Cancel payment
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {shouldPoll(order?.status) && !!orderId && (
            <TouchableOpacity
              onPress={() => refetch()}
              disabled={isRefetching}
              activeOpacity={0.75}
              className="items-center py-2"
            >
              <Text className="font-inter text-xs font-semibold text-on-surface-variant">
                {isRefetching ? 'Checking...' : 'Refresh status'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
