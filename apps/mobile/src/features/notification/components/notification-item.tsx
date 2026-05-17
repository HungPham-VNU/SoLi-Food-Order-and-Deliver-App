import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { 
  ShoppingBag, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Package, 
  Truck, 
  XCircle,
  CreditCard,
  RefreshCcw,
  Bell
} from 'lucide-react-native';
import { NotificationPayload, NotificationType } from '../types';

const getIcon = (type: NotificationType) => {
  const size = 20;
  const color = '#0d631b';

  switch (type) {
    case 'order_placed': return <ShoppingBag size={size} color={color} />;
    case 'order_confirmed': return <CheckCircle2 size={size} color={color} />;
    case 'order_preparing': return <Clock size={size} color={color} />;
    case 'order_ready_for_pickup': return <Package size={size} color={color} />;
    case 'order_picked_up':
    case 'order_delivering': return <Truck size={size} color={color} />;
    case 'order_delivered': return <CheckCircle2 size={size} color="#22c55e" />;
    case 'order_cancelled': return <XCircle size={size} color="#ef4444" />;
    case 'payment_confirmed': return <CreditCard size={size} color="#22c55e" />;
    case 'payment_failed': return <AlertCircle size={size} color="#ef4444" />;
    case 'refund_initiated':
    case 'refund_completed':
    case 'order_refunded': return <RefreshCcw size={size} color="#3b82f6" />;
    default: return <Bell size={size} color={color} />;
  }
};

interface NotificationItemProps {
  notification: NotificationPayload;
  onPress: (notification: NotificationPayload) => void;
}

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  return (
    <TouchableOpacity 
      onPress={() => onPress(notification)}
      className={`flex-row p-4 border-b border-surface-variant ${notification.isRead ? 'bg-background' : 'bg-surface-variant/20'}`}
    >
      <View className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
        {getIcon(notification.type)}
      </View>
      
      <View className="flex-1">
        <View className="flex-row justify-between items-start">
          <Text className={`text-sm ${notification.isRead ? 'text-primary/70 font-medium' : 'text-primary font-bold'}`}>
            {notification.title}
          </Text>
          <Text className="text-[10px] text-primary/50 mt-1">
            {new Date(notification.createdAt).toLocaleDateString()}
          </Text>
        </View>
        
        <Text className="text-xs text-primary/70 mt-1 leading-4" numberOfLines={2}>
          {notification.body}
        </Text>
      </View>

      {!notification.isRead && (
        <View className="w-2 h-2 rounded-full bg-red-500 ml-2 mt-2" />
      )}
    </TouchableOpacity>
  );
}
