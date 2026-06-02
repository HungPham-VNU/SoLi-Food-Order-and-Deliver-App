import { Stack } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="cart" />
      <Stack.Screen name="checkout/delivery-address" />
      <Stack.Screen name="checkout/payment" />
      <Stack.Screen name="checkout/order-review" />
      <Stack.Screen name="checkout/promo-picker" />
      <Stack.Screen name="product/[id]" />
      <Stack.Screen name="restaurant/[id]" />
      <Stack.Screen name="restaurant/menu-item/[id]" />
      <Stack.Screen name="orders/[id]/index" />
      <Stack.Screen name="orders/[id]/track" />
      <Stack.Screen name="orders/[id]/rate" />
      <Stack.Screen name="address-selection" />
      <Stack.Screen name="add-location" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="payment-methods" />
      <Stack.Screen name="payment/vnpay-return" />
    </Stack>
  );
}
