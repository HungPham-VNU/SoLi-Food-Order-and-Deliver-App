import React from 'react';
import { OrderReviewScreen } from '@/src/features/cart';
import { router } from 'expo-router';

export default function OrderReviewRoute() {
  const handlePlaceOrder = () => {
    // In a real app, this would call an API to place the order
    // and then navigate to a success screen or back to home.
    console.log('Order placed successfully!');
    router.navigate('/(customer)/(tabs)');
  };

  return <OrderReviewScreen onPlaceOrder={handlePlaceOrder} />;
}
