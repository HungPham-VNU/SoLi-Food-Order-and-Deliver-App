import { useRouter } from 'expo-router';
import { NotificationType } from '../types';

export function useNotificationNavigation() {
  const router = useRouter();

  const navigateFromNotification = (
    type: NotificationType,
    data: Record<string, any>,
  ) => {
    switch (type) {
      case 'order_placed':
      case 'order_confirmed':
      case 'order_preparing':
      case 'order_ready_for_pickup':
      case 'order_picked_up':
      case 'order_delivering':
      case 'order_delivered':
      case 'order_cancelled':
      case 'order_refunded':
      case 'payment_confirmed':
      case 'payment_failed':
      case 'refund_initiated':
        if (data.orderId) {
          // Navigate to order detail
          router.push(`/(customer)/orders/${data.orderId}`);
        } else {
          router.push('/(customer)/(tabs)/orders');
        }
        break;

      case 'new_order_received':
        if (data.orderId) {
          router.push(`/(restaurant)/orders/${data.orderId}` as any);
        } else {
          router.push('/(restaurant)/(tabs)/orders' as any);
        }
        break;

      default:
        router.push('/notifications');
    }
  };

  return { navigateFromNotification };
}
