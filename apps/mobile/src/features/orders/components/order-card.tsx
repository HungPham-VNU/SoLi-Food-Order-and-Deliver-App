import { View, Text, Image, TouchableOpacity } from 'react-native';
import { OrderListItem, OrderStatus } from '../types';

export interface OrderProps {
  order: OrderListItem;
  onActionPress: () => void;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; isProcessing: boolean }> = {
  pending: { label: 'Pending', isProcessing: true },
  paid: { label: 'Paid', isProcessing: true },
  confirmed: { label: 'Confirmed', isProcessing: true },
  preparing: { label: 'Preparing', isProcessing: true },
  ready_for_pickup: { label: 'Ready for Pickup', isProcessing: true },
  picked_up: { label: 'Picked Up', isProcessing: true },
  delivering: { label: 'Delivering', isProcessing: true },
  delivered: { label: 'Delivered', isProcessing: false },
  cancelled: { label: 'Cancelled', isProcessing: false },
  refunded: { label: 'Refunded', isProcessing: false },
};

export function OrderCard({ order, onActionPress }: OrderProps) {
  const statusInfo = STATUS_CONFIG[order.status] || { label: order.status, isProcessing: false };
  const isProcessing = statusInfo.isProcessing;

  const date = new Date(order.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const actionText = isProcessing ? 'Track Order' : 'Reorder';

  return (
    <View className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm mb-6 mx-4">
      <View className="p-5 flex-col gap-4">
        {/* Header */}
        <View className="flex-row justify-between items-start">
          <View className="flex-col">
            <Text
              className="text-base text-on-surface"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
            >
              Order #{order.orderId.slice(0, 8).toUpperCase()}
            </Text>
            <Text
              className="text-on-surface-variant text-sm"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              {order.restaurantName} • {date}
            </Text>
          </View>
          <View
            className={`px-3 py-1 rounded-full border ${
              isProcessing
                ? 'bg-secondary-container/10 border-secondary/20'
                : 'bg-primary/10 border-primary/20'
            }`}
          >
            <Text
              className={`text-xs ${isProcessing ? 'text-secondary' : 'text-primary'}`}
              style={{ fontFamily: 'Inter_600SemiBold' }}
            >
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {/* Content Preview */}
        <View className="flex-row items-center gap-3">
          <View className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center overflow-hidden">
            {/* Placeholder icon or image since list doesn't have thumbnails */}
            <View className="bg-primary/5 w-full h-full items-center justify-center">
              <Text className="text-primary text-xl" style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}>
                {order.firstItemName ? order.firstItemName.charAt(0) : '?'}
              </Text>
            </View>
          </View>
          <View className="flex-1">
            <Text
              className="text-on-surface text-sm"
              numberOfLines={1}
              style={{ fontFamily: 'Inter_600SemiBold' }}
            >
              {order.firstItemName || 'No items listed'}
              {order.itemCount > 1 ? ` and ${order.itemCount - 1} more items` : ''}
            </Text>
            <Text
              className="text-on-surface-variant text-xs"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              {order.paymentMethod.toUpperCase()} • {order.itemCount} Items
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View className="flex-row items-center justify-between pt-2 border-t border-surface-container">
          <View className="flex-col">
            <Text
              className="text-on-surface-variant text-xs"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              Total Amount
            </Text>
            <Text
              className="text-lg text-on-surface"
              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
            >
              ${order.totalAmount.toFixed(2)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onActionPress}
            activeOpacity={0.8}
            className="bg-primary px-6 py-3 rounded-full shadow-md items-center justify-center min-w-[120px]"
          >
            <Text className="text-on-primary text-sm" style={{ fontFamily: 'Inter_700Bold' }}>
              {actionText}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
