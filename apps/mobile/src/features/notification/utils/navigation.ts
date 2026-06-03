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
          router.navigate(`/(customer)/orders/${data.orderId}`);
        } else {
          router.navigate('/(customer)/(tabs)/orders');
        }
        break;

      case 'new_order_received':
        if (data.orderId) {
          router.navigate(`/(restaurant)/orders/${data.orderId}` as any);
        } else {
          router.navigate('/(restaurant)/(tabs)/orders' as any);
        }
        break;

      default:
        router.navigate('/notifications');
    }
  };

  return { navigateFromNotification };
}
