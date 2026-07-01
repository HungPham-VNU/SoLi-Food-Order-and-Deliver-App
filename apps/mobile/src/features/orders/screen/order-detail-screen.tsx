import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, CreditCard, Star } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { formatCurrency } from '@/src/lib/format-utils';
import { useMyOrderDetail } from '../hooks/use-order-history';
import { REVIEWABLE_ORDER_STATUSES } from '@/src/features/review/api/review.api';
import Toast from 'react-native-toast-message';
import { captureMobileException } from '@/src/lib/observability';
import {
  buildVNPayStatusRouteParams,
  openVNPayPaymentSession,
  VNPAY_STATUS_ROUTE,
} from '@/src/features/payment';
import {
  useMenuItemImage,
  useRestaurantImage,
} from '@/src/features/restaurants/api';
import type { OrderItemResponse } from '../types';

function firstRouteParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function OrderDetailItemRow({ item }: { item: OrderItemResponse }) {
  const { data: menuItemImageUrl } = useMenuItemImage(item.menuItemId);

  return (
    <View className="flex-row items-center gap-3 mb-3">
      <View className="w-12 h-12 rounded-xl bg-surface-container overflow-hidden flex-shrink-0">
        {menuItemImageUrl ? (
          <Image
            source={{ uri: menuItemImageUrl }}
            className="w-full h-full"
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        ) : (
          <View className="bg-primary/5 w-full h-full items-center justify-center">
            <Text
              className="text-primary text-sm"
              style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}
            >
              {item.itemName.charAt(0)}
            </Text>
          </View>
        )}
      </View>
      <Text
        className="text-on-surface flex-1"
        style={{ fontFamily: 'Inter_400Regular' }}
      >
        {item.quantity}x {item.itemName}
      </Text>
      <Text
        className="text-on-surface"
        style={{ fontFamily: 'Inter_600SemiBold' }}
      >
        {formatCurrency(item.subtotal)}
      </Text>
    </View>
  );
}

export function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const orderId = firstRouteParam(id);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isOpeningPayment, setIsOpeningPayment] = useState(false);

  const { data: order, isLoading, isError } = useMyOrderDetail(orderId);
  const { data: restaurantImageUrl } = useRestaurantImage(
    order?.restaurantId || '',
  );
  const subtotal = order?.subtotal ?? 0;
  const canContinueVNPayPayment =
    order?.paymentMethod === 'vnpay' &&
    order.status === 'pending' &&
    !!order.paymentUrl;

  const handleContinueVNPayPayment = async () => {
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
        source: 'order_detail_vnpay_continue_payment',
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

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Top Navigation */}
      <View className="flex-row items-center px-4 h-16 w-full bg-surface/80 z-50">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-transform"
        >
          <ArrowLeft size={24} color="#0d631b" />
        </TouchableOpacity>
        <Text
          className="text-lg text-primary ml-2"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
        >
          Order Details
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0d631b" />
        </View>
      ) : isError || !order ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text
            className="text-error text-center"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Failed to load order details.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 py-6">
          <View className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm mb-6">
            <View className="flex-row items-center gap-4 mb-3">
              <View className="w-16 h-16 rounded-2xl bg-surface-container overflow-hidden flex-shrink-0">
                {restaurantImageUrl ? (
                  <Image
                    source={{ uri: restaurantImageUrl }}
                    className="w-full h-full"
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={200}
                  />
                ) : (
                  <View className="bg-primary/5 w-full h-full items-center justify-center">
                    <Text
                      className="text-primary text-xl"
                      style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}
                    >
                      {order.restaurantName.charAt(0)}
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-1">
                <Text
                  className="text-on-surface-variant text-sm mb-1"
                  style={{ fontFamily: 'Inter_400Regular' }}
                >
                  Order #{order.orderId.slice(0, 8).toUpperCase()}
                </Text>
                <Text
                  className="text-2xl text-on-surface mb-2"
                  style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
                >
                  {order.restaurantName}
                </Text>
              </View>
            </View>
            <View className="bg-primary/10 self-start px-3 py-1 rounded-full">
              <Text
                className="text-primary text-xs"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                {order.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {canContinueVNPayPayment && (
            <TouchableOpacity
              onPress={handleContinueVNPayPayment}
              disabled={isOpeningPayment}
              className={`flex-row items-center justify-center rounded-2xl py-4 mb-6 bg-primary ${
                isOpeningPayment ? 'opacity-60' : ''
              }`}
            >
              {isOpeningPayment ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <CreditCard size={20} color="#ffffff" />
              )}
              <Text
                className="text-on-primary ml-2"
                style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 }}
              >
                {isOpeningPayment
                  ? 'Opening VNPay...'
                  : 'Continue VNPay Payment'}
              </Text>
            </TouchableOpacity>
          )}

          <View className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm mb-6">
            <Text
              className="text-on-surface text-lg mb-4"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
            >
              Items
            </Text>
            {order.items.map((item) => (
              <OrderDetailItemRow key={item.orderItemId} item={item} />
            ))}
            <View className="border-t border-surface-container mt-2 pt-4">
              <View className="flex-row justify-between mb-2">
                <Text
                  className="text-on-surface-variant"
                  style={{ fontFamily: 'Inter_400Regular' }}
                >
                  Subtotal
                </Text>
                <Text
                  className="text-on-surface"
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                >
                  {formatCurrency(subtotal)}
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text
                  className="text-on-surface-variant"
                  style={{ fontFamily: 'Inter_400Regular' }}
                >
                  Shipping Fee
                </Text>
                <Text
                  className="text-on-surface"
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                >
                  {formatCurrency(order.shippingFee)}
                </Text>
              </View>
              <View className="flex-row justify-between mt-2">
                <Text
                  className="text-on-surface text-lg"
                  style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
                >
                  Total
                </Text>
                <Text
                  className="text-primary text-xl"
                  style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}
                >
                  {formatCurrency(order.totalAmount)}
                </Text>
              </View>
            </View>
          </View>

          <View className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm mb-10">
            <Text
              className="text-on-surface text-lg mb-4"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
            >
              Delivery Address
            </Text>
            <Text
              className="text-on-surface-variant"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              {order.deliveryAddress.latitude && order.deliveryAddress.longitude
                ? `Lat: ${order.deliveryAddress.latitude.toFixed(4)}, Lng: ${order.deliveryAddress.longitude.toFixed(4)}`
                : 'Location details unavailable'}
            </Text>
          </View>

          {(REVIEWABLE_ORDER_STATUSES as readonly string[]).includes(
            order.status,
          ) && (
            <TouchableOpacity
              onPress={() =>
                router.navigate(`/(customer)/orders/${order.orderId}/rate`)
              }
              className={`flex-row items-center justify-center rounded-2xl py-4 mb-10 ${
                order.hasReview ? 'bg-surface-container-high' : 'bg-primary'
              }`}
            >
              <Star
                size={20}
                color={order.hasReview ? '#0d631b' : '#ffffff'}
                fill={order.hasReview ? '#0d631b' : 'transparent'}
              />
              <Text
                className={
                  order.hasReview ? 'text-primary ml-2' : 'text-on-primary ml-2'
                }
                style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 }}
              >
                {order.hasReview ? 'View Your Review' : 'Rate & Review'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}
