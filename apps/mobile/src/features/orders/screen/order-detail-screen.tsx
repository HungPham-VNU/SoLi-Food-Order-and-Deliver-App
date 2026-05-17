import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMyOrderDetail } from '../hooks/use-order-history';

export function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const { data: order, isLoading, isError } = useMyOrderDetail(id || '');

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
        <Text className="text-lg text-primary ml-2" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
          Order Details
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0d631b" />
        </View>
      ) : isError || !order ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text className="text-error text-center" style={{ fontFamily: 'Inter_600SemiBold' }}>
            Failed to load order details.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 py-6">
          <View className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm mb-6">
            <Text className="text-on-surface-variant text-sm mb-1" style={{ fontFamily: 'Inter_400Regular' }}>
              Order #{order.orderId.slice(0, 8).toUpperCase()}
            </Text>
            <Text className="text-2xl text-on-surface mb-2" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
              {order.restaurantName}
            </Text>
            <View className="bg-primary/10 self-start px-3 py-1 rounded-full">
              <Text className="text-primary text-xs" style={{ fontFamily: 'Inter_600SemiBold' }}>
                {order.status.toUpperCase()}
              </Text>
            </View>
          </View>

          <View className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm mb-6">
            <Text className="text-on-surface text-lg mb-4" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
              Items
            </Text>
            {order.items.map((item) => (
              <View key={item.orderItemId} className="flex-row justify-between mb-3">
                <Text className="text-on-surface flex-1" style={{ fontFamily: 'Inter_400Regular' }}>
                  {item.quantity}x {item.itemName}
                </Text>
                <Text className="text-on-surface" style={{ fontFamily: 'Inter_600SemiBold' }}>
                  ${item.subtotal.toFixed(2)}
                </Text>
              </View>
            ))}
            <View className="border-t border-surface-container mt-2 pt-4">
              <View className="flex-row justify-between mb-2">
                <Text className="text-on-surface-variant" style={{ fontFamily: 'Inter_400Regular' }}>Subtotal</Text>
                <Text className="text-on-surface" style={{ fontFamily: 'Inter_600SemiBold' }}>
                  ${((order as any).subtotal ?? order.items.reduce((sum, item) => sum + item.subtotal, 0)).toFixed(2)}
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-on-surface-variant" style={{ fontFamily: 'Inter_400Regular' }}>Shipping Fee</Text>
                <Text className="text-on-surface" style={{ fontFamily: 'Inter_600SemiBold' }}>${order.shippingFee.toFixed(2)}</Text>
              </View>
              <View className="flex-row justify-between mt-2">
                <Text className="text-on-surface text-lg" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>Total</Text>
                <Text className="text-primary text-xl" style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}>${order.totalAmount.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          <View className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm mb-10">
            <Text className="text-on-surface text-lg mb-4" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
              Delivery Address
            </Text>
            <Text className="text-on-surface-variant" style={{ fontFamily: 'Inter_400Regular' }}>
              {order.deliveryAddress.street}, {order.deliveryAddress.district}, {order.deliveryAddress.city}
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
