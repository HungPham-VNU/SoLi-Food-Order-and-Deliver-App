import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Filter, RefreshCcw } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { OrderCard } from '../components/order-card';
import { useMyOrders } from '../hooks/use-order-history';

export function OrderHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data, isLoading, isError, refetch, isRefetching } = useMyOrders({
    limit: 20,
    offset: 0,
  });

  const orders = data?.data || [];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Top Navigation */}
      <View className="flex-row items-center justify-between px-4 h-16 w-full bg-surface/80 z-50">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-transform"
        >
          <ArrowLeft size={24} color="#0d631b" />
        </TouchableOpacity>
        <Text
          className="text-lg text-primary"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
        >
          Order History
        </Text>
        <TouchableOpacity className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-transform">
          <Filter size={24} color="#0d631b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: insets.bottom + 40,
          paddingTop: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 mb-4 flex-row justify-between items-center">
          <Text
            className="text-on-surface-variant text-sm"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Recent Orders ({data?.total || 0})
          </Text>
          <TouchableOpacity onPress={() => refetch()} disabled={isRefetching}>
            <RefreshCcw
              size={16}
              color="#0d631b"
              className={isRefetching ? 'animate-spin' : ''}
            />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color="#0d631b" />
            <Text
              className="mt-4 text-on-surface-variant"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              Loading your orders...
            </Text>
          </View>
        ) : isError ? (
          <View className="py-20 items-center justify-center px-10">
            <Text
              className="text-error text-center mb-4"
              style={{ fontFamily: 'Inter_600SemiBold' }}
            >
              Failed to load order history. Please try again.
            </Text>
            <TouchableOpacity
              onPress={() => refetch()}
              className="bg-primary px-6 py-2 rounded-full"
            >
              <Text
                className="text-on-primary"
                style={{ fontFamily: 'Inter_700Bold' }}
              >
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : orders.length === 0 ? (
          <View className="py-20 items-center justify-center px-10">
            <Text
              className="text-on-surface-variant text-center"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              You haven&apos;t placed any orders yet.
            </Text>
          </View>
        ) : (
          <View className="flex-col">
            {orders.map((order) => (
              <OrderCard
                key={order.orderId}
                order={order}
                onPress={() => {
                  router.push({
                    pathname: '/(customer)/orders/[id]',
                    params: { id: order.orderId },
                  });
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
